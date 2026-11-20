import test from 'node:test';
import assert from 'node:assert/strict';
import { HubStore } from '../local/store.mjs';
import { seedCatalog, courses } from '../local/catalog.mjs';

test('13 stable empty Algorithms lectures are isolated from the demo', () => {
  const store = new HubStore(':memory:');
  try {
    seedCatalog(store);
    seedCatalog(store);
    assert.equal(courses.length, 3);
    const lectures = store.lectures().filter(lecture => lecture.course === 'algorithms');
    assert.equal(lectures.length, 13);
    assert.equal(new Set(lectures.map(lecture => lecture.id)).size, 13);
    for (const lecture of lectures) assert.deepEqual(store.lecture(lecture.id).content, []);
    assert.equal(store.lecture('demo').content.length, 1);
    store.addMessage('algorithms-01', 'user', 'Only Lecture 1');
    assert.deepEqual(store.messages('algorithms-02'), []);
    assert.deepEqual(store.messages('demo'), []);
  } finally { store.close(); }
});