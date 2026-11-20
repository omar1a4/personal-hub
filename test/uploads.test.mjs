import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { HubStore } from '../local/store.mjs';
import { saveUpload, sourceInputs } from '../local/uploads.mjs';
import { buildLecture } from '../local/workflow.mjs';

test('original PDF retained, pages validated, order persisted, sources scoped and draft save verified', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hub-uploads-'));
  const store = new HubStore(join(directory, 'db.sqlite'));
  try {
    store.seed('first', 'algorithms', 'Lecture 1'); store.seed('second', 'algorithms', 'Lecture 2');
    const pdf = await PDFDocument.create(); pdf.addPage(); pdf.addPage();
    const bytes = Buffer.from(await pdf.save());
    const first = await saveUpload(store, directory, 'first', { name: 'original.pdf', data: bytes.toString('base64') });
    const second = await saveUpload(store, directory, 'first', { name: 'support.pdf', data: bytes.toString('base64') });
    assert.deepEqual(await readFile(join(directory, first.id)), bytes);
    assert.equal(first.pages, 2);
    store.reorder('first', [second.id, first.id]);
    assert.equal(store.uploads('first')[0].id, second.id);
    assert.throws(() => store.reorder('first', [first.id, first.id]), /invalid_order/);
    await assert.rejects(sourceInputs(store, directory, 'second', [first.id]), /source_not_found/);
    const parts = await sourceInputs(store, directory, 'first', [first.id]);
    assert.equal(parts[1].type, 'input_file');
    assert.match(parts[1].file_data, /^data:application\/pdf;base64,/);
    const block = { id: 'proof-step', kind: 'proof', text: 'Grounded test text', sources: [{ uploadId: first.id, page: 2 }] };
    assert.throws(() => store.validateBlocks('first', [{ ...block, sources: [{ uploadId: first.id, page: 3 }] }]), /invalid_source_page/);
    const runtime = { streamResponse: async options => { assert.ok(options.input[0].content.some(part => part.type === 'input_file')); return { text: JSON.stringify({ blocks: [block] }) }; } };
    const result = await buildLecture({ store, runtime, uploadsDir: directory, lectureId: 'first', model: 'synthetic' });
    assert.equal(result.lecture.version, 1);
    runtime.streamResponse = async () => ({ text: 'not a valid draft' });
    await assert.rejects(buildLecture({ store, runtime, uploadsDir: directory, lectureId: 'first', model: 'synthetic' }), /invalid_draft/);
    assert.equal(store.lecture('first').version, 1);
    assert.deepEqual(store.lecture('second').content, []);
    await assert.rejects(saveUpload(store, directory, 'first', { name: 'bad.html', data: Buffer.from('<script>bad</script>').toString('base64') }), /unsupported_file/);
  } finally { store.close(); await rm(directory, { recursive: true }); }
});