import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HubStore } from '../local/store.mjs';
import { Journals } from '../local/journals.mjs';
import { journalChat } from '../local/journal-assistant.mjs';
import { blankEntry, validateDocument, validDate, journalStats } from '../shared/journal-model.mjs';
import { startLocalServer } from '../local/server.mjs';
const date='2026-11-20';
const study=()=>({...blankEntry('study',date).document,title:'Graph practice',body:'A walk helped me return to graphs.',sessions:[{course:'Algorithms',minutes:90}],satisfaction:4,tags:['walk']});
const sleep=()=>({...blankEntry('sleep',date).document,title:'A forest dream',body:'Felt rested.',hours:7.5,quality:4,dreams:'A forest and a wooden bridge.',tags:['forest']});
function fixture(t) { const store=new HubStore(':memory:');t.after(()=>store.close());return new Journals(store); }
function runtimeFor(output) { return {streamResponse:async options=>({text:JSON.stringify(typeof output==='function'?output(options):output)})}; }
const chat=(journals,runtime,extra={})=>journalChat({journals,runtime,kind:'sleep',date,today:date,model:'fixture',message:'I remember a bridge.',...extra});

test('journals migrate without touching courses, persist across restart, isolate dates and restore revisions',t=>{
 const directory=mkdtempSync(join(tmpdir(),'hub-journal-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const path=join(directory,'hub.sqlite');let store=new HubStore(path);store.seed('lecture','algorithms','Retained lecture');store.addMessage('lecture','user','Existing question');
 let journals=new Journals(store);journals.save('study',date,0,study());journals.save('sleep',date,0,sleep());journals.addMessage(`sleep:${date}`,'user','Original dream');
 journals.save('sleep',date,1,{...sleep(),dreams:sleep().dreams+' Later: a blue door.'});store.close();
 store=new HubStore(path);journals=new Journals(store);
 assert.equal(journals.entries().length,2);assert.match(journals.entry('sleep',date).document.dreams,/blue door/);assert.equal(journals.entry('sleep','2026-11-19').version,0);assert.equal(journals.entry('study',date).document.sessions[0].minutes,90);
 assert.equal(journals.messages(`sleep:${date}`).length,1);assert.equal(journals.messages('home').length,0);assert.equal(store.messages('lecture')[0].content,'Existing question');
 assert.throws(()=>journals.save('sleep',date,1,sleep()),{code:'version_conflict'});
 journals.restore('sleep',date,2,1);assert.equal(journals.entry('sleep',date).document.dreams,sleep().dreams);assert.equal(journals.revisions('sleep',date).length,4);store.close();
});
test('dates, field types and impossible daily totals are rejected; unknown sleep is not zero',t=>{
 const journals=fixture(t);assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2024-02-29'),true);
 for(const document of [{...study(),sessions:[{course:'Algorithms',minutes:-1}]},{...study(),sessions:[{course:'A',minutes:900},{course:'B',minutes:900}]},{...study(),satisfaction:9},{...study(),tags:['x'.repeat(51)]}]) assert.throws(()=>validateDocument('study',document),{code:'invalid_journal'});
 assert.throws(()=>journals.save('health',date,0,sleep()),{code:'invalid_journal'});
 journals.save('sleep',date,0,blankEntry('sleep',date).document);assert.equal(journalStats(journals.entries()).averageSleep,null);assert.equal(journals.entries().length,1);
});
test('successful assistant updates the selected day, preserves originals and saved conversation is passed to later requests',async t=>{
 const journals=fixture(t);let request;
 await chat(journals,runtimeFor({reply:'What stood out about the bridge?',entry:sleep(),sources:[]}));
 const updated={...sleep(),dreams:sleep().dreams+' Later I recalled a blue door.'};
 await chat(journals,runtimeFor(options=>{request=options;return {reply:'I added the door to this day’s dream record.',entry:updated,sources:[]};}),{message:'Later I recalled a blue door.'});
 assert.equal(journals.entry('sleep',date).version,2);assert.match(journals.entry('sleep',date).document.dreams,/forest.*blue door/);assert.equal(journals.messages(`sleep:${date}`).length,4);
 assert.ok(request.input.some(m=>m.role==='assistant'&&m.content.includes('bridge')));assert.match(request.input[0].content,/wooden bridge/);
 assert.equal(journals.entries().length,1);assert.equal(journals.entry('study',date).version,0);
});
test('invalid, interrupted and cancelled responses keep raw user messages but cannot change entries',async t=>{
 const journals=fixture(t);journals.save('sleep',date,0,sleep());
 await assert.rejects(chat(journals,runtimeFor({reply:'Saved',entry:{...sleep(),hours:26},sources:[]})),{code:'invalid_journal'});
 await assert.rejects(chat(journals,{streamResponse:async()=>{throw Object.assign(new Error('Secret upstream info'),{code:'stream_interrupted'});}}),{code:'stream_interrupted'});
 const controller=new AbortController();
 await assert.rejects(chat(journals,{streamResponse:async()=>{controller.abort();return {text:JSON.stringify({reply:'Done',entry:sleep(),sources:[]})};}},{signal:controller.signal}));
 assert.equal(journals.entry('sleep',date).version,1);assert.equal(journals.messages(`sleep:${date}`).filter(m=>m.role==='user').length,3);assert.equal(journals.messages(`sleep:${date}`).filter(m=>m.status==='incomplete').length,3);
 assert.doesNotMatch(JSON.stringify(journals.export()),/Secret upstream/);
});
test('home assistant retrieves both journals, uses exact date filters and verified source links, never writes records',async t=>{
 const journals=fixture(t);journals.save('study',date,0,study());journals.save('sleep',date,0,{...sleep(),habits:'Took a walk'});journals.save('sleep','2026-10-01',0,{...sleep(),dreams:'Distant early memory'});
 let answered;
 const runtime=runtimeFor(options=>{
  if(options.instructions.startsWith('JOURNAL_SEARCH_PLAN')) return {queries:['walk'],kind:null,from:'2026-11-01',to:date};
  answered=options;return {reply:'Both November records mention a walk. Two entries cannot establish a pattern.',entry:null,sources:[`study/${date}`,`sleep/${date}`]};
 });
 const result=await chat(journals,runtime,{kind:'home',date:undefined,message:'Does walking appear in my study and sleep reports this month?'});
 assert.equal(result.sources.length,2);assert.equal(result.sources[0].href.startsWith('/'),true);assert.match(answered.input[0].content,/Algorithms/);assert.match(answered.input[0].content,/wooden bridge/);assert.doesNotMatch(answered.input[0].content,/Distant early memory/);assert.equal(journals.entry('sleep',date).version,1);assert.equal(journals.messages('home').length,2);
 assert.equal(journals.search('forest').length,2);assert.equal(journals.search('forest',{from:'2026-11-01'}).length,1);
});
test('home assistant rejects invented citations and journal writes',async t=>{
 const journals=fixture(t);
 await assert.rejects(chat(journals,runtimeFor({reply:'A claim',entry:null,sources:['sleep/1999-01-01']}),{kind:'home',date:undefined}),{code:'invalid_journal_response'});
 await assert.rejects(chat(journals,runtimeFor({reply:'Changed it',entry:sleep(),sources:[]}),{kind:'home',date:undefined}),{code:'invalid_journal_response'});
 assert.equal(journals.entries().length,0);
});
test('long threads retain originals and summarize only their own history',async t=>{
 const journals=fixture(t),thread=`study:${date}`;
 for(let i=0;i<26;i++) journals.addMessage(thread,i%2?'assistant':'user',`Study message ${i}`);
 journals.addMessage(`sleep:${date}`,'user','Unrelated PRIVATE dream');
 let answer;
 const runtime={streamResponse:async options=>{
  if(options.instructions.startsWith('JOURNAL_SUMMARY')){assert.doesNotMatch(JSON.stringify(options),/PRIVATE dream/);return {text:'Study continuity summary'};}
  answer=options;return {text:JSON.stringify({reply:'Let’s continue.',entry:null,sources:[]})};
 }};
 await chat(journals,runtime,{kind:'study',message:'Continue'});
 assert.equal(journals.messages(thread).length,28);assert.match(JSON.stringify(answer.input),/Study continuity summary/);assert.doesNotMatch(JSON.stringify(answer.input),/PRIVATE dream/);assert.ok(journals.summary(thread));
});
test('journal HTTP endpoints enforce owner, cookie and CSRF checks; persisted reports and chats can be reopened',async t=>{
 let owner=null,session={status:'disconnected',sharing:false};
 const runtime={getSession:async()=>session,signIn:async()=>session={status:'connected',sharing:true,profileId:'owner-fixture'},listModels:async()=>[{slug:'test-model',displayName:'Synthetic test model'}],cancelSignIn(){},streamResponse:async()=>({text:JSON.stringify({reply:'Which part felt most satisfying?',entry:study(),sources:[]})})};
 const store=new HubStore(':memory:'); const app=await startLocalServer({runtime,store,root:process.cwd(),ownerStore:{read:async()=>owner,write:async v=>owner=v}});
 t.after(()=>{app.server.closeAllConnections();app.server.close();store.close();});
 const token=new URLSearchParams(new URL(app.launchUrl).hash.slice(1)).get('launch');
 const boot=await fetch(app.origin+'/api/bootstrap',{method:'POST',headers:{Origin:app.origin,'Content-Type':'application/json'},body:JSON.stringify({token})});
 const cookie=boot.headers.get('set-cookie').split(';')[0];
 const get=path=>fetch(app.origin+path,{headers:{Cookie:cookie}});
 const state=await(await get('/api/state')).json();
 const post=(path,body,csrf=state.csrf)=>fetch(app.origin+path,{method:'POST',headers:{Origin:app.origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
 assert.equal((await fetch(app.origin+'/api/journal/export')).status,401);
 assert.notEqual((await get('/api/journal/overview')).status,200);
 await post('/api/connect',{});assert.notEqual((await get('/api/journal/overview')).status,200);await post('/api/owner',{});await post('/api/models',{});
 assert.equal((await post('/api/journal/save',{kind:'study',date,expectedVersion:0,document:study()},'wrong')).status,403);
 const events=(await(await post('/api/journal/chat',{kind:'study',date,today:date,message:'90 minutes of Algorithms, satisfaction 4',model:'test-model'})).text()).trim().split('\n').map(JSON.parse);
 assert.equal(events.at(-1).type,'completed');assert.equal(events.at(-1).updated,true);
 const entry=await(await get(`/api/journal/entry?kind=study&date=${date}`)).json();assert.equal(entry.document.sessions[0].minutes,90);
 assert.equal((await(await get(`/api/journal/messages?kind=study&date=${date}`)).json()).messages.length,2);
 assert.equal((await(await get('/api/journal/export')).json()).entries.length,1);
 session={...session,profileId:'different-person'};assert.equal((await get('/api/journal/overview')).status,403);assert.equal((await get('/api/journal/search?q=Algorithms')).status,403);assert.equal((await get(`/api/journal/messages?kind=study&date=${date}`)).status,403);
});
