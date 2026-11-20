export const KINDS = ['study', 'sleep'];
const invalid = () => { throw Object.assign(new Error('invalid_journal'), { code: 'invalid_journal' }); };
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function checkKey(kind, date) { if (!KINDS.includes(kind) || !validDate(date)) invalid(); }
export function blankEntry(kind, date) {
  checkKey(kind, date);
  return { kind, date, version: 0, updatedAt: null, document: kind === 'study'
    ? { title: 'A day of learning', body: '', tags: [], sessions: [], satisfaction: null }
    : { title: 'Between sleep and waking', body: '', tags: [], bedtime: '', wakeTime: '', hours: null, quality: null, dreams: '', habits: '' } };
}
function text(value, max) { if (typeof value !== 'string' || value.length > max) invalid(); return value.trim(); }
function number(value, max, min = 0) { if (value === null) return null; if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) invalid(); return value; }
export function validateDocument(kind, value) {
  if (!KINDS.includes(kind) || !value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const document = { title: text(value.title, 140), body: text(value.body, 20000), tags: [] };
  if (!document.title || !Array.isArray(value.tags) || value.tags.length > 15) invalid();
  document.tags = [...new Set(value.tags.map(tag => text(tag, 50)).filter(Boolean))];
  if (kind === 'study') {
    if (!Array.isArray(value.sessions) || value.sessions.length > 30) invalid();
    document.sessions = value.sessions.map(session => {
      if (!session || typeof session !== 'object') invalid();
      const course = text(session.course, 100), minutes = number(session.minutes, 1440);
      if (!course || minutes === null || !Number.isInteger(minutes) || minutes <= 0) invalid();
      return { course, minutes };
    });
    if (studyMinutes(document) > 1440) invalid();
    document.satisfaction = number(value.satisfaction, 5, 1);
  } else {
    const time = value => { const result = text(value, 5); if (result && !/^([01]\d|2[0-3]):[0-5]\d$/.test(result)) invalid(); return result; };
    Object.assign(document, { bedtime: time(value.bedtime), wakeTime: time(value.wakeTime), hours: number(value.hours, 24), quality: number(value.quality, 5, 1), dreams: text(value.dreams, 20000), habits: text(value.habits, 10000) });
  }
  return document;
}
export function studyMinutes(document) { return (document.sessions ?? []).reduce((sum, item) => sum + item.minutes, 0); }
export function entryId(entry) { return `${entry.kind}/${entry.date}`; }
export function entryPath(entry) { return `${entry.kind === 'study' ? '/education/daily' : '/habits-sleep'}?date=${entry.date}`; }
export function entryText(entry) { const d = entry.document; return [entry.date, entry.kind === 'study' ? 'study education learning לימודים' : 'sleep dreams habits שינה חלומות', d.title, d.body, ...d.tags, ...(d.sessions ?? []).map(s => s.course), d.dreams, d.habits].filter(Boolean).join(' '); }
export function filterEntries(entries, { kind, from, to } = {}) {
  if ((kind && !KINDS.includes(kind)) || (from && !validDate(from)) || (to && !validDate(to)) || (from && to && from > to)) invalid();
  return entries.filter(e => (!kind || e.kind === kind) && (!from || e.date >= from) && (!to || e.date <= to)).sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
}
export function searchEntries(entries, query = '', filters = {}, limit = 30) {
  if (typeof query !== 'string' || query.length > 4000) invalid();
  const terms = [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
  return filterEntries(entries, filters).map(entry => ({ entry, score: terms.reduce((score, term) => score + (entryText(entry).toLocaleLowerCase().includes(term) ? 1 : 0), 0) }))
    .filter(row => !terms.length || row.score > 0).sort((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date)).slice(0, limit).map(row => row.entry);
}
export function journalStats(entries) {
  const study = entries.filter(e => e.kind === 'study'), sleep = entries.filter(e => e.kind === 'sleep');
  const courses = new Map();
  for (const e of study) for (const s of e.document.sessions) courses.set(s.course, (courses.get(s.course) ?? 0) + s.minutes);
  const average = values => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 10) / 10 : null;
  const knownSleep = sleep.filter(e => e.document.hours !== null);
  return { entries: entries.length, studyDays: study.length, sleepDays: sleep.length,
    totalMinutes: [...courses.values()].reduce((a, b) => a + b, 0), courses: [...courses].map(([course, minutes]) => ({ course, minutes })).sort((a, b) => b.minutes - a.minutes),
    averageSleep: average(knownSleep.map(e => e.document.hours)), sleepSamples: knownSleep.length,
    averageSatisfaction: average(study.map(e => e.document.satisfaction).filter(n => n !== null)),
    dates: [...new Set(entries.map(e => e.date))].sort(),
  };
}
