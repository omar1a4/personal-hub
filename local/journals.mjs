import { blankEntry, checkKey, entryId, entryPath, filterEntries, searchEntries, journalStats, validateDocument } from '../shared/journal-model.mjs';
const fail = code => { throw Object.assign(new Error(code), { code }); };
export class Journals {
  constructor(store) {
    this.store = store; this.db = store.db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS journal_entries (kind TEXT NOT NULL, day TEXT NOT NULL, document TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(kind, day));
      CREATE TABLE IF NOT EXISTS journal_revisions (kind TEXT NOT NULL, day TEXT NOT NULL, version INTEGER NOT NULL, document TEXT NOT NULL, reason TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(kind, day, version));
      CREATE TABLE IF NOT EXISTS journal_messages (id INTEGER PRIMARY KEY, thread TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL, sources TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS journal_messages_thread ON journal_messages(thread, id);
      CREATE TABLE IF NOT EXISTS journal_summaries (thread TEXT PRIMARY KEY, through_id INTEGER NOT NULL, content TEXT NOT NULL);
    `);
  }
  decode(row) { return { kind: row.kind, date: row.day, version: row.version, updatedAt: row.updated_at, document: JSON.parse(row.document) }; }
  entry(kind, date) { checkKey(kind, date); const row = this.db.prepare('SELECT * FROM journal_entries WHERE kind=? AND day=?').get(kind, date); return row ? this.decode(row) : blankEntry(kind, date); }
  entries(filters = {}) { return filterEntries(this.db.prepare('SELECT * FROM journal_entries ORDER BY day DESC').all().map(row => this.decode(row)), filters); }
  save(kind, date, expectedVersion, document, reason = 'Edited journal', inTransaction = false) {
    checkKey(kind, date); document = validateDocument(kind, document);
    const write = () => {
      const previous = this.entry(kind, date);
      if (!Number.isInteger(expectedVersion) || previous.version !== expectedVersion) fail('version_conflict');
      const version = expectedVersion + 1, at = new Date().toISOString();
      if (!expectedVersion) this.db.prepare('INSERT OR IGNORE INTO journal_revisions VALUES (?, ?, 0, ?, ?, ?)').run(kind, date, JSON.stringify(previous.document), 'Empty entry', at);
      this.db.prepare('INSERT INTO journal_entries VALUES (?, ?, ?, ?, ?) ON CONFLICT(kind,day) DO UPDATE SET document=excluded.document,version=excluded.version,updated_at=excluded.updated_at').run(kind, date, JSON.stringify(document), version, at);
      this.db.prepare('INSERT INTO journal_revisions VALUES (?, ?, ?, ?, ?, ?)').run(kind, date, version, JSON.stringify(document), reason, at);
      return this.entry(kind, date);
    };
    return inTransaction ? write() : this.store.transaction(write);
  }
  revisions(kind, date) { checkKey(kind, date); return this.db.prepare('SELECT version, reason, updated_at AS updatedAt FROM journal_revisions WHERE kind=? AND day=? ORDER BY version DESC').all(kind, date); }
  restore(kind, date, expectedVersion, targetVersion) {
    checkKey(kind, date);
    const row = this.db.prepare('SELECT document FROM journal_revisions WHERE kind=? AND day=? AND version=?').get(kind, date, targetVersion);
    if (!row) fail('revision_not_found');
    return this.save(kind, date, expectedVersion, JSON.parse(row.document), `Restored version ${targetVersion}`);
  }
  thread(kind, date) { if (kind === 'home') return 'home'; checkKey(kind, date); return `${kind}:${date}`; }
  messages(thread) { return this.db.prepare('SELECT * FROM journal_messages WHERE thread=? ORDER BY id').all(thread).map(row => ({ ...row, sources: JSON.parse(row.sources) })); }
  addMessage(thread, role, content, status = 'completed', sources = []) { return Number(this.db.prepare('INSERT INTO journal_messages(thread,role,content,status,sources) VALUES(?,?,?,?,?)').run(thread, role, content, status, JSON.stringify(sources)).lastInsertRowid); }
  summary(thread) { return this.db.prepare('SELECT * FROM journal_summaries WHERE thread=?').get(thread); }
  saveSummary(thread, through, content) { this.db.prepare('INSERT INTO journal_summaries VALUES(?,?,?) ON CONFLICT(thread) DO UPDATE SET through_id=excluded.through_id,content=excluded.content').run(thread, through, content); }
  search(query, filters, limit = 30) { return searchEntries(this.entries(), query, filters, limit); }
  overview(filters = {}) { const entries = this.entries(filters); return { entries, stats: journalStats(entries) }; }
  source(entry) { return { id: entryId(entry), title: entry.document.title, kind: entry.kind, date: entry.date, href: entryPath(entry), version: entry.version }; }
  export() { return { format: 'personal-hub-journals', version: 1, exportedAt: new Date().toISOString(), entries: this.entries(), messages: this.db.prepare('SELECT * FROM journal_messages ORDER BY id').all().map(r => ({ ...r, sources: JSON.parse(r.sources) })), revisions: this.db.prepare('SELECT * FROM journal_revisions ORDER BY day, version').all().map(r => ({ ...r, document: JSON.parse(r.document) })) }; }
}
