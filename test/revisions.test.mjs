import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HubStore } from '../local/store.mjs';

test('drafts, annotations, proposals and undo survive restart; stale edits are rejected', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hub-revisions-'));
  const path = join(directory, 'hub.sqlite');
  let store = new HubStore(path);
  try {
    store.seed('lecture', 'algorithms', 'Lecture 1');
    const blocks = [{ id: 'statement-1', kind: 'paragraph', text: 'A statement', sources: [] }];
    store.save('lecture', 0, blocks, [], 'Draft');
    const proposalId = store.propose('lecture', 1, { summary: 'Add understanding', annotation: { targetId: 'statement-1', text: 'My insight' } });
    assert.equal(store.lecture('lecture').annotations.length, 0);
    store.close(); store = new HubStore(path);
    store.applyProposal('lecture', proposalId);
    assert.equal(store.lecture('lecture').annotations[0].text, 'My insight');
    assert.throws(() => store.save('lecture', 1, blocks, [], 'Stale'), /version_conflict/);
    assert.throws(() => store.save('lecture', 2, [], store.lecture('lecture').annotations, 'Orphan'), /invalid_annotation/);
    store.close(); store = new HubStore(path);
    store.undo('lecture', 2);
    assert.equal(store.lecture('lecture').annotations.length, 0);
    store.undo('lecture', 3);
    assert.deepEqual(store.lecture('lecture').content, []);
    assert.throws(() => store.undo('lecture', 4), /nothing_to_undo/);
    store.restore('lecture', 4, 2);
    assert.equal(store.lecture('lecture').annotations.length, 1);
    assert.equal(store.revisions('lecture').length, 6);
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});