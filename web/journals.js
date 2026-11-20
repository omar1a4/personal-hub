let activeJournal = null;
let journalEntry = null;
let journalDirty = false;
let journalOverview = { entries: [], stats: { entries: 0, totalMinutes: 0, averageSleep: null, studyDays: 0, sleepDays: 0, courses: [] } };
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };
const shiftDate = (day, amount) => { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate()+amount); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };
const niceDate = (date, options = { month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat(undefined, options).format(new Date(`${date}T12:00:00`));
const duration = minutes => `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
const refreshIcons = () => globalThis.lucide?.createIcons();
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const href = path => HUB_DEMO ? `#${path}` : path;
function button(text, action, cls = '') { const node = makeNode('button', text, cls); node.type = 'button'; node.addEventListener('click', action); return node; }
async function getJSON(path) { const response = await hubFetch(path); const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Could not open the saved data.'); return result; }
function linkedEntry(entry) {
  const link = makeNode('a', undefined, `entry-card ${entry.kind}`); link.href = href(JournalModel.entryPath(entry)); link.dataset.route = '';
  const doc = entry.document, study = entry.kind === 'study';
  link.innerHTML = `<div class="entry-top"><span class="kind-label">${icon(study ? 'book-open' : 'moon')} ${study ? 'STUDY REPORT' : 'SLEEP & DREAMS'}</span><time datetime="${entry.date}">${html(niceDate(entry.date))}</time></div><h3>${html(doc.title)}</h3><p>${html((doc.body || doc.dreams || 'A moment recorded.').slice(0, 150))}${(doc.body || doc.dreams || '').length > 150 ? '…' : ''}</p><div class="entry-meta"><span>${study ? duration(JournalModel.studyMinutes(doc)) + ' studied' : doc.hours !== null ? `${doc.hours}h sleep` : 'Sleep duration not recorded'}</span><span>${doc.tags.slice(0, 2).map(tag => `#${html(tag)}`).join(' ')}</span></div>`;
  return link;
}
function renderEntryList(container, entries, empty = 'No entries yet. Start with a few words about today.') {
  container.replaceChildren();
  if (!entries.length) { container.append(makeNode('p', empty, 'empty-copy')); return; }
  for (const entry of entries) container.append(linkedEntry(entry));
  refreshIcons();
}
function drawWeek(entries) {
  const days = Array.from({length: 7}, (_, i) => shiftDate(today(), i - 6));
  const values = days.map(day => entries.filter(e => e.date === day && e.kind === 'study').reduce((sum, e) => sum + JournalModel.studyMinutes(e.document), 0));
  const max = Math.max(60, ...values);
  return `<div class="week-chart" role="img" aria-label="Study time in the last seven days: ${html(days.map((day,i) => `${niceDate(day)} ${duration(values[i])}`).join(', '))}">${days.map((day, i) => `<div class="week-day"><span class="bar-value">${values[i] ? `${Math.round(values[i]/6)/10}h` : '—'}</span><div class="bar-track"><span class="bar-fill ${i === 6 ? 'current' : ''}" style="height:${values[i]/max*100}%"></span></div><span>${html(niceDate(day, {weekday:'short'}))}</span></div>`).join('')}</div>`;
}
async function loadOverview() {
  journalOverview = state?.ownerConfirmed ? await getJSON('/api/journal/overview') : { entries: [], stats: JournalModel.journalStats([]) };
}
async function renderJournalRoute(path) {
  await loadOverview();
  const container = element('page-content'), sleep = path === '/habits-sleep';
  if (path === '/' || path === '/education') {
    const education = path === '/education';
    element('page-title').textContent = education ? 'A little learning, every day.' : 'Your days, connected.';
    element('page-subtitle').textContent = education ? 'Track your effort. Reflect on what helped. Find your rhythm.' : 'A place for what you learned, how you rested, and what stayed with you.';
    const weekEntries = JournalModel.filterEntries(journalOverview.entries, { from: shiftDate(today(), -6), to: today() });
    const stats = JournalModel.journalStats(weekEntries);
    container.innerHTML = `<div class="week-heading"><span class="section-label">THE LAST 7 DAYS</span><span class="quiet">${html(niceDate(shiftDate(today(), -6)))} – ${html(niceDate(today()))}</span></div><div class="stats-grid"><div class="stat"><span>${icon('book-open')} Study time</span><strong>${duration(stats.totalMinutes)}</strong><small>${stats.studyDays} ${stats.studyDays === 1 ? 'report' : 'reports'} recorded</small></div><div class="stat"><span>${icon('moon')} Average sleep</span><strong>${stats.averageSleep === null ? '—' : `${stats.averageSleep}<em>h</em>`}</strong><small>${stats.sleepSamples} ${stats.sleepSamples === 1 ? 'night' : 'nights'} with a duration</small></div><div class="stat"><span>${icon('notebook-pen')} Reflections</span><strong>${stats.entries}</strong><small>Small moments, saved</small></div></div>
      <div class="section-header"><h2>${education ? 'Your education space' : 'Make space for today'}</h2><span class="quiet">${html(niceDate(today(), {weekday:'long'}))}</span></div><div class="space-grid"><a class="space-card study-space" href="${href('/education/daily')}" data-route><span class="space-icon">${icon('notebook-pen')}</span><h3>Daily study report</h3><p>What did you work on?<br>How did it feel?</p><span class="text-action">Reflect on your learning ${icon('plus')}</span></a><a class="space-card sleep-space" href="${href(education ? '/education/courses' : '/habits-sleep')}" data-route><span class="space-icon">${icon(education ? 'library-big' : 'moon-star')}</span><h3>${education ? 'Your courses' : 'Sleep, dreams & habits'}</h3><p>${education ? 'Algorithms, Operating Systems<br>and AI Course.' : 'Capture the morning fragments.<br>Come back as you remember.'}</p><span class="text-action">${education ? 'Open course workspace' : 'Check in with yourself'} ${icon(education ? 'book-open' : 'plus')}</span></a></div>
      <section class="week-panel"><div class="section-header"><h2>Your study rhythm</h2><span class="quiet">Hours, not expectations</span></div>${drawWeek(weekEntries)}</section>
      <section class="journal-browser"><div class="section-header"><h2>${education ? 'Study reports' : 'Your journal'}</h2><span class="quiet">${journalOverview.entries.filter(e => !education || e.kind === 'study').length} saved</span></div><form id="journal-search" class="journal-filters"><label class="search-box">${icon('search')}<input id="journal-query" type="search" placeholder="Search ${education ? 'study reports' : 'all entries'}…" aria-label="Search journal entries" maxlength="200"></label><select id="journal-kind" aria-label="Journal type"><option value="${education ? 'study' : ''}">${education ? 'Study reports' : 'All journals'}</option>${education ? '' : '<option value="study">Study</option><option value="sleep">Sleep & dreams</option>'}</select><button type="submit" class="button">Search</button><div class="date-filters"><label>From <input id="filter-from" type="date"></label><label>To <input id="filter-to" type="date"></label></div></form><div id="entry-list" class="entry-list"></div></section>`;
    const show = () => {
      try { renderEntryList(element('entry-list'), JournalModel.searchEntries(journalOverview.entries, element('journal-query').value, { kind: element('journal-kind').value || undefined, from: element('filter-from').value || undefined, to: element('filter-to').value || undefined }, 60), 'No matching entries. Try a different word or date range.'); }
      catch { notice('Choose a valid date range, with the start before the end.'); }
    };
    renderEntryList(element('entry-list'), journalOverview.entries.filter(e => !education || e.kind === 'study').slice(0, 12));
    element('journal-search').addEventListener('submit', e => { e.preventDefault(); show(); });
    element('journal-kind').addEventListener('change', show);
    if (!state?.ownerConfirmed) container.prepend(makeNode('p', 'Connect your owner account in the assistant panel to open your private journals.', 'inline-note'));
    return;
  }
  let date = routeURL().searchParams.get('date') || today();
  if (!JournalModel.validDate(date)) throw new Error('Choose a valid journal date.');
  activeJournal = { kind: sleep ? 'sleep' : 'study', date };
  element('page-title').textContent = sleep ? 'Sleep, dreams & habits' : 'Daily study report';
  element('page-subtitle').textContent = sleep ? 'Start with what you remember. The rest can come later.' : 'Give your effort a little perspective.';
  element('breadcrumbs').append(routeLink(sleep ? 'Habits & sleep' : 'Education', sleep ? '/habits-sleep' : '/education', sleep ? 'moon' : 'book-open'));
  journalEntry = state?.ownerConfirmed ? await getJSON(`/api/journal/entry?kind=${activeJournal.kind}&date=${date}`) : { ...JournalModel.blankEntry(activeJournal.kind, date), revisions: [] };
  renderDailyPage();
}
function renderDailyPage() {
  const { kind, date } = activeJournal, d = journalEntry.document, sleep = kind === 'sleep';
  const container = element('page-content');
  container.innerHTML = `<div class="day-toolbar"><button id="previous-day" class="icon-button" aria-label="Previous day">${icon('chevron-left')}</button><label class="day-label"><span>${html(niceDate(date, { weekday:'long', month:'long', day:'numeric', year:'numeric' }))}</span><input type="date" id="journal-date" aria-label="Journal date" value="${date}"></label><button id="next-day" class="icon-button" aria-label="Next day">${icon('chevron-right')}</button><button id="jump-today" class="button">Today</button></div>
    <div class="entry-status"><span>${icon(HUB_DEMO ? 'flask-conical' : 'lock-keyhole')} ${HUB_DEMO ? 'Browser demo entry' : 'Private daily entry'}</span><span id="save-status" role="status">${journalEntry.version ? `Saved · version ${journalEntry.version}` : 'Ready for your first words'}</span></div>
    <div id="journal-reading"></div>
    <div class="entry-actions"><button id="toggle-editor" class="button">${icon('pencil')} ${journalEntry.version ? 'Edit entry' : 'Write an entry'}</button><button id="focus-assistant" class="button">${icon(HUB_DEMO ? 'search' : 'sparkles')} ${HUB_DEMO ? 'Search journals' : 'Talk to your assistant'}</button></div>
    <form id="entry-editor" class="entry-editor" ${journalEntry.version ? 'hidden' : ''}><div class="section-header"><h2>Your words, your record</h2><span class="quiet">${HUB_DEMO ? 'Saved in this browser' : 'Saved on your computer'}</span></div><label>Title<input id="entry-title" maxlength="140" required value="${html(d.title)}" data-work-control></label>
    ${sleep ? `<div class="field-pair"><label>Went to bed<input id="bedtime" type="time" value="${html(d.bedtime)}" data-work-control></label><label>Woke up<input id="wake-time" type="time" value="${html(d.wakeTime)}" data-work-control></label></div><div class="field-pair"><label>Hours slept<input id="sleep-hours" type="number" min="0" max="24" step="0.1" placeholder="Leave blank if unsure" value="${d.hours ?? ''}" data-work-control></label><label>Sleep quality<select id="sleep-quality" data-work-control>${ratingOptions(d.quality)}</select></label></div><label>What do you remember from your dreams?<textarea id="dreams" rows="5" maxlength="20000" placeholder="Images, places, feelings, fragments…" dir="auto" data-work-control>${html(d.dreams)}</textarea></label><label>Habits & routines<textarea id="habits" rows="3" maxlength="10000" placeholder="Anything you noticed before bed or after waking?" dir="auto" data-work-control>${html(d.habits)}</textarea></label>` : `<fieldset class="study-sessions"><legend>Time spent studying</legend><div id="study-sessions"></div><button id="add-session" type="button" class="text-button" data-work-control>${icon('plus')} Add a course</button><p id="session-total" class="quiet"></p><datalist id="course-options"><option value="Algorithms"><option value="Operating Systems"><option value="AI Course"></datalist></fieldset><label>How satisfied are you with your effort?<select id="satisfaction" data-work-control>${ratingOptions(d.satisfaction)}</select></label>`}
    <label>${sleep ? 'Your reflection' : 'Your daily reflection'}<textarea id="entry-body" rows="5" maxlength="20000" placeholder="${sleep ? 'How did you feel on waking?' : 'What helped you focus? What got in the way?'}" dir="auto" data-work-control>${html(d.body)}</textarea></label><label>Tags <span class="quiet">(separate with commas)</span><input id="entry-tags" maxlength="750" placeholder="${sleep ? 'forest, vivid, evening walk' : 'focus, revision, small wins'}" value="${html(d.tags.join(', '))}" data-work-control></label><div class="editor-actions"><button type="submit" class="primary" data-work-control>${icon('check')} Save entry</button><button id="cancel-edit" type="button" class="button" data-work-control>Discard edits</button></div></form>
    <details class="revision-panel"><summary>${icon('history')} Entry history <span>${journalEntry.revisions?.length ?? 0} versions</span></summary><div id="entry-revisions"></div></details>
    <section class="earlier-entries"><div class="section-header"><h2>Other days</h2><span class="quiet">Return whenever you like</span></div><div id="other-days" class="entry-list"></div></section>`;
  const reading = element('journal-reading');
  if (journalEntry.version) {
    reading.innerHTML = `<h2 class="journal-title">${html(d.title)}</h2><div class="daily-metrics">${sleep ? `<span>${icon('moon')} ${d.hours === null ? 'Duration unrecorded' : `${d.hours} hours slept`}</span><span>${d.quality === null ? 'Quality unrecorded' : `Quality ${d.quality}/5`}</span>` : `<span>${icon('clock')} ${duration(JournalModel.studyMinutes(d))} studied</span><span>${d.satisfaction === null ? 'Satisfaction unrecorded' : `Satisfaction ${d.satisfaction}/5`}</span>`}</div>`;
    if (!sleep && d.sessions.length) {
      const breakdown = makeNode('div', undefined, 'course-breakdown');
      const total = JournalModel.studyMinutes(d);
      for (const s of d.sessions) {
        const row = makeNode('div', undefined, 'course-time');
        row.innerHTML = `<span>${html(s.course)}</span><strong>${duration(s.minutes)}</strong><div class="time-track"><span style="width:${total ? s.minutes/total*100 : 0}%"></span></div>`;
        breakdown.append(row);
      }
      reading.append(breakdown);
    }
    const prose = (label, text) => { if (!text) return; const section = makeNode('section', undefined, 'journal-prose'); if (label) section.append(makeNode('h3', label)); const body = makeNode('div'); body.dir='auto'; body.innerHTML=renderRich(text); section.append(body); reading.append(section); };
    prose('', d.body); if (sleep) { prose('Dream fragments', d.dreams); prose('Habits & routines', d.habits); }
    const tags = makeNode('div', undefined, 'tags'); for (const tag of d.tags) tags.append(makeNode('span', `#${tag}`)); reading.append(tags);
  } else {
    reading.innerHTML = `<div class="daily-empty"><span class="space-icon">${icon(sleep ? 'moon-star' : 'notebook-pen')}</span><h2>${sleep ? 'Every fragment is a beginning.' : 'What did today look like?'}</h2><p>${sleep ? (HUB_DEMO ? 'Start writing below. You can add another memory to this same day later.' : 'Tell your assistant about your night, or start writing below. You can add another memory to this day later.') : (HUB_DEMO ? 'Write what you studied and how it felt. This report will stay in this browser for you to revisit.' : 'Tell your assistant what you studied and how it felt. Or write your own report below.')}</p></div>`;
  }
  if (!sleep) {
    for (const session of d.sessions.length ? d.sessions : [{ course:'Algorithms', minutes:'' }]) addSessionRow(session);
    element('add-session').onclick = () => { addSessionRow({ course:'', minutes:'' }); setDirty(); render(); };
  }
  element('previous-day').onclick = () => changeDay(shiftDate(date, -1));
  element('next-day').onclick = () => changeDay(shiftDate(date, 1));
  element('jump-today').onclick = () => changeDay(today());
  element('journal-date').onchange = e => changeDay(e.target.value);
  element('toggle-editor').onclick = () => { element('entry-editor').hidden = !element('entry-editor').hidden; if (!element('entry-editor').hidden) element('entry-title').focus(); };
  element('focus-assistant').onclick = () => { element('conversation-panel').hidden = false; const target = element(HUB_DEMO ? 'demo-query' : 'question'); target.scrollIntoView({behavior:'smooth',block:'center'}); target.focus(); };
  element('entry-editor').addEventListener('input', setDirty);
  element('entry-editor').addEventListener('submit', e => { e.preventDefault(); operation(saveManualEntry); });
  element('cancel-edit').onclick = () => { journalDirty = false; renderDailyPage(); render(); };
  for (const rev of journalEntry.revisions ?? []) {
    const row = makeNode('div', undefined, 'revision-row');
    row.append(makeNode('span', `v${rev.version} · ${rev.reason}`));
    if (rev.version !== journalEntry.version) { const restore = button('Restore', () => operation(async () => { if (journalDirty) throw new Error('Save or discard your edits before restoring a version.'); journalEntry = await (await post('/api/journal/restore', { ...activeJournal, expectedVersion:journalEntry.version, targetVersion:rev.version })).json(); await loadOverview(); renderDailyPage(); })); restore.dataset.workControl=''; row.append(restore); }
    else row.append(makeNode('small','Current'));
    element('entry-revisions').append(row);
  }
  renderEntryList(element('other-days'), journalOverview.entries.filter(e => e.kind === kind && e.date !== date).slice(0, 8), 'Your next entries will appear here.');
  refreshIcons();
}
function ratingOptions(value) { return `<option value="">Not recorded</option>${[1,2,3,4,5].map(n => `<option value="${n}" ${n === value ? 'selected' : ''}>${n} / 5${n === 1 ? ' · Low' : n === 5 ? ' · High' : ''}</option>`).join('')}`; }
function changeDay(date) { if (JournalModel.validDate(date)) navigateTo(JournalModel.entryPath({ ...activeJournal, date })); }
function setDirty() { journalDirty = true; element('save-status').textContent = 'Unsaved edits'; }
function addSessionRow(session) {
  const row = makeNode('div', undefined, 'session-row');
  row.innerHTML = `<label>Course<input class="session-course" list="course-options" maxlength="100" value="${html(session.course)}" placeholder="Course name" data-work-control></label><label>Minutes<input class="session-minutes" type="number" min="1" max="1440" step="1" value="${session.minutes}" placeholder="90" data-work-control></label>`;
  const remove = button('×', () => { row.remove(); setDirty(); updateSessionTotal(); }, 'icon-button'); remove.setAttribute('aria-label', 'Remove course'); remove.dataset.workControl=''; row.append(remove);
  row.addEventListener('input', updateSessionTotal); element('study-sessions').append(row); updateSessionTotal();
}
function updateSessionTotal() { element('session-total').textContent = `Total: ${duration([...document.querySelectorAll('.session-minutes')].reduce((sum, input) => sum + (Number(input.value) || 0), 0))}`; }
async function saveManualEntry() {
  const d = { title: element('entry-title').value, body: element('entry-body').value, tags: element('entry-tags').value.split(',').map(t => t.trim()).filter(Boolean) };
  const numeric = id => element(id).value === '' ? null : Number(element(id).value);
  if (activeJournal.kind === 'study') Object.assign(d, { sessions: [...document.querySelectorAll('.session-row')].filter(row => row.querySelector('.session-minutes').value !== '').map(row => ({ course:row.querySelector('.session-course').value, minutes:Number(row.querySelector('.session-minutes').value) })), satisfaction:numeric('satisfaction') });
  else Object.assign(d, { bedtime:element('bedtime').value, wakeTime:element('wake-time').value, hours:numeric('sleep-hours'), quality:numeric('sleep-quality'), dreams:element('dreams').value, habits:element('habits').value });
  JournalModel.validateDocument(activeJournal.kind, d);
  journalEntry = await (await post('/api/journal/save', { ...activeJournal, expectedVersion:journalEntry.version, document:d })).json();
  journalDirty = false; await loadOverview(); renderDailyPage();
  element('save-status').textContent = `Saved successfully · version ${journalEntry.version}`;
}
function addSources(container, sources) {
  if (!sources?.length) return;
  const links = makeNode('div', undefined, 'source-links'); links.append(makeNode('span', 'From your journals', 'quiet'));
  for (const source of sources) { const link = makeNode('a', `${source.kind === 'study' ? 'Study' : 'Sleep'} · ${niceDate(source.date)} · ${source.title}`); link.href=href(source.href); link.dataset.route=''; links.append(link); }
  container.append(links);
}
async function loadJournalConversation() {
  element('messages').replaceChildren();
  if (HUB_DEMO) {
    element('messages').innerHTML = `<div class="assistant-welcome"><span class="welcome-orbit">${icon('search')}</span><h3>A bigger picture starts<br>with a small connection.</h3><p>Search across the demo's study reports and dream journals. Open any result to read, edit, and revisit it.</p><p class="demo-explanation">This public demo uses keyword search. The local app's connected assistant can discuss and update entries through chat.</p></div>`;
    return;
  }
  if (!state?.ownerConfirmed) { element('messages').innerHTML = '<div class="assistant-welcome"><h3>Your private reflection partner.</h3><p>Connect your owner account to start a conversation. Your reports and chats will be saved on this computer.</p></div>'; return; }
  const query = new URLSearchParams(activeJournal ?? {kind:'home'});
  const saved = await getJSON(`/api/journal/messages?${query}`);
  for (const message of saved.messages) {
    const output = addMessage(message.role, message.content); output.paragraph.innerHTML=renderRich(message.content);
    output.heading.textContent = message.role === 'user' ? 'You' : message.status === 'completed' ? 'Your assistant' : 'Response unfinished';
    if (message.status !== 'completed') output.section.classList.add('failed');
    addSources(output.section, message.sources);
  }
  if (!saved.messages.length) {
    const prompt = activeJournal?.kind === 'study' ? 'What did you study today, and about how long did you spend on each course?' : activeJournal?.kind === 'sleep' ? 'How was your sleep? Tell me any dream fragments you remember — even a feeling or an image.' : 'What would you like to understand about your days? I can look across your study reports, sleep, dreams, and habits.';
    element('messages').innerHTML = `<div class="assistant-welcome"><span class="welcome-orbit">${icon('sparkles')}</span><h3>Start with a few words.</h3><p>${html(prompt)}</p><small>Conversation starter · no AI request yet</small></div>`;
  }
  element('context-status').textContent = saved.summarized ? 'Saved summary, recent messages, and relevant earlier context.' : activeJournal ? `Conversation saved for ${niceDate(activeJournal.date)}.` : 'Private conversation · searches across both journals.';
  element('messages').scrollTop = element('messages').scrollHeight;
}
function configureAssistant() {
  element('assistant-title').textContent = HUB_DEMO ? 'Explore your journal' : activeLectureId ? 'Lecture assistant' : activeJournal?.kind === 'study' ? 'Study companion' : activeJournal?.kind === 'sleep' ? 'A space to remember' : 'Hub assistant';
  element('assistant-description').textContent = activeJournal ? 'A conversation that becomes a record of your day.' : 'Look across your days. Notice what connects them.';
  element('chat-form').hidden = HUB_DEMO;
  element('demo-search-form').hidden = !HUB_DEMO;
  element('connection-details').hidden = HUB_DEMO;
  document.querySelector('.model-row').hidden = HUB_DEMO;
  element('chat-suggestions').replaceChildren();
  const prompts = HUB_DEMO ? ['Algorithms', 'forest', 'walk'] : activeJournal?.kind === 'sleep' ? ['I remembered another part of my dream…'] : activeJournal?.kind === 'study' ? ['Today I studied…', 'Help me reflect on my effort'] : ['How did I divide my study time this week?', 'What themes recur in my dreams?'];
  for (const prompt of prompts) element('chat-suggestions').append(button(prompt, () => { element(HUB_DEMO ? 'demo-query' : 'question').value=prompt; if (HUB_DEMO) element('demo-search-form').requestSubmit(); else element('question').focus(); }, 'suggestion'));
  element('assistant-eyebrow').textContent = HUB_DEMO ? 'BROWSER DEMO · KEYWORD SEARCH' : 'YOUR REFLECTION PARTNER';
  element('assistant-privacy').textContent = HUB_DEMO ? 'Fictional demo data. No AI calls or account connection.' : 'Only your owner account can open these conversations.';
}
async function reloadJournal() {
  if (activeJournal) { journalEntry=await getJSON(`/api/journal/entry?kind=${activeJournal.kind}&date=${activeJournal.date}`); await loadOverview(); renderDailyPage(); render(); }
  else await renderJournalRoute(routeURL().pathname);
}
element('demo-search-form').addEventListener('submit', async event => {
  event.preventDefault();
  try { const result=await getJSON(`/api/journal/search?q=${encodeURIComponent(element('demo-query').value)}`); renderEntryList(element('demo-results'),result.entries,'No matching entries. Try “forest”, “focus”, or a course name.'); }
  catch(error) { notice(error.message); }
});
element('export-journals').addEventListener('click', async () => {
  try { const data = await getJSON('/api/journal/export'); const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:'application/json'})); const link=document.createElement('a'); link.href=url; link.download=`personal-hub-journals-${today()}.json`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
  catch(error) { notice(error.message); }
});
