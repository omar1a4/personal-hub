let catalog;
let activeLectureId = null;
let savedLecture = null;
let displayedRoute = null;

function makeNode(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function routeLink(title, href, icon = 'chevron-right', detail = '') {
  const link = makeNode('a', undefined, 'navigation-item');
  link.href = href;
  link.dataset.route = '';
  const symbol = document.createElement('i');
  symbol.dataset.lucide = icon;
  const label = makeNode('span', title);
  if (detail) label.append(makeNode('small', detail));
  link.append(symbol, label);
  return link;
}

async function loadConversation() {
  element('messages').replaceChildren();
  if (HUB_DEMO || !state?.ownerConfirmed || !activeLectureId) return;
  const response = await hubFetch(`/api/messages?lectureId=${encodeURIComponent(activeLectureId)}`);
  if (!response.ok) throw new Error('The saved conversation could not be restored.');
  const saved = await response.json();
  for (const message of saved.messages) {
    const output = addMessage(message.role, message.content);
    output.paragraph.innerHTML = renderRich(message.content);
    output.heading.textContent = message.role === 'user' ? 'You' : `Assistant / ${message.status}`;
    if (message.status !== 'completed') output.section.classList.add('failed');
  }
  element('context-status').textContent = saved.summarized ? 'Context: saved summary + recent messages + related earlier excerpts. Full history retained.' : 'Context: saved lecture + conversation history';
}

function renderLectureContent() {
  const container = element('page-content');
  container.replaceChildren();
  if (!savedLecture) { container.append(makeNode('p', HUB_DEMO ? 'Course drafts and uploads are available in the local app. This demo focuses on your daily journals.' : 'Connect as owner to open this private lecture draft.')); return; }
  container.append(makeNode('p', activeLectureId === 'demo' ? 'Separate sample demo' : 'Private draft / not published', 'section-label'));
  if (!savedLecture.content.length) {
    const empty = makeNode('section', undefined, 'empty-lecture');
    const icon = document.createElement('i'); icon.dataset.lucide = 'images';
    empty.append(icon, makeNode('h2', 'Your lecture starts here'), makeNode('p', 'Add your whiteboard photos and supporting PDFs. We will build this lecture from your material.'));
    container.append(empty);
  }
  const material = makeNode('div', undefined, 'lecture-material');
  for (const block of savedLecture.content) {
    const section = makeNode('section', undefined, 'lecture-block');
    section.id = `statement-${block.id}`;
    section.dir = 'auto';
    section.dataset.kind = block.kind;
    const text = block.kind === 'equation' && !block.text.includes('$$') ? `$$\n${block.text}\n$$` : block.text;
    const content = makeNode(block.kind === 'heading' ? 'h2' : 'div'); content.innerHTML = renderRich(text); section.append(content);
    if (block.kind === 'uncertainty') section.prepend(makeNode('strong', 'Needs clarification', 'uncertainty-label'));
    for (const source of block.sources ?? []) {
      const file = savedLecture.uploads.find(upload => upload.id === source.uploadId);
      if (!file) continue;
      const link = makeNode('a', `${file.name} / page ${source.page}`, 'source-reference');
      link.href = `${fileUrl(file)}#page=${source.page}`; link.target = '_blank'; link.rel = 'noreferrer'; section.append(link);
    }
    const ask = makeNode('button', 'Ask about this', 'statement-ask'); ask.type = 'button';
    ask.addEventListener('click', () => { element('question').value = `About statement ${block.id}: `; element('conversation-panel').hidden = false; element('question').focus(); });
    section.append(ask);
    for (const annotation of savedLecture.annotations.filter(item => item.targetId === block.id)) {
      const details = makeNode('details', undefined, 'breakthrough');
      const summary = makeNode('summary', '\u{1f4a1} Breakthrough'); summary.title = 'Expand or collapse this explanation';
      const explanation = makeNode('div'); explanation.dir = 'auto'; explanation.innerHTML = renderRich(annotation.text);
      details.append(summary, explanation); section.append(details);
    }
    material.append(section);
  }
  container.append(material);
  if (typeof renderWorkflow === 'function') renderWorkflow(container, savedLecture);
  lucide.createIcons();
}

async function navigate() {
  if (!catalog) catalog = await (await hubFetch('/api/catalog')).json();
  const path = routeURL().pathname;
  activeLectureId = path.startsWith('/lecture/') ? path.split('/')[2] : null;
  activeJournal = null;
  selectedSources.clear();
  const container = element('page-content');
  container.replaceChildren();
  const breadcrumbs = element('breadcrumbs');
  breadcrumbs.replaceChildren(routeLink('Home', '/', 'house'));
  savedLecture = null;
  document.querySelectorAll('[data-nav]').forEach(link => link.setAttribute('aria-current', link.dataset.nav === (path.startsWith('/education') || activeLectureId ? 'education' : path === '/habits-sleep' ? 'sleep' : 'home') ? 'page' : 'false'));
  element('page-subtitle').textContent = '';
  if (path === '/' || path === '/education' || path === '/education/daily' || path === '/habits-sleep') {
    await renderJournalRoute(path);
  } else if (activeLectureId) {
    breadcrumbs.append(routeLink('Education', '/education', 'book-open'));
    const info = catalog.lectures.find(item => item.id === activeLectureId);
    if (!info) throw new Error('Lecture not found.');
    const course = catalog.courses.find(item => item.id === info.course);
    if (course) breadcrumbs.append(routeLink(course.title, `/education/courses/${course.id}`));
    element('page-title').textContent = info.title;
    if (state?.ownerConfirmed && !HUB_DEMO) {
      const response = await hubFetch(`/api/lecture?id=${activeLectureId}`);
      if (!response.ok) throw new Error('The saved lecture could not be opened.');
      savedLecture = await response.json();
    }
    renderLectureContent();
  } else if (path === '/education/courses') {
    element('page-title').textContent = 'Courses';
    element('page-subtitle').textContent = 'Your existing course workspace. Development is paused while we build the daily journals.';
    for (const course of catalog.courses) container.append(routeLink(course.title, `/education/courses/${course.id}`, course.icon));
  } else {
    const course = catalog.courses.find(item => item.id === path.split('/').at(-1));
    if (!course) throw new Error('Page not found.');
    element('page-title').textContent = course.title;
    breadcrumbs.append(routeLink('Courses', '/education/courses'));
    const lectures = catalog.lectures.filter(item => item.course === course.id);
    const list = makeNode('div', undefined, 'lecture-list');
    for (const lecture of lectures) list.append(routeLink(lecture.title, `/lecture/${lecture.id}`, 'file-text'));
    if (!lectures.length) list.append(makeNode('p', 'No lectures yet.'));
    container.append(list);
  }
  element('conversation-panel').hidden = false;
  element('minimize-chat').setAttribute('aria-expanded', 'true');
  configureAssistant();
  if (activeLectureId) await loadConversation(); else await loadJournalConversation();
  displayedRoute = routeURL().pathname + routeURL().search;
  document.title = `${element('page-title').textContent} · Personal Hub`;
  render();
  refreshIcons();
  document.querySelectorAll('a[data-route]').forEach(link => { if (HUB_DEMO && !link.hash.startsWith('#/')) link.setAttribute('href', `#${link.getAttribute('href')}`); });
}

function routeURL() { return new URL(HUB_DEMO ? location.hash.slice(1) || '/' : location.pathname + location.search, location.origin); }
function navigateTo(path) {
  if (working) { notice('Finish or stop the current request before changing pages.'); return; }
  if (journalDirty && !confirm('Leave without saving your journal edits?')) return;
  journalDirty = false;
  if (HUB_DEMO) history.pushState(null, '', `#${path}`); else history.pushState(null, '', path);
  navigate().catch(error => notice(error.message));
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-route]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigateTo(HUB_DEMO && link.hash.startsWith('#/') ? link.hash.slice(1) : link.pathname + link.search);
});
addEventListener('popstate', () => {
  if (working || (journalDirty && !confirm('Leave without saving your journal edits?'))) {
    if (displayedRoute) history.pushState(null, '', HUB_DEMO ? `#${displayedRoute}` : displayedRoute);
    if (working) notice('Finish or stop the current request before changing pages.');
    return;
  }
  journalDirty = false; navigate().catch(error => notice(error.message));
});
addEventListener('beforeunload', event => { if (journalDirty) { event.preventDefault(); event.returnValue = ''; } });
