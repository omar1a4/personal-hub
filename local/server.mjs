import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { instructions } from './lecture.mjs';
import { conversationContext } from './context.mjs';
import { courses, seedCatalog } from './catalog.mjs';
import { saveUpload, sourceInputs } from './uploads.mjs';
import { buildLecture, lectureInstructions, saveChatProposal } from './workflow.mjs';
import { Journals } from './journals.mjs';
import { journalChat } from './journal-assistant.mjs';

const randomSecret = () => randomBytes(32).toString('base64url');
const equal = (left, right) => typeof left === 'string' && typeof right === 'string'
  && left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));

const messages = {
  invalid_journal: 'Check the entry date, study minutes and ratings. Ratings use 1–5; daily hours cannot exceed 24.',
  invalid_journal_response: 'The assistant returned an invalid report. Your message is saved; your entry was not changed. Try again.',
  revision_not_found: 'That journal revision could not be found.',
  upload_limit: 'Limit: 10 MB per file, 40 MB and 40 files per lecture.',
  unsupported_file: 'Supported originals: JPEG, PNG, WebP and PDF. Convert HEIC or other formats before uploading.',
  invalid_file: 'The upload could not be read as a supported file.',
  invalid_pdf: 'This PDF is invalid or password-protected. Export an unlocked PDF first.',
  pdf_page_limit: 'This local version supports up to 100 pages per PDF. Split a larger PDF first.',
  invalid_draft: 'The AI result was not a valid editable draft. Existing lecture content was not replaced.',
  ungrounded_draft: 'The AI result lacked source references. No draft was saved.',
  invalid_source_page: 'A generated source reference had an invalid page number. No change was saved.',
  source_not_found: 'A selected source does not belong to this lecture.',
  source_corrupted: 'An original file failed its integrity check. Processing stopped.',
  no_sources: 'Upload at least one image or PDF before building the lecture.',
  invalid_order: 'The file order did not match this lecture. Refresh and try again.',
  invalid_proposal: 'The proposed edit was invalid. Existing lecture content is unchanged.',
  invalid_annotation: 'The edit would leave an annotation without its statement, or the annotation is invalid.',
  version_conflict: 'This page changed in another request. Reload the saved entry before editing again.',
  nothing_to_undo: 'There is no earlier edit to undo.',
  lecture_not_found: 'Lecture not found.',
  unauthorized: 'Open the local window launched by the app.',
  forbidden: 'This request is not authorized.',
  owner_required: 'Confirm the connected account as owner before using the assistant.',
  wrong_owner: 'This connection is not the authorized owner.',
  sharing_not_enabled: 'ChatGPT plan usage was not granted. Reconnect and review the permission on OpenAI.',
  sign_in_required: 'Connect your ChatGPT account first.',
  busy: 'Finish or stop the current operation first.',
  invalid_request: 'Enter a question of 1 to 4,000 characters and select an available model.',
  no_models: 'No eligible models were returned for this connection.',
  cancelled: 'Response stopped. Partial text is not a completed response.',
  empty_response: 'The request completed without any text.',
  subscription_sharing_usage_limit_exceeded: 'ChatGPT plan usage limit reached. Review Manage usage; no API-key fallback was used.',
  subscription_sharing_usage_unavailable: 'ChatGPT plan usage is unavailable for this account or workspace.',
  network_error: 'Could not reach OpenAI. Check your connection and try again.',
  stream_interrupted: 'The stream ended before completion. Partial text is not a verified response.',
  response_incomplete: 'OpenAI reported an incomplete response.',
  access_denied: 'Authorization was declined or is not available for this account.',
  invalid_scope: 'OpenAI did not accept the requested plan-usage scopes.',
  invalid_client: 'OpenAI did not accept the local client registration.',
};

function safeError(error) {
  const code = typeof error?.code === 'string' && /^[a-z_]{1,80}$/.test(error.code) ? error.code : 'request_failed';
  return { code, message: messages[code] ?? `The operation failed (${code}). No billing fallback was used.` };
}

function fail(code) { throw Object.assign(new Error(code), { code }); }

async function body(request, limit = 1_048_576) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') fail('forbidden');
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > limit) fail('invalid_request');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail('invalid_request'); }
}

export async function startLocalServer({ runtime, ownerStore, store, uploadsDir, root, port = 0, onVerified = async () => {}, onFailure = async () => {} }) {
  seedCatalog(store);
  const journals = new Journals(store);
  let bootstrap = randomSecret();
  const sessionCookie = randomSecret();
  const csrf = randomSecret();
  const sessionExpires = Date.now() + 8 * 60 * 60 * 1000;
  let owner = await ownerStore.read();
  let models = [];
  let busy = false;
  let activeRequest;
  let origin;
  const assets = new Map([
    ['/', ['web/index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['web/app.js', 'text/javascript; charset=utf-8']],
    ['/navigation.js', ['web/navigation.js', 'text/javascript; charset=utf-8']],
    ['/workflow.js', ['web/workflow.js', 'text/javascript; charset=utf-8']],
    ['/journals.js', ['web/journals.js', 'text/javascript; charset=utf-8']],
    ['/demo.js', ['web/demo.js', 'text/javascript; charset=utf-8']],
    ['/journal-model.mjs', ['shared/journal-model.mjs', 'text/javascript; charset=utf-8']],
    ['/journals.css', ['web/journals.css', 'text/css; charset=utf-8']],
    ['/rich.js', ['web/generated/rich.js', 'text/javascript; charset=utf-8']],
    ['/katex.css', ['node_modules/katex/dist/katex.min.css', 'text/css; charset=utf-8']],
    ['/style.css', ['web/style.css', 'text/css; charset=utf-8']],
    ['/icons.js', ['node_modules/lucide/dist/umd/lucide.js', 'text/javascript; charset=utf-8']],
    ['/sans.woff2', ['node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2', 'font/woff2']],
    ['/serif.woff2', ['node_modules/@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2', 'font/woff2']],
  ]);

  const ownerSession = async (requirePlan = true) => {
    const state = await runtime.getSession();
    if (state.status !== 'connected') fail('sign_in_required');
    if (!owner) fail('owner_required');
    if (state.profileId !== owner.profileId) fail('wrong_owner');
    if (requirePlan && !state.sharing) fail('sharing_not_enabled');
    return state;
  };

  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json = (status, data) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(data));
    };
    try {
      if (request.headers.host !== new URL(origin).host || !['127.0.0.1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) fail('forbidden');
      const url = new URL(request.url, origin);
      if (url.origin !== origin) fail('forbidden');
      if (request.method === 'GET' && /^\/fonts\/KaTeX_[a-zA-Z0-9_-]+\.(woff2?|ttf)$/.test(url.pathname)) {
        const content = await readFile(join(root, 'node_modules/katex/dist', url.pathname.slice(1)));
        response.writeHead(200, { 'Content-Type': 'application/octet-stream' }); response.end(content); return;
      }
      if (request.method === 'GET' && url.pathname === '/api/catalog') {
        json(200, { courses, lectures: store.lectures().map(({ id, course, title }) => ({ id, course, title })) });
        return;
      }
      if (request.method === 'GET' && (['/education/daily', '/habits-sleep'].includes(url.pathname) || /^\/(education(?:\/courses(?:\/[a-z-]+)?)?|lecture\/(?:algorithms-\d{2}|demo))$/.test(url.pathname))) url.pathname = '/';
      if (request.method === 'GET' && assets.has(url.pathname)) {
        const [path, type] = assets.get(url.pathname);
        const content = await readFile(join(root, path));
        response.writeHead(200, { 'Content-Type': type });
        response.end(content);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health') { json(200, { ready: true, localOnly: true }); return; }
      if (request.method === 'POST' && request.headers.origin !== origin) fail('forbidden');
      if (request.method === 'POST' && url.pathname === '/api/bootstrap') {
        const payload = await body(request);
        if (!bootstrap || !equal(payload?.token, bootstrap)) fail('unauthorized');
        bootstrap = undefined;
        response.setHeader('Set-Cookie', `personal_hub=${sessionCookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
        json(200, { ready: true });
        return;
      }
      const cookie = request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('personal_hub='))?.slice('personal_hub='.length);
      if (Date.now() >= sessionExpires || !equal(cookie, sessionCookie)) fail('unauthorized');
      if (request.method === 'POST' && !equal(request.headers['x-csrf-token'], csrf)) fail('forbidden');

      if (request.method === 'GET' && url.pathname === '/api/state') {
        const state = await runtime.getSession();
        json(200, {
          status: state.status, sharing: state.sharing, busy, csrf,
          account: state.identity?.email ?? state.identity?.name ?? '',
          ownerConfirmed: Boolean(owner && owner.profileId === state.profileId && state.status === 'connected'),
          canConfirmOwner: !owner && state.status === 'connected',
          models, error: state.error ? safeError(state.error) : null,
        });
        return;
      }
      if (url.pathname.startsWith('/api/journal/') && request.method === 'GET') {
        await ownerSession(false);
        const kind = url.searchParams.get('kind'), date = url.searchParams.get('date');
        const filters = { kind: kind || undefined, from: url.searchParams.get('from') || undefined, to: url.searchParams.get('to') || undefined };
        if (url.pathname === '/api/journal/entry') return json(200, { ...journals.entry(kind, date), revisions: journals.revisions(kind, date) });
        if (url.pathname === '/api/journal/messages') { const thread = journals.thread(kind, date); return json(200, { messages: journals.messages(thread), summarized: Boolean(journals.summary(thread)) }); }
        if (url.pathname === '/api/journal/overview') return json(200, journals.overview(filters));
        if (url.pathname === '/api/journal/search') return json(200, { entries: journals.search(url.searchParams.get('q') ?? '', filters) });
        if (url.pathname === '/api/journal/export') { response.setHeader('Content-Disposition', 'attachment; filename="personal-hub-journals.json"'); return json(200, journals.export()); }
        return json(404, { message: 'Not found.' });
      }
      if (request.method === 'GET' && url.pathname === '/api/messages') {
        await ownerSession(false);
        const lectureId = url.searchParams.get('lectureId') ?? 'demo';
        json(200, { messages: store.messages(lectureId), summarized: Boolean(store.summary(lectureId)) });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/lecture') {
        await ownerSession(false);
        const lectureId = url.searchParams.get('id');
        json(200, { ...store.lecture(lectureId), uploads: store.uploads(lectureId), revisions: store.revisions(lectureId), proposals: store.proposals(lectureId) });
        return;
      }
      if (request.method === 'GET' && url.pathname.startsWith('/api/file/')) {
        await ownerSession(false);
        const file = store.upload(url.pathname.split('/').at(-1), url.searchParams.get('lectureId'));
        const bytes = await readFile(join(uploadsDir, file.id));
        response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
        response.writeHead(200, { 'Content-Type': file.mime, 'Content-Disposition': `${url.searchParams.has('download') ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.name)}` });
        response.end(bytes);
        return;
      }
      if (request.method !== 'POST') { json(404, { message: 'Not found.' }); return; }
      if (url.pathname === '/api/stop') {
        activeRequest?.abort();
        runtime.cancelSignIn();
        json(200, { stopped: true });
        return;
      }
      if (busy) fail('busy');
      busy = true;
      try {
        if (url.pathname === '/api/journal/save' || url.pathname === '/api/journal/restore') {
          await ownerSession(false);
          const payload = await body(request);
          const entry = url.pathname.endsWith('/save')
            ? journals.save(payload.kind, payload.date, payload.expectedVersion, payload.document)
            : journals.restore(payload.kind, payload.date, payload.expectedVersion, payload.targetVersion);
          json(200, { ...entry, revisions: journals.revisions(entry.kind, entry.date) });
        } else if (url.pathname === '/api/journal/chat') {
          await ownerSession();
          const payload = await body(request);
          if (typeof payload.message !== 'string' || !payload.message.trim() || payload.message.length > 4000 || !models.some(model => model.slug === payload.model)) fail('invalid_request');
          journals.thread(payload.kind, payload.date);
          const controller = new AbortController(); activeRequest = controller;
          response.on('close', () => controller.abort());
          response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });
          const emit = event => { if (!response.destroyed) response.write(`${JSON.stringify(event)}\n`); };
          try {
            const result = await journalChat({ journals, runtime, kind: payload.kind, date: payload.date, today: payload.today, model: payload.model, message: payload.message.trim(), signal: controller.signal, onProgress: text => emit({ type: 'progress', text }) });
            await onVerified({ completed: true, journal: true, updated: result.updated, at: new Date().toISOString() }).catch(() => {});
            emit({ type: 'completed', saved: true, ...result });
          } catch (error) { const safe = safeError(error); await onFailure({ code: safe.code, stage: 'journal' }).catch(() => {}); emit({ type: 'error', ...safe }); }
          finally { activeRequest = undefined; response.end(); }
        } else if (url.pathname === '/api/connect') {
          await body(request);
          models = [];
          const state = await runtime.signIn();
          if (owner && state.profileId !== owner.profileId) fail('wrong_owner');
          json(200, { connected: state.status === 'connected', sharing: state.sharing });
        } else if (url.pathname === '/api/owner') {
          await body(request);
          if (owner) fail('forbidden');
          const state = await runtime.getSession();
          if (state.status !== 'connected' || !state.profileId) fail('sign_in_required');
          const nextOwner = { profileId: state.profileId };
          await ownerStore.write(nextOwner);
          owner = nextOwner;
          json(200, { ownerConfirmed: true });
        } else if (url.pathname === '/api/models') {
          await body(request);
          await ownerSession();
          models = await runtime.listModels();
          if (!models.length) fail('no_models');
          json(200, { models });
        } else if (url.pathname === '/api/disconnect') {
          await body(request);
          models = [];
          await runtime.disconnect();
          json(200, { disconnected: true });
        } else if (url.pathname === '/api/upload') {
          await ownerSession(false);
          const payload = await body(request, 15 * 1024 * 1024);
          json(200, { saved: true, upload: await saveUpload(store, uploadsDir, payload.lectureId, payload) });
        } else if (['/api/reorder', '/api/save', '/api/undo', '/api/restore', '/api/apply', '/api/reject'].includes(url.pathname)) {
          await ownerSession(false);
          const payload = await body(request);
          const lectureId = payload.lectureId;
          if (url.pathname === '/api/reorder') store.reorder(lectureId, payload.order);
          if (url.pathname === '/api/save') {
            const current = store.lecture(lectureId);
            store.save(lectureId, payload.version, payload.blocks, current.annotations, 'Owner edit');
          }
          if (url.pathname === '/api/undo') store.undo(lectureId, payload.version);
          if (url.pathname === '/api/restore') store.restore(lectureId, payload.version, payload.targetVersion);
          if (url.pathname === '/api/apply') store.applyProposal(lectureId, payload.proposalId);
          if (url.pathname === '/api/reject') store.rejectProposal(lectureId, payload.proposalId);
          json(200, { saved: true });
        } else if (url.pathname === '/api/build') {
          await ownerSession();
          const payload = await body(request);
          if (!models.some(model => model.slug === payload.model)) fail('invalid_request');
          const controller = new AbortController(); activeRequest = controller;
          response.on('close', () => controller.abort());
          response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });
          const emit = event => { if (!response.destroyed) response.write(`${JSON.stringify(event)}\n`); };
          try {
            const result = await buildLecture({ store, runtime, uploadsDir, lectureId: payload.lectureId, model: payload.model, signal: controller.signal, onDelta: text => emit({ type: 'progress', characters: text.length }) });
            await onVerified({ completed: true, draftSaved: true, lectureId: payload.lectureId, sourceCount: result.sourceCount, version: result.lecture.version, at: new Date().toISOString() }).catch(() => {});
            emit({ type: 'completed', saved: true, version: result.lecture.version });
          } catch (error) {
            const safe = safeError(error); await onFailure({ code: safe.code, stage: 'build' }); emit({ type: 'error', ...safe });
          } finally { activeRequest = undefined; response.end(); }
        } else if (url.pathname === '/api/chat') {
          await ownerSession();
          const payload = await body(request);
          if (typeof payload?.message !== 'string' || !payload.message.trim() || payload.message.length > 4000 || !models.some(model => model.slug === payload.model)) fail('invalid_request');
          const lectureId = payload.lectureId ?? 'demo';
          const currentLecture = store.lecture(lectureId);
          store.addMessage(lectureId, 'user', payload.message.trim());
          const controller = new AbortController();
          activeRequest = controller;
          response.on('close', () => controller.abort());
          response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });
          const emit = event => { if (!response.destroyed) response.write(`${JSON.stringify(event)}\n`); };
          let partial = '';
          try {
            const input = await conversationContext(store, runtime, lectureId, payload.message, payload.model, controller.signal);
            const sources = await sourceInputs(store, uploadsDir, lectureId, payload.sourceIds);
            if (sources.length) input.push({ role: 'user', content: [{ type: 'input_text', text: 'Selected source material for the current question:' }, ...sources] });
            const result = await runtime.streamResponse({
              model: payload.model, instructions: `${lectureInstructions(currentLecture)}${lectureId === 'demo' ? `\nSample excerpt: ${instructions}` : ''}`, input,
              signal: controller.signal, onDelta: text => { partial += text; emit({ type: 'delta', text }); },
            });
            if (!result.text.trim()) fail('empty_response');
            const processed = store.transaction(() => {
              const parsed = saveChatProposal(store, currentLecture, result.text);
              store.addMessage(lectureId, 'assistant', parsed.text);
              return parsed;
            });
            await onVerified({ completed: true, nonempty: true, lectureContextIncluded: true, characters: result.text.length, at: new Date().toISOString() }).catch(() => {});
            emit({ type: 'completed', saved: true, text: processed.text, proposalId: processed.proposalId });
          } catch (error) {
            const safe = safeError(error);
            store.addMessage(lectureId, 'assistant', partial || safe.message, 'incomplete');
            await onFailure({ code: safe.code, stage: 'inference' });
            emit({ type: 'error', ...safe });
          } finally {
            activeRequest = undefined;
            response.end();
          }
        } else { json(404, { message: 'Not found.' }); }
      } finally { busy = false; }
    } catch (error) {
      const safe = safeError(error);
      await onFailure({ code: safe.code, stage: 'request' }).catch(() => {});
      if (!response.headersSent) json(['forbidden', 'wrong_owner', 'owner_required'].includes(safe.code) ? 403 : safe.code === 'unauthorized' ? 401 : 400, safe);
      else response.end();
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, origin, launchUrl: `${origin}/#launch=${bootstrap}` };
}
