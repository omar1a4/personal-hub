let selectedSources = new Set();
let sourceLecture = null;

function commandButton(label, icon, action, needsModel = false) {
  const button = makeNode('button', undefined, label ? 'tool-command' : 'icon-button');
  button.type = 'button';
  button.dataset.workControl = '';
  if (needsModel) button.dataset.needsModel = '';
  const symbol = document.createElement('i'); symbol.dataset.lucide = icon;
  button.append(symbol);
  if (label) button.append(document.createTextNode(label));
  button.addEventListener('click', action);
  return button;
}

async function reloadLecture() {
  const response = await hubFetch(`/api/lecture?id=${activeLectureId}`);
  if (!response.ok) throw new Error('The saved lecture could not be reloaded.');
  savedLecture = await response.json();
  renderLectureContent();
  render();
}

async function saveAction(path, payload) {
  await post(path, { lectureId: activeLectureId, ...payload });
  await reloadLecture();
  element('completion-status').textContent = 'Change saved';
}

function fileUrl(file, download = false) {
  return `/api/file/${file.id}?lectureId=${encodeURIComponent(activeLectureId)}${download ? '&download=1' : ''}`;
}

async function consumeStream(response, handler) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n'); buffer = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.type === 'error') throw new Error(event.message);
      if (event.type === 'completed' && event.saved) completed = true;
      handler(event);
    }
    if (done) break;
  }
  if (!completed) throw new Error('The operation ended without a confirmed save.');
}

function renderWorkflow(container, lecture) {
  const toolbar = makeNode('div', undefined, 'lecture-toolbar');
  const input = document.createElement('input');
  input.type = 'file'; input.multiple = true; input.accept = '.jpg,.jpeg,.png,.webp,.pdf';
  input.id = 'source-files'; input.dataset.workControl = ''; input.setAttribute('aria-label', 'Upload whiteboard images and PDFs');
  input.addEventListener('change', () => operation(async () => {
    const files = [...input.files];
    try {
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: exceeds the 10 MB file limit.`);
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('File reading failed.')); reader.readAsDataURL(file);
        });
        const response = await post('/api/upload', { lectureId: activeLectureId, name: file.name, data });
        const result = await response.json(); selectedSources.add(result.upload.id);
        element('completion-status').textContent = `${file.name} saved`;
      }
    } finally { await reloadLecture(); }
  }));
  toolbar.append(input);
  const build = commandButton(lecture.content.length ? 'Rebuild lecture' : 'Build lecture', 'wand-sparkles', () => {
    if (lecture.content.length && !confirm('Build a new local draft from all original files? The current version will remain in history.')) return;
    operation(async () => {
      element('completion-status').textContent = 'Reading sources with ChatGPT...';
      const response = await post('/api/build', { lectureId: activeLectureId, model: element('model').value });
      await consumeStream(response, event => {
        if (event.type === 'progress') element('completion-status').textContent = 'Receiving lecture draft...';
      });
      await reloadLecture();
      element('completion-status').textContent = 'Lecture draft saved';
    });
  }, true);
  build.dataset.requiresSources = ''; toolbar.append(build);
  container.prepend(toolbar);
  container.prepend(makeNode('p', 'Originals stay private. Build lecture sends them to OpenAI using your connected ChatGPT plan.', 'source-consent'));
  container.append(makeNode('p', `Version ${lecture.version} / Local draft`, 'version-label'));
  renderProposals(container, lecture);
  renderEditor(container, lecture);
  renderHistory(container, lecture);
  renderSources(container, lecture);
}

function renderSources(container, lecture) {
  if (sourceLecture !== lecture.id) { selectedSources = new Set(lecture.uploads.map(file => file.id)); sourceLecture = lecture.id; }
  const section = makeNode('section', undefined, 'sources');
  section.append(makeNode('h3', `Original sources (${lecture.uploads.length})`), makeNode('p', 'JPEG, PNG, WebP, PDF. 10 MB/file; 40 MB/lecture. Checked files accompany the next chat request.', 'source-consent'));
  const list = makeNode('ol', undefined, 'source-list');
  lecture.uploads.forEach((file, index) => {
    const item = makeNode('li', undefined, 'source-item');
    const preview = makeNode('a'); preview.href = fileUrl(file); preview.target = '_blank'; preview.rel = 'noreferrer';
    if (file.mime.startsWith('image/')) {
      const image = document.createElement('img'); image.src = fileUrl(file); image.alt = `Source ${index + 1}: ${file.name}`; image.loading = 'lazy'; preview.append(image);
    } else { const icon = document.createElement('i'); icon.dataset.lucide = 'file-text'; preview.append(icon, makeNode('span', `${file.pages} PDF pages`)); }
    const information = makeNode('div', undefined, 'source-information');
    const label = makeNode('label'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selectedSources.has(file.id); checkbox.dataset.source = file.id; checkbox.dataset.workControl = '';
    checkbox.addEventListener('change', () => checkbox.checked ? selectedSources.add(file.id) : selectedSources.delete(file.id));
    label.append(checkbox, document.createTextNode(`${index + 1}. ${file.name}`));
    const original = makeNode('a', 'Download original'); original.href = fileUrl(file, true); original.target = '_blank'; original.rel = 'noreferrer';
    information.append(label, original);
    if (file.captured_at) information.append(makeNode('small', `Captured ${new Date(file.captured_at).toLocaleString()}`));
    const controls = makeNode('div', undefined, 'source-order');
    for (const [offset, icon, title] of [[-1, 'arrow-up', 'Move source earlier'], [1, 'arrow-down', 'Move source later']]) {
      const button = commandButton('', icon, () => operation(async () => {
        const order = lecture.uploads.map(source => source.id);
        [order[index], order[index + offset]] = [order[index + offset], order[index]];
        await saveAction('/api/reorder', { order });
      }));
      button.title = title; button.setAttribute('aria-label', title);
      if (index + offset < 0 || index + offset >= lecture.uploads.length) button.dataset.unavailable = '';
      controls.append(button);
    }
    item.append(preview, information, controls); list.append(item);
  });
  section.append(list); container.append(section);
}

function renderEditor(container, lecture) {
  const details = makeNode('details', undefined, 'editor'); details.append(makeNode('summary', 'Edit draft'));
  const blocks = structuredClone(lecture.content);
  const fields = makeNode('div');
  function redraw() {
    fields.replaceChildren();
    blocks.forEach((block, index) => {
      const field = makeNode('section', undefined, 'block-editor');
      const label = makeNode('label', `Block ${index + 1} / ${block.id}`);
      const kind = document.createElement('select'); kind.setAttribute('aria-label', `Block ${index + 1} type`); kind.dataset.workControl = '';
      for (const type of ['heading', 'paragraph', 'proof', 'example', 'equation', 'uncertainty']) kind.add(new Option(type, type));
      kind.value = block.kind; kind.addEventListener('change', () => { block.kind = kind.value; });
      const text = document.createElement('textarea'); text.dir = 'auto'; text.value = block.text; text.rows = 5; text.dataset.workControl = ''; text.setAttribute('aria-label', `Block ${index + 1} text`); text.addEventListener('input', () => { block.text = text.value; });
      const remove = commandButton('Remove block', 'trash-2', () => { blocks.splice(index, 1); redraw(); render(); });
      field.append(label, kind, text, remove); fields.append(field);
    });
    lucide.createIcons();
  }
  redraw();
  details.append(fields, commandButton('Add block', 'plus', () => { blocks.push({ id: crypto.randomUUID(), kind: 'paragraph', text: '', sources: [] }); redraw(); render(); }), commandButton('Save draft', 'save', () => operation(() => saveAction('/api/save', { version: lecture.version, blocks }))));
  container.append(details);
}

function renderHistory(container, lecture) {
  const details = makeNode('details', undefined, 'version-history'); details.append(makeNode('summary', 'Version history & undo'));
  details.append(commandButton('Undo last edit', 'undo-2', () => operation(() => saveAction('/api/undo', { version: lecture.version }))));
  for (const version of lecture.revisions) {
    const row = makeNode('div', undefined, 'history-row');
    row.append(makeNode('span', `v${version.version} / ${version.reason} / ${version.created_at}`));
    if (version.version !== lecture.version) row.append(commandButton('Restore', 'rotate-ccw', () => {
      if (confirm(`Restore version ${version.version} as a new revision?`)) operation(() => saveAction('/api/restore', { version: lecture.version, targetVersion: version.version }));
    }));
    details.append(row);
  }
  container.append(details);
}

function renderProposals(container, lecture) {
  for (const proposal of lecture.proposals) {
    const review = makeNode('section', undefined, 'proposal-review');
    review.append(makeNode('h3', 'Review proposed change'), makeNode('p', proposal.payload.summary));
    const comparison = makeNode('details'); comparison.open = true; comparison.append(makeNode('summary', 'Before / proposed result'));
    const before = makeNode('div', undefined, 'proposal-before'); const after = makeNode('div', undefined, 'proposal-after');
    if (proposal.payload.annotation) {
      before.textContent = lecture.content.find(block => block.id === proposal.payload.annotation.targetId)?.text ?? 'Statement no longer exists';
      after.innerHTML = renderRich(proposal.payload.annotation.text);
    } else {
      before.textContent = lecture.content.map(block => block.text).join('\n\n');
      after.innerHTML = renderRich(proposal.payload.blocks.map(block => block.text).join('\n\n'));
    }
    comparison.append(makeNode('h4', 'Current'), before, makeNode('h4', 'Proposed'), after);
    review.append(comparison, commandButton('Apply to local draft', 'check', () => operation(() => saveAction('/api/apply', { proposalId: proposal.id }))), commandButton('Reject', 'x', () => operation(() => saveAction('/api/reject', { proposalId: proposal.id }))));
    if (proposal.base_version !== lecture.version) review.append(makeNode('p', 'This proposal is based on an older version. Request an updated proposal.', 'source-consent'));
    container.append(review);
  }
}