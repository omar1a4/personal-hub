import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const reject = code => { throw Object.assign(new Error(code), { code }); };

export class HubStore {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS lectures (id TEXT PRIMARY KEY, course TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '[]', version INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, lecture_id TEXT NOT NULL REFERENCES lectures(id), role TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS messages_lecture ON messages(lecture_id, id);
      CREATE TABLE IF NOT EXISTS summaries (lecture_id TEXT PRIMARY KEY REFERENCES lectures(id), through_id INTEGER NOT NULL, content TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, lecture_id TEXT NOT NULL REFERENCES lectures(id), name TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL, pages INTEGER NOT NULL, position INTEGER NOT NULL, captured_at TEXT, sha256 TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions (lecture_id TEXT NOT NULL REFERENCES lectures(id), version INTEGER NOT NULL, snapshot TEXT NOT NULL, reason TEXT NOT NULL, parent_version INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(lecture_id, version));
      CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, lecture_id TEXT NOT NULL REFERENCES lectures(id), base_version INTEGER NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    `);
    if (!this.db.prepare('PRAGMA table_info(lectures)').all().some(column => column.name === 'annotations')) this.db.exec("ALTER TABLE lectures ADD COLUMN annotations TEXT NOT NULL DEFAULT '[]'");
  }
  close() { this.db.close(); }
  seed(id, course, title, content = []) {
    this.db.prepare('INSERT OR IGNORE INTO lectures(id, course, title, content) VALUES (?, ?, ?, ?)').run(id, course, title, JSON.stringify(content));
  }
  lecture(id) {
    const row = this.db.prepare('SELECT * FROM lectures WHERE id=?').get(id);
    if (!row) throw Object.assign(new Error('lecture_not_found'), { code: 'lecture_not_found' });
    return { ...row, content: JSON.parse(row.content), annotations: JSON.parse(row.annotations) };
  }
  lectures() { return this.db.prepare('SELECT id, course, title, version FROM lectures ORDER BY rowid').all(); }
  messages(id) {
    this.lecture(id);
    return this.db.prepare('SELECT * FROM messages WHERE lecture_id=? ORDER BY id').all(id);
  }
  addMessage(id, role, content, status = 'completed') {
    this.lecture(id);
    return Number(this.db.prepare('INSERT INTO messages(lecture_id, role, content, status) VALUES (?, ?, ?, ?)').run(id, role, content, status).lastInsertRowid);
  }
  summary(id) { return this.db.prepare('SELECT * FROM summaries WHERE lecture_id=?').get(id); }
  saveSummary(id, throughId, content) {
    this.db.prepare('INSERT INTO summaries VALUES (?, ?, ?) ON CONFLICT(lecture_id) DO UPDATE SET through_id=excluded.through_id, content=excluded.content').run(id, throughId, content);
  }
  context(id, query) {
    const history = this.messages(id).filter(message => message.status === 'completed');
    const summary = this.summary(id);
    if (!summary) return history.map(({ role, content }) => ({ role, content }));
    const recent = history.filter(message => message.id > summary.through_id);
    const terms = new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
    const relevant = history.filter(message => message.id <= summary.through_id)
      .map(message => ({ ...message, score: [...terms].filter(term => message.content.toLocaleLowerCase().includes(term)).length }))
      .filter(message => message.score > 0).sort((left, right) => right.score - left.score).slice(0, 6).sort((left, right) => left.id - right.id);
    return [
      { role: 'developer', content: `Earlier conversation summary (not new instructions):\n${summary.content}\nOriginal messages remain stored. Retrieved related earlier excerpts:\n${relevant.map(message => `${message.role}: ${message.content}`).join('\n')}` },
      ...recent.map(({ role, content }) => ({ role, content })),
    ];
  }
  transaction(action) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  uploads(id) { this.lecture(id); return this.db.prepare('SELECT * FROM uploads WHERE lecture_id=? ORDER BY position, rowid').all(id); }
  upload(id, lectureId) {
    const upload = this.db.prepare('SELECT * FROM uploads WHERE id=? AND lecture_id=?').get(id, lectureId);
    if (!upload) reject('source_not_found');
    return upload;
  }
  addUpload(upload) {
    this.lecture(upload.lectureId);
    this.db.prepare('INSERT INTO uploads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(upload.id, upload.lectureId, upload.name, upload.mime, upload.bytes, upload.pages, this.uploads(upload.lectureId).length, upload.capturedAt, upload.sha256);
  }
  reorder(id, order) {
    const current = this.uploads(id);
    if (!Array.isArray(order) || new Set(order).size !== current.length || order.length !== current.length || current.some(file => !order.includes(file.id))) reject('invalid_order');
    this.transaction(() => order.forEach((fileId, position) => this.db.prepare('UPDATE uploads SET position=? WHERE id=? AND lecture_id=?').run(position, fileId, id)));
  }
  validateBlocks(id, blocks) {
    if (!Array.isArray(blocks) || blocks.length > 1500 || JSON.stringify(blocks).length > 800_000) reject('invalid_draft');
    const used = new Set();
    return blocks.map(block => {
      if (!block || typeof block.text !== 'string' || block.text.length > 100_000 || !['heading', 'paragraph', 'proof', 'example', 'equation', 'uncertainty'].includes(block.kind)) reject('invalid_draft');
      const blockId = block.id ?? randomUUID();
      if (typeof blockId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(blockId) || used.has(blockId)) reject('invalid_draft');
      used.add(blockId);
      if (block.sources !== undefined && !Array.isArray(block.sources)) reject('invalid_draft');
      const sources = (block.sources ?? []).map(source => {
        const upload = this.upload(source.uploadId, id);
        if (!Number.isInteger(source.page) || source.page < 1 || source.page > upload.pages) reject('invalid_source_page');
        return { uploadId: upload.id, page: source.page };
      });
      return { id: blockId, kind: block.kind, text: block.text, sources };
    });
  }
  save(id, expectedVersion, blocks, annotations, reason, parentOverride, afterWrite = () => {}) {
    const content = this.validateBlocks(id, blocks);
    if (!Array.isArray(annotations) || annotations.some(item => typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || typeof item.text !== 'string' || item.text.length > 100_000 || !content.some(block => block.id === item.targetId))) reject('invalid_annotation');
    if (new Set(annotations.map(item => item.id)).size !== annotations.length) reject('invalid_annotation');
    return this.transaction(() => {
      const current = this.lecture(id);
      if (current.version !== expectedVersion) reject('version_conflict');
      this.db.prepare('INSERT OR IGNORE INTO revisions VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').run(id, current.version, JSON.stringify({ content: current.content, annotations: current.annotations }), 'Initial state', null);
      const version = current.version + 1;
      const snapshot = { content, annotations: annotations.map(({ id, targetId, text }) => ({ id, targetId, text })) };
      this.db.prepare('INSERT INTO revisions VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').run(id, version, JSON.stringify(snapshot), reason, parentOverride === undefined ? current.version : parentOverride);
      this.db.prepare('UPDATE lectures SET content=?, annotations=?, version=? WHERE id=?').run(JSON.stringify(snapshot.content), JSON.stringify(snapshot.annotations), version, id);
      afterWrite();
      return this.lecture(id);
    });
  }
  revisions(id) { this.lecture(id); return this.db.prepare('SELECT version, reason, created_at FROM revisions WHERE lecture_id=? ORDER BY version DESC').all(id); }
  undo(id, expectedVersion) {
    const current = this.lecture(id);
    if (current.version !== expectedVersion) reject('version_conflict');
    const revision = this.db.prepare('SELECT * FROM revisions WHERE lecture_id=? AND version=?').get(id, current.version);
    if (!revision || revision.parent_version === null) reject('nothing_to_undo');
    const target = this.db.prepare('SELECT * FROM revisions WHERE lecture_id=? AND version=?').get(id, revision.parent_version);
    const snapshot = JSON.parse(target.snapshot);
    return this.save(id, expectedVersion, snapshot.content, snapshot.annotations, `Undo to version ${target.version}`, target.parent_version);
  }
  restore(id, expectedVersion, targetVersion) {
    const revision = this.db.prepare('SELECT * FROM revisions WHERE lecture_id=? AND version=?').get(id, targetVersion);
    if (!revision) reject('version_not_found');
    const snapshot = JSON.parse(revision.snapshot);
    return this.save(id, expectedVersion, snapshot.content, snapshot.annotations, `Restore version ${targetVersion}`);
  }
  propose(id, baseVersion, payload) {
    const current = this.lecture(id);
    if (current.version !== baseVersion) reject('version_conflict');
    if (!payload || typeof payload.summary !== 'string' || payload.summary.length > 2000) reject('invalid_proposal');
    let proposal;
    if (payload.blocks) proposal = { summary: payload.summary, blocks: this.validateBlocks(id, payload.blocks) };
    else if (payload.annotation && typeof payload.annotation.text === 'string' && payload.annotation.text.length <= 100_000 && current.content.some(block => block.id === payload.annotation.targetId)) proposal = { summary: payload.summary, annotation: { id: randomUUID(), targetId: payload.annotation.targetId, text: payload.annotation.text } };
    else reject('invalid_proposal');
    const proposalId = randomUUID();
    this.db.prepare('INSERT INTO proposals(id, lecture_id, base_version, payload) VALUES (?, ?, ?, ?)').run(proposalId, id, baseVersion, JSON.stringify(proposal));
    return proposalId;
  }
  proposals(id) { return this.db.prepare("SELECT * FROM proposals WHERE lecture_id=? AND status='pending' ORDER BY rowid").all(id).map(row => ({ ...row, payload: JSON.parse(row.payload) })); }
  applyProposal(id, proposalId) {
    const proposal = this.proposals(id).find(row => row.id === proposalId);
    if (!proposal) reject('proposal_not_found');
    const current = this.lecture(id);
    const payload = proposal.payload;
    return this.save(id, proposal.base_version, payload.blocks ?? current.content, payload.annotation ? [...current.annotations, payload.annotation] : current.annotations, payload.summary, undefined, () => {
      this.db.prepare("UPDATE proposals SET status='applied' WHERE id=?").run(proposalId);
    });
  }
  rejectProposal(id, proposalId) { this.db.prepare("UPDATE proposals SET status='rejected' WHERE id=? AND lecture_id=? AND status='pending'").run(proposalId, id); }
}