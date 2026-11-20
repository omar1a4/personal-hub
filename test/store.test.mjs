import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HubStore } from '../local/store.mjs';

test('messages and summaries survive database reopen and stay lecture-specific', () => {
  const directory = mkdtempSync(join(tmpdir(), 'personal-hub-test-'));
  const path = join(directory, 'hub.sqlite');
  let store = new HubStore(path);
  try {
    store.seed('lecture-a', 'algorithms', 'Lecture 1');
    store.seed('lecture-b', 'algorithms', 'Lecture 2');
    const earlier = store.addMessage('lecture-a', 'user', 'Remember my invariant question.');
    store.addMessage('lecture-a', 'assistant', 'An unfinished answer', 'incomplete');
    store.addMessage('lecture-b', 'user', 'Different conversation');
    store.saveSummary('lecture-a', earlier, 'The owner asked about the invariant.');
    store.addMessage('lecture-a', 'user', 'Continue with an example');
    store.close();
    store = new HubStore(path);
    assert.equal(store.messages('lecture-a').length, 3);
    assert.equal(store.messages('lecture-b').length, 1);
    const context = JSON.stringify(store.context('lecture-a', 'invariant'));
    assert.match(context, /Remember my invariant/);
    assert.match(context, /Continue with an example/);
    assert.doesNotMatch(context, /Different conversation|unfinished answer/);
    assert.throws(() => store.messages('missing'), /lecture_not_found/);
  } finally { store.close(); rmSync(directory, { recursive: true }); }
});