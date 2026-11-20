const element = id => document.getElementById(id);
const HUB_DEMO = document.documentElement.dataset.demo === 'true';
const hubFetch = (path, options) => HUB_DEMO ? demoFetch(path, options) : fetch(path, options);
const DEMO_KEY = 'personal-hub-demo-v1';
function initialDemo() {
  const entries = [], revisions = {};
  const study = [
    { offset:-1,title:'Finding my way through graphs',body:'Two focused sessions made a difference. I worked through shortest paths, then reviewed process scheduling. Putting my phone away helped me stay with the harder questions.',sessions:[{course:'Algorithms',minutes:120},{course:'Operating Systems',minutes:45}],satisfaction:4,tags:['focus','graphs'] },
    { offset:-2,title:'A slower day still counts',body:'I found it harder to settle into studying today. A short session on AI tools was manageable. Tomorrow I want to start with one clear task.',sessions:[{course:'AI Course',minutes:45},{course:'Algorithms',minutes:30}],satisfaction:3,tags:['reflection','small steps'] },
    { offset:-3,title:'A good rhythm, one task at a time',body:'Worked on memory management in the morning and practiced algorithms after lunch. The walk between sessions gave me a useful break.',sessions:[{course:'Operating Systems',minutes:90},{course:'Algorithms',minutes:90}],satisfaction:4,tags:['walk','revision'] }
  ];
  const sleep = [
    {offset:-1,title:'The path through the forest',body:'Woke up feeling fairly rested. I remember the atmosphere of the dream more clearly than its ending.',bedtime:'23:15',wakeTime:'07:15',hours:7.5,quality:4,dreams:'I was walking through a quiet forest. A narrow path led to a small wooden bridge. I am not sure what was on the other side.\n\nLater recollection: there may have been a blue door near the bridge.',habits:'Read for twenty minutes before bed. Took an evening walk.',tags:['forest','bridge','walk']},
    {offset:-2,title:'A restless night, a few fragments',body:'Felt a little tired on waking. I do not remember a complete dream.',bedtime:'00:30',wakeTime:'07:00',hours:6,quality:2,dreams:'Fragments of a crowded station and looking for a bag. The details are uncertain.',habits:'Used my phone late in the evening.',tags:['fragments','restless']},
    {offset:-3,title:'Trees, light, and an unfamiliar place',body:'A calm morning. I wanted to write the dream down before breakfast.',bedtime:'23:00',wakeTime:'07:00',hours:7.5,quality:4,dreams:'An unfamiliar garden with very tall trees. The light felt like early morning. I remember searching for a gate.',habits:'A walk after dinner and no phone during the last half hour.',tags:['trees','garden','walk']}
  ];
  for (const [kind, rows] of [['study',study],['sleep',sleep]]) for (const row of rows) {
    const {offset,...document}=row, date=shiftDate(today(),offset), entry={kind,date,document,version:1,updatedAt:`${date}T12:00:00Z`};
    entries.push(entry); revisions[JournalModel.entryId(entry)]=[{version:0,document:JournalModel.blankEntry(kind,date).document,reason:'Empty entry',updatedAt:entry.updatedAt},{version:1,document:structuredClone(document),reason:'Fictional demo example',updatedAt:entry.updatedAt}];
  }
  return {version:1,entries,revisions};
}
function readDemo() {
  const raw=localStorage.getItem(DEMO_KEY);
  if (raw) { const data=JSON.parse(raw); if (data.version!==1 || !Array.isArray(data.entries) || !data.revisions) throw new Error('Demo storage could not be read. Export the browser data or reset the demo to start again.'); return data; }
  const data=initialDemo(); localStorage.setItem(DEMO_KEY,JSON.stringify(data)); return data;
}
async function demoFetch(path, options={}) {
  const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  try {
    const url=new URL(path,location.origin), method=options.method || 'GET', data=readDemo();
    const kind=url.searchParams.get('kind'), date=url.searchParams.get('date');
    const filters={kind:kind || undefined,from:url.searchParams.get('from') || undefined,to:url.searchParams.get('to') || undefined};
    if (url.pathname==='/api/state') return json({status:'demo',ownerConfirmed:true,sharing:false,models:[],csrf:'demo-only'});
    if (url.pathname==='/api/catalog') return json({courses:[{id:'algorithms',title:'Algorithms',icon:'network'},{id:'operating-systems',title:'Operating Systems',icon:'cpu'},{id:'ai-course',title:'AI Course',icon:'sparkles'}],lectures:Array.from({length:13},(_,i)=>({id:`algorithms-${String(i+1).padStart(2,'0')}`,course:'algorithms',title:`Lecture ${i+1}`}))});
    if (url.pathname==='/api/journal/overview') { const entries=JournalModel.filterEntries(data.entries,filters); return json({entries,stats:JournalModel.journalStats(entries)}); }
    if (url.pathname==='/api/journal/search') return json({entries:JournalModel.searchEntries(data.entries,url.searchParams.get('q') || '',filters)});
    if (url.pathname==='/api/journal/entry') { JournalModel.checkKey(kind,date); const entry=data.entries.find(e=>e.kind===kind&&e.date===date) || JournalModel.blankEntry(kind,date); return json({...entry,revisions:(data.revisions[JournalModel.entryId(entry)] || []).toReversed().map(({document,...r})=>r)}); }
    if (url.pathname==='/api/journal/export') return json({format:'personal-hub-demo',exportedAt:new Date().toISOString(),...data});
    if (method==='POST' && ['/api/journal/save','/api/journal/restore'].includes(url.pathname)) {
      const payload=JSON.parse(options.body); JournalModel.checkKey(payload.kind,payload.date);
      const previous=data.entries.find(e=>e.kind===payload.kind&&e.date===payload.date) || JournalModel.blankEntry(payload.kind,payload.date);
      if(previous.version!==payload.expectedVersion) return json({message:'This entry changed in another tab. Reload it before editing.'},409);
      const id=JournalModel.entryId(previous), history=data.revisions[id] || [{version:0,document:previous.document,reason:'Empty entry',updatedAt:new Date().toISOString()}];
      const restoring=url.pathname.endsWith('/restore');
      const document=JournalModel.validateDocument(payload.kind,restoring ? history.find(r=>r.version===payload.targetVersion)?.document : payload.document);
      const entry={...previous,document,version:previous.version+1,updatedAt:new Date().toISOString()};
      data.entries=data.entries.filter(e=>JournalModel.entryId(e)!==id); data.entries.push(entry);
      history.push({version:entry.version,document:structuredClone(document),updatedAt:entry.updatedAt,reason:restoring?`Restored version ${payload.targetVersion}`:'Edited journal'}); data.revisions[id]=history;
      localStorage.setItem(DEMO_KEY,JSON.stringify(data));
      return json({...entry,revisions:history.toReversed().map(({document,...r})=>r)});
    }
    return json({message:'Live ChatGPT and private course files are available in the local app. This public demo has no AI connection.'},400);
  } catch(error) { return json({message:error.name==='QuotaExceededError' ? 'Browser storage is full. Export your entries before clearing space.' : error.code==='invalid_journal' ? 'Check your date, course minutes, and ratings (1–5).' : error.message || 'Could not save browser data.'},400); }
}
