let state;
let working = false;
let csrf = '';

lucide.createIcons();
element('stop').type = 'button';

function notice(message = '') {
  element('notice').textContent = message;
  element('notice').hidden = !message;
}

async function post(path, payload = {}) {
  const response = await hubFetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message ?? 'The request could not be completed.');
  }
  return response;
}

function render() {
  if (!state) return;
  const connected = state.status === 'connected';
  const canChat = !HUB_DEMO && connected && state.ownerConfirmed && state.sharing && state.models.length > 0;
  element('status').textContent = working ? 'Operation in progress...' : connected ? state.ownerConfirmed ? 'Owner connected' : 'Connected / owner confirmation required' : state.status === 'reauth_required' ? 'Reconnect required' : 'Not connected';
  element('account').textContent = state.account ?? '';
  element('connect').disabled = working || !csrf;
  element('connect').hidden = connected && state.sharing;
  element('confirm-owner').hidden = !state.canConfirmOwner;
  element('confirm-owner').disabled = working;
  element('disconnect').hidden = !connected;
  element('disconnect').disabled = working;
  element('plan').hidden = !state.sharing;
  element('refresh-models').disabled = working || !state.ownerConfirmed || !state.sharing;
  element('question').disabled = working || !canChat;
  element('send').disabled = working || !canChat;
  element('model').disabled = working || !canChat;
  element('stop').hidden = !working;
  element('export-journals').disabled = !state.ownerConfirmed || working;
  const previous = element('model').value;
  element('model').replaceChildren();
  for (const model of state.models) element('model').add(new Option(model.displayName, model.slug));
  if (!state.models.length) element('model').add(new Option('No connected model', ''));
  if (state.models.some(model => model.slug === previous)) element('model').value = previous;
  document.querySelectorAll('[data-work-control]').forEach(control => {
    control.disabled = working || !state.ownerConfirmed || control.hasAttribute('data-unavailable') || (control.hasAttribute('data-needs-model') && !canChat) || (control.hasAttribute('data-requires-sources') && !savedLecture?.uploads.length);
  });
}

async function refresh() {
  const response = await hubFetch('/api/state');
  if (!response.ok) {
    const result = await response.json();
    element('status').textContent = 'Local session required';
    throw new Error(result.message);
  }
  state = await response.json();
  csrf = state.csrf;
  render();
  if (state.error) notice(state.error.message);
}

async function operation(action) {
  if (working) return;
  working = true;
  notice();
  render();
  try { await action(); }
  catch (error) { notice(error.code === 'invalid_journal' ? 'Check your entry: use positive whole minutes, ratings from 1 to 5, and no more than 24 hours in a day.' : error.message || 'The operation failed.'); }
  finally {
    working = false;
    await refresh().catch(error => notice(error.message));
  }
}

element('connect').addEventListener('click', () => operation(async () => {
  await post('/api/connect');
  await refresh();
  if (state.ownerConfirmed && state.sharing) await post('/api/models');
  if (!state.sharing) notice('Connected identity, but ChatGPT plan usage was not granted.');
  await navigate();
}));
element('confirm-owner').addEventListener('click', () => operation(async () => {
  await post('/api/owner');
  await refresh();
  if (state.sharing) await post('/api/models');
  await navigate();
}));
element('refresh-models').addEventListener('click', () => operation(() => post('/api/models')));
element('disconnect').addEventListener('click', () => operation(async () => {
  await post('/api/disconnect');
  await refresh();
  journalDirty = false;
  await navigate();
  element('messages').replaceChildren();
  element('completion-status').textContent = 'Disconnected';
}));
element('stop').addEventListener('click', () => post('/api/stop').catch(error => notice(error.message)));
element('minimize-chat').addEventListener('click', () => {
  element('conversation-panel').hidden = !element('conversation-panel').hidden;
  element('minimize-chat').setAttribute('aria-expanded', String(!element('conversation-panel').hidden));
});

function addMessage(role, text) {
  element('empty-state')?.remove();
  const section = document.createElement('section');
  section.className = 'message';
  section.dataset.role = role;
  const heading = document.createElement('h3');
  heading.textContent = role === 'user' ? 'You' : 'Assistant / streaming';
  const paragraph = document.createElement('div');
  paragraph.className = 'message-body';
  paragraph.dir = 'auto';
  paragraph.textContent = text;
  section.append(heading, paragraph);
  element('messages').querySelector('.assistant-welcome')?.remove();
  element('messages').append(section);
  return { section, heading, paragraph };
}

element('chat-form').addEventListener('submit', event => {
  event.preventDefault();
  const message = element('question').value.trim();
  const model = element('model').value;
  if (!message || working) return;
  if (journalDirty) { notice('Save or discard your entry edits before sending a message.'); return; }
  operation(async () => {
    addMessage('user', message);
    const output = addMessage('assistant', '');
    element('completion-status').textContent = 'Waiting for completed inference...';
    let completed = false;
    let streamError = '';
    try {
      const response = activeLectureId
        ? await post('/api/chat', { message, model, lectureId: activeLectureId, sourceIds: [...selectedSources] })
        : await post('/api/journal/chat', { message, model, ...(activeJournal ?? {kind:'home'}), today:today() });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line) continue;
          const item = JSON.parse(line);
          if (item.type === 'progress') output.paragraph.textContent = item.text;
          if (item.type === 'delta') output.paragraph.textContent += item.text;
          if (item.type === 'completed' && item.saved) { completed = true; output.paragraph.textContent = item.text; addSources(output.section, item.sources); if (item.updated) element('completion-status').textContent = 'Daily entry updated and saved'; }
          if (item.type === 'error') streamError = item.message;
        }
        element('messages').scrollTop = element('messages').scrollHeight;
        if (done) break;
      }
      if (!completed) throw new Error(streamError || 'The stream ended without a completed response.');
      output.heading.textContent = 'Assistant / completed';
      output.paragraph.innerHTML = renderRich(output.paragraph.textContent);
      element('completion-status').textContent = 'Response completed and saved';
      element('question').value = '';
      if (activeLectureId) await reloadLecture(); else await reloadJournal();
    } catch (error) {
      output.heading.textContent = 'Assistant / not completed';
      output.section.classList.add('failed');
      element('completion-status').textContent = 'No completed response for this request';
      throw error;
    }
  });
});

async function initialize() {
  globalThis.JournalModel = await import(HUB_DEMO ? './journal-model.mjs' : '/journal-model.mjs');
  element('header-date').textContent = niceDate(today(), {weekday:'long',month:'long',day:'numeric',year:'numeric'});
  if (HUB_DEMO) {
    element('demo-banner').hidden = false;
    element('environment-label').textContent = 'Interactive demo';
    element('privacy-label').textContent = 'Fictional demo data';
    element('reset-demo').onclick = () => { if (confirm('Reset this browser demo? Any edits here will be removed.')) { localStorage.removeItem(DEMO_KEY); journalDirty=false; navigate(); } };
  }
  const token = new URLSearchParams(location.hash.slice(1)).get('launch');
  if (token && !HUB_DEMO) history.replaceState(null, '', location.pathname);
  if (token && !HUB_DEMO) await post('/api/bootstrap', { token });
  await refresh().catch(error => notice(error.message));
  if (!state) state = { status: 'disconnected', ownerConfirmed: false, models: [] };
  if (state.ownerConfirmed && state.sharing && !state.models.length) await operation(() => post('/api/models'));
  await navigate();
  if (state.ownerConfirmed) element('connection-details').open = false;
}
initialize().catch(error => notice(error.message));