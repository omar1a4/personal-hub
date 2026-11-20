import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { startLocalServer } from '../local/server.mjs';
import { HubStore } from '../local/store.mjs';

async function fixture(context) {
  let state = { status: 'disconnected', sharing: false };
  let owner = null;
  let request;
  let completion;
  const runtime = {
    getSession: async () => state,
    signIn: async () => (state = { status: 'connected', sharing: true, profileId: 'synthetic-owner' }),
    listModels: async () => [{ slug: 'synthetic-test-model', displayName: 'Test fixture only' }],
    disconnect: async () => { state = { status: 'disconnected', sharing: false }; },
    cancelSignIn() {},
    streamResponse: async options => { request = options; options.onDelta('Synthetic test output'); return { text: 'Synthetic test output' }; },
  };
  const store = new HubStore(':memory:');
  const application = await startLocalServer({ runtime, store, root: process.cwd(),
    ownerStore: { read: async () => owner, write: async value => { owner = value; } },
    onVerified: async value => { completion = value; },
  });
  context.after(() => { application.server.closeAllConnections(); application.server.close(); store.close(); });
  const token = new URLSearchParams(new URL(application.launchUrl).hash.slice(1)).get('launch');
  const bootstrap = await fetch(`${application.origin}/api/bootstrap`, {
    method: 'POST', headers: { Origin: application.origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  });
  const cookie = bootstrap.headers.get('set-cookie').split(';')[0];
  const status = await (await fetch(`${application.origin}/api/state`, { headers: { Cookie: cookie } })).json();
  const post = (path, payload = {}, overrides = {}) => fetch(`${application.origin}${path}`, {
    method: 'POST', headers: { Origin: application.origin, Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': status.csrf, ...overrides }, body: JSON.stringify(payload),
  });
  return { ...application, post, token, runtime, store, get: path => fetch(`${application.origin}${path}`, { headers: { Cookie: cookie } }), setState: next => { state = next; }, getRequest: () => request, getCompletion: () => completion };
}

test('loopback server denies unauthenticated, foreign-origin, invalid-CSRF and replayed launch requests', async context => {
  const application = await fixture(context);
  assert.equal(application.server.address().address, '127.0.0.1');
  assert.equal((await fetch(`${application.origin}/api/state`)).status, 401);
  assert.equal((await application.post('/api/connect', {}, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await application.post('/api/connect', {}, { 'X-CSRF-Token': 'wrong' })).status, 403);
  assert.equal((await application.post('/api/bootstrap', { token: application.token })).status, 401);
  const forgedHostStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(`${application.origin}/health`, { headers: { Host: 'attacker.example' } }, response => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on('error', reject);
    request.end();
  });
  assert.equal(forgedHostStatus, 403);
});

test('verified sign-in alone does not grant owner access or plan permission', async context => {
  const application = await fixture(context);
  assert.equal((await application.post('/api/connect')).status, 200);
  assert.equal((await application.post('/api/models')).status, 403);
  assert.equal((await application.post('/api/owner')).status, 200);
  application.setState({ status: 'connected', sharing: true, profileId: 'different-account' });
  assert.equal((await application.post('/api/models')).status, 403);
  application.setState({ status: 'connected', sharing: false, profileId: 'synthetic-owner' });
  assert.equal((await application.post('/api/models')).status, 400);
});

test('request includes lecture context and emits completion only after a nonempty result', async context => {
  const application = await fixture(context);
  await application.post('/api/connect');
  await application.post('/api/owner');
  await application.post('/api/models');
  const response = await application.post('/api/chat', { message: 'Why is it logarithmic?', model: 'synthetic-test-model' });
  const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(events.map(event => event.type), ['delta', 'completed']);
  assert.match(application.getRequest().instructions, /candidate interval/);
  assert.equal(application.getRequest().input[0].content, 'Why is it logarithmic?');
  assert.equal(application.getCompletion().completed, true);
  const restored = await (await application.get('/api/messages?lectureId=demo')).json();
  assert.equal(restored.messages.length, 2);
  assert.equal(restored.messages[1].content, 'Synthetic test output');
  await application.post('/api/chat', { message: 'Continue', model: 'synthetic-test-model' });
  assert.equal(application.getRequest().input.length, 3);
});

test('failed or empty streams never emit completed or leak upstream error content', async context => {
  const application = await fixture(context);
  await application.post('/api/connect');
  await application.post('/api/owner');
  await application.post('/api/models');
  application.runtime.streamResponse = async options => {
    options.onDelta('Partial');
    throw Object.assign(new Error('SECRET-UPSTREAM-DIAGNOSTIC'), { code: 'stream_interrupted' });
  };
  const failed = await (await application.post('/api/chat', { message: 'Question', model: 'synthetic-test-model' })).text();
  assert.doesNotMatch(failed, /SECRET|"type":"completed"/);
  assert.equal(application.getCompletion(), undefined);
  application.runtime.streamResponse = async () => ({ text: '' });
  const empty = await (await application.post('/api/chat', { message: 'Question', model: 'synthetic-test-model' })).text();
  assert.match(empty, /empty_response/);
  assert.equal(application.getCompletion(), undefined);
});

test('local interface and bundled visual assets load with restrictive browser headers', async context => {
  const application = await fixture(context);
  for (const path of ['/', '/app.js', '/style.css', '/icons.js', '/sans.woff2', '/serif.woff2']) {
    const response = await fetch(`${application.origin}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  }
});