import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/app/terrain-stroke-queue.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {TerrainStrokeQueue,TerrainDraftStroke}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const action={kind:'landscape-height-stroke',stroke:{samples:[{x:1,y:2,t:0},{x:1,y:2,t:100}]}};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
test('immediate second gesture waits for first receipt, uses its source and distinct undo identity',async()=>{
 const gate=deferred(),calls=[];
 const queue=new TerrainStrokeQueue({expectedRevision:7,sourceFence:'a'},async(a,c)=>{calls.push({a,c});if(calls.length===1)await gate.promise;return{revision:c.expectedRevision+1,sourceFence:c.sourceFence+'x'};});
 const first=new TerrainDraftStroke(a=>queue.enqueue(a,'first'));first.update(action);assert.equal(calls.length,0);
 const p=first.finish();const second=new TerrainDraftStroke(a=>queue.enqueue(a,'second'));second.update(action);const q=second.finish();
 await Promise.resolve();assert.equal(queue.pending,2);assert.equal(calls.length,1);action.stroke.samples[1].x=99;
 gate.resolve();await Promise.all([p,q]);assert.deepEqual(calls.map(c=>c.c),[{id:'first',expectedRevision:7,sourceFence:'a'},{id:'second',expectedRevision:8,sourceFence:'ax'}]);assert.equal(calls[1].a.stroke.samples[1].x,1);assert.equal(queue.pending,0);
});
test('unknown write freezes dependent gestures, without retries or invented acknowledgements',async()=>{
 const gate=deferred();let calls=0;const queue=new TerrainStrokeQueue({expectedRevision:0,sourceFence:'a'},async()=>{calls++;await gate.promise;throw Error('unknown');});
 const first=queue.enqueue(action,'first'),second=queue.enqueue(action,'second');const results=Promise.allSettled([first,second]);gate.resolve();
 assert((await results).every(r=>r.status==='rejected'));assert.equal(calls,1);assert(queue.failed);await assert.rejects(queue.enqueue(action,'third'),/unknown/);await assert.rejects(queue.finish(),/unknown/);
});
test('missing fence and regressing revision stop dependent writes',async()=>{
 for(const ack of [{revision:8},{revision:6,sourceFence:'b'}]){
  let calls=0;const queue=new TerrainStrokeQueue({expectedRevision:7,sourceFence:'a'},async()=>{calls++;return ack;});
  const results=await Promise.allSettled([queue.enqueue(action,'a'),queue.enqueue(action,'b')]);assert(results.every(r=>r.status==='rejected'));assert.equal(calls,1);
 }
});


const ownerBuild=await build({stdin:{contents:"export * from './src/app/terrain-author-state';export * from './src/app/terrain-author-checkpoint';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {TerrainAuthorState,replayTerrainAuthor,terrainAuthorWindow}=await import('data:text/javascript;base64,'+Buffer.from(ownerBuild.outputFiles[0].text).toString('base64'));
const height=(strength=8,radius=32)=>({mode:'raise',radius,strength,feather:0,samples:[{x:0,y:0,t:0},{x:0,y:0,t:125}]});
function packet(q){const w=terrainAuthorWindow(q),pages=[];for(let y=w.top;y<=w.bottom;y++)for(let x=w.left;x<=w.right;x++)pages.push({x:x*w.edge,y:y*w.edge,pixel:q.pixel,revision:0,values:new Float32Array(4096).fill(NaN)});return{query:structuredClone(q),pages,ground:q.lattices.map(l=>({lattice:{...l},values:new Float64Array(4225).fill(100)})),coverage:{left:w.left,right:w.right,top:w.top,bottom:w.bottom,complete:true}};}
function author(overrides={}){let revision=0;return new TerrainAuthorState({owner:'owner',series:1,source:{token:'t',fence:'f0',revision:0},lattices:[{id:0,x:-32,y:-32,dx:1,dy:1}],read:async q=>packet(q),write:async()=>{const n=++revision;return{ack:{commandId:'c'+n,revision:n,sourceFence:'f'+n},receipt:{commandId:'c'+n,fingerprint:'receipt'+n}};},...overrides});}
test('async accepted checkpoint completes before another write; rejected capacity preserves captures',async()=>{
 const checkpoint=deferred(),calls=[];const q=new TerrainStrokeQueue({expectedRevision:0,sourceFence:'a'},async(a,c)=>{calls.push(c.id);return{revision:c.expectedRevision+1,sourceFence:c.sourceFence+'x'};},async()=>{if(calls.length===1)await checkpoint.promise;});
 const all=Array.from({length:32},(_,i)=>q.enqueue(action,'id'+i));await Promise.resolve();await Promise.resolve();assert.equal(calls.length,1);assert.equal(q.journal.size,32);
 await assert.rejects(q.enqueue(action,'extra'),/offene/);assert.equal(q.failed,false);assert.equal(q.journal.size,32);checkpoint.resolve();await Promise.all(all);assert.equal(q.journal.prefix,32);assert.equal(q.journal.size,0);
});
test('author returns the exact finite capture while newer active input remains available',async()=>{
 const read=deferred(),entered=deferred();let first=true;const o=author({read:async q=>{if(first){first=false;entered.resolve();await read.promise;}return packet(q);}});
 o.begin('same-id',height());const task=o.refresh();await entered.promise;assert.equal(o.snapshot.ground.length,0);o.update('same-id',height(16));read.resolve();const firstSnapshot=await task;assert.equal(firstSnapshot,o.snapshot);assert.equal(firstSnapshot.active.action.stroke.strength,8);assert.equal(o.active.action.stroke.strength,16);const nextSnapshot=await o.refresh();assert.notEqual(nextSnapshot,firstSnapshot);assert.equal(firstSnapshot.active.action.stroke.strength,8);
 assert.equal(o.active.id,'same-id');assert.equal(o.snapshot.active.id,'same-id');assert.equal(o.snapshot.active.action.stroke.strength,16);assert.equal(o.snapshot.ground[0].values[32*65+32],102);assert.equal(o.snapshot.bands.length,4);
});
test('owner/series/source replacement during read or replay cannot install into a new owner',async()=>{
 for(const stage of['read','replay'])for(const change of [{owner:'other'},{series:2},{source:{token:'other',fence:'new',revision:8}}]){
  const gate=deferred(),entered=deferred();let calls=0;const old=author({read:async q=>{calls++;if(stage==='read'){entered.resolve();await gate.promise;}return packet(q);},replay:async input=>{if(stage==='replay'){entered.resolve();await gate.promise;}return replayTerrainAuthor(input);}});old.begin('old',height());const pending=old.refresh();await entered.promise;old.retire();const priorCalls=calls,next=author(change);next.begin('new',height(24));await next.refresh();const snapshot=next.snapshot;gate.resolve();assert.equal(await pending,null);assert.equal(old.snapshot.ground.length,0);assert.equal(next.snapshot,snapshot);assert.equal(next.active.id,'new');assert.equal(calls,priorCalls,'retired replay sends no additional read');
 }
});
test('close during delayed read moves the same active capture exactly once into checkpoint state',async()=>{
 const gate=deferred(),entered=deferred();let first=true;const o=author({read:async q=>{assert.equal(q.prefix,q.revision);if(first){first=false;entered.resolve();await gate.promise;}return packet(q);}});o.begin('closing',height());const preview=o.refresh();await entered.promise;const waitingPreview=o.refresh(),done=o.close('closing');gate.resolve();await Promise.all([preview,waitingPreview,done]);assert.equal(o.active,null);assert.equal(o.snapshot.active,null);assert.equal(o.snapshot.prefix,1);assert.equal(o.journal.size,0);
});
test('Escape during async replay invalidates its result and restores previous numerical author state',async()=>{
 const gate=deferred(),entered=deferred();let first=true;const o=author({replay:async input=>{if(first){first=false;entered.resolve();await gate.promise;}return replayTerrainAuthor(input);}});o.begin('escape',height());const pending=o.refresh();await entered.promise;const escaped=o.escape('escape');gate.resolve();await Promise.all([pending,escaped]);assert.equal(o.active,null);assert.equal(o.snapshot.active,null);assert.equal(o.snapshot.bands.length,0);assert(o.snapshot.ground[0].values.every(v=>v===100));assert.equal(o.journal.size,0);
});
test('retirement during async write freezes the durable journal and preserves every accepted identity',async()=>{
 const gate=deferred(),entered=deferred();const o=author({write:async()=>{entered.resolve();await gate.promise;return{ack:{commandId:'c',revision:1,sourceFence:'f1'},receipt:{commandId:'c',fingerprint:'r'}};}});o.begin('a',height());const a=o.close('a');o.begin('b',height());const b=o.close('b');const settled=Promise.allSettled([a,b]);await entered.promise;o.retire();gate.resolve();assert((await settled).every(r=>r.status==='rejected'));assert.deepEqual(o.journal.entries.map(e=>e.id),['a','b']);assert.equal(o.snapshot.prefix,0);
});

test('failed checkpoint read never frees its accepted prefix or dependent captures',async()=>{
 const o=author({read:async()=>{throw Error('checkpoint unavailable');}});o.begin('a',height());const a=o.close('a');o.begin('b',height());const b=o.close('b');assert((await Promise.allSettled([a,b])).every(x=>x.status==='rejected'));assert.equal(o.journal.prefix,0);assert.deepEqual(o.journal.entries.map(e=>e.id),['a','b']);assert.equal(o.snapshot.prefix,0);assert.equal(o.snapshot.ground.length,0);
});
test('closing active33 at capacity survives its checkpoint wait and is queued once',async()=>{
 const gate=deferred();let writes=0;const o=author({replay:async input=>({ground:input.initial.ground,basis:input.initial.pages,bands:[]}),write:async()=>{const n=++writes;if(n===1)await gate.promise;return{ack:{commandId:'c'+n,revision:n,sourceFence:'f'+n},receipt:{commandId:'c'+n,fingerprint:'r'+n}};}}),all=[];
 for(let i=1;i<=32;i++){o.begin('g'+i,height());all.push(o.close('g'+i));}o.begin('g33',height());const close=o.close('g33'),active=o.active;assert.equal(active.id,'g33');assert(active.closing);assert.equal(o.journal.size,32);gate.resolve();await Promise.all([...all,close]);assert.equal(writes,33);assert.equal(o.journal.prefix,33);assert.equal(o.active,null);assert.equal(o.snapshot.active,null);
});

test('Escape and a new capture while close33 awaits capacity cannot enqueue the old capture',async()=>{
 const gate=deferred(),strengths=[];const o=author({replay:async input=>({ground:input.initial.ground,basis:input.initial.pages,bands:[]}),write:async a=>{const n=strengths.push(a.stroke.strength);if(n===1)await gate.promise;return{ack:{commandId:'c'+n,revision:n,sourceFence:'f'+n},receipt:{commandId:'c'+n,fingerprint:'r'+n}};}}),all=[];
 for(let i=1;i<=32;i++){o.begin('g'+i,height());all.push(o.close('g'+i));}o.begin('g33',height(8));const old=o.close('g33');await o.escape('g33');o.begin('g33',height(16));const next=o.close('g33');gate.resolve();await Promise.all([...all,old,next]);assert.equal(strengths.length,33);assert.equal(strengths.at(-1),16);assert.equal(o.journal.prefix,33);assert.equal(o.active,null);
});

test('repeated Escape cancels capacity waiters and finishes old Close frames before a held checkpoint frees space',async()=>{
 const gate=deferred(),entered=deferred();let blocked=true;
 const o=author({read:async q=>{if(q.prefix===1&&blocked){blocked=false;entered.resolve();await gate.promise;}return packet(q);},replay:async input=>({ground:input.initial.ground,basis:input.initial.pages,bands:[]})}),accepted=[],escaped=[];
 for(let i=1;i<=32;i++){o.begin('g'+i,height());accepted.push(o.close('g'+i));}await entered.promise;
 const captures=o.journal.entries;assert.equal(captures.length,32);
 for(let i=0;i<12;i++){
  o.begin('held33',height(8+i));let settled=false;const close=o.close('held33').then(()=>{settled=true;});
  assert.equal(o.journal.waiters.length,1);assert.equal(o.capacityWait.capture,o.active);
  escaped.push(o.escape('held33'));await new Promise(setImmediate);
  assert(settled,'Escape finishes Close without freeing journal capacity');await close;
  assert.equal(o.journal.waiters.length,0);assert.equal(o.capacityWait,null);assert.equal(o.journal.prefix,0);
  assert.equal(o.journal.entries.length,32);assert(o.journal.entries.every((capture,i)=>capture===captures[i]));
 }
 o.begin('held33',height(31));const last=o.close('held33');assert.equal(o.journal.waiters.length,1);gate.resolve();
 await Promise.all([...accepted,...escaped,last]);assert.equal(o.journal.prefix,33);assert.equal(o.journal.size,0);assert.equal(o.journal.waiters.length,0);assert.equal(o.capacityWait,null);assert.equal(o.active,null);
});

test('late pre-Escape read cannot overwrite the actual restored bandbasis',async()=>{
 const gate=deferred(),entered=deferred();let delay=false;const o=author({read:async q=>{if(delay){delay=false;entered.resolve();await gate.promise;}return packet(q);}});o.begin('seed',height());await o.refresh();await o.escape('seed');const before=o.snapshot;
 o.begin('next',height(8,64));delay=true;const pending=o.refresh();await entered.promise;await o.escape('next');assert.equal(o.snapshot.basis,before.basis);gate.resolve();assert.equal((await pending).basis,before.basis);assert.equal(o.snapshot.basis,before.basis);assert.deepEqual(o.snapshot.ground,before.ground);
});
test('new gesture and Escape during a pinned checkpoint replace replay without freezing its prefix',async()=>{
 const gate=deferred(),entered=deferred();let first=true;const o=author({read:async q=>{if(q.prefix===1&&first){first=false;entered.resolve();await gate.promise;}return packet(q);}});o.begin('closed',height());const closed=o.close('closed');await entered.promise;o.begin('next',height(16));const escape=o.escape('next');gate.resolve();await Promise.all([closed,escape]);assert.equal(o.journal.prefix,1);assert.equal(o.journal.frozen,false);assert.equal(o.snapshot.prefix,1);assert.equal(o.snapshot.active,null);assert.equal(o.active,null);
});

test('owner validates lattice inventory before cloning and rejects malformed checkpoint without prefix release',async()=>{
 assert.throws(()=>author({lattices:Array.from({length:33},(_,id)=>({id,x:0,y:0,dx:1,dy:1}))}),/prüfen/);
 for(const corrupt of[v=>{v.coverage.complete=false;},v=>{v.pages[1].values=v.pages[0].values;}]){
  const o=author({read:async q=>{const v=packet(q);corrupt(v);return v;}});o.begin('a',height());await assert.rejects(o.close('a'),/prüfen/);assert.equal(o.journal.prefix,0);assert.equal(o.journal.size,1);assert.equal(o.snapshot.ground.length,0);
 }
});

test('many active updates during one read share one Latest completion instead of queuing replays',async()=>{
 const gate=deferred(),entered=deferred();let reads=0;const o=author({read:async q=>{if(++reads===1){entered.resolve();await gate.promise;}return packet(q);}});o.begin('latest',height());const task=o.refresh();await entered.promise;
 for(let n=0;n<200;n++){o.update('latest',height(8+n));assert.equal(o.refresh(),task);}
 gate.resolve();const firstSnapshot=await task;assert.equal(firstSnapshot.active.action.stroke.strength,8);assert.equal(o.active.action.stroke.strength,207);assert.equal((await o.refresh()).active.action.stroke.strength,207);assert(reads<=4,'one finite capture followed by exactly the newest initial/active read');assert.equal(o.snapshot.ground[0].values[32*65+32],100+207*.125);
});

for(const order of['write-before-read','read-before-write'])test(`failed own-source read waits for its overlapping Ack: ${order}`,async()=>{
 const readEntered=deferred(),readGate=deferred(),readRejected=deferred(),writeEntered=deferred(),ackGate=deferred();let canonical=0,writes=0,first=true;
 const o=author({read:async q=>{if(first){first=false;readEntered.resolve();await readGate.promise;if(q.revision!==canonical){readRejected.resolve();throw Error('Autorenquelle inzwischen geändert.');}}assert.equal(q.revision,canonical);return packet(q);},write:async()=>{writes++;canonical=1;writeEntered.resolve();await ackGate.promise;return{ack:{commandId:'c1',revision:1,sourceFence:'f1'},receipt:{commandId:'c1',fingerprint:'r1'}};},replay:async input=>({ground:input.initial.ground,basis:input.initial.pages,bands:[]})});
 o.begin('one',height());const close=o.close('one');close.catch(()=>{});const entry=o.journal.entries[0],bytes=JSON.stringify(entry);let preview;
 if(order==='write-before-read'){await writeEntered.promise;preview=o.refresh();}else{preview=o.refresh();await readEntered.promise;await writeEntered.promise;}
 await readEntered.promise;let settled=false;preview.then(()=>{settled=true;},()=>{settled=true;});readGate.resolve();await readRejected.promise;await new Promise(setImmediate);
 assert.equal(settled,false,'failed bound read is held until the actual own Ack');assert.equal(o.journal.entries[0],entry);assert.equal(JSON.stringify(entry),bytes);assert.equal(o.canonicalSource.revision,0);
 ackGate.resolve();await Promise.all([close,preview]);assert.equal(writes,1);assert.equal(o.failed,false);assert.equal(o.journal.prefix,1);assert.equal(o.journal.size,0);assert.deepEqual(o.canonicalSource,{token:'t',revision:1,fence:'f1'});assert.equal(o.snapshot.prefix,1);assert.equal(o.snapshot.source.revision,1);
});

test('an overlapping write without a valid Ack cannot replace or confirm the failed read',async()=>{
 const readEntered=deferred(),readGate=deferred(),writeEntered=deferred(),ackGate=deferred();let writes=0;
 const o=author({read:async()=>{readEntered.resolve();await readGate.promise;throw Error('Autorenquelle inzwischen geändert.');},write:async()=>{writes++;writeEntered.resolve();await ackGate.promise;throw Error('unknown write');}});
 o.begin('unknown',height());const close=o.close('unknown');close.catch(()=>{});const entry=o.journal.entries[0],preview=o.refresh();preview.catch(()=>{});await Promise.all([readEntered.promise,writeEntered.promise]);readGate.resolve();ackGate.resolve();const result=await Promise.allSettled([close,preview]);assert.equal(result[0].status,'rejected');assert.equal(writes,1);assert.equal(o.failed,true);assert.equal(o.journal.prefix,0);assert.deepEqual(o.journal.entries,[entry]);assert.equal(o.canonicalSource.revision,0);assert.equal(o.snapshot.prefix,0);
});

test('a real checkpoint read failure after the own Ack is not swallowed as stale',async()=>{
 const readEntered=deferred(),readGate=deferred(),writeEntered=deferred(),ackGate=deferred();let writes=0;
 const o=author({read:async q=>{if(q.revision===0){readEntered.resolve();await readGate.promise;throw Error('Autorenquelle inzwischen geändert.');}throw Error('real checkpoint disk failure');},write:async()=>{writes++;writeEntered.resolve();await ackGate.promise;return{ack:{commandId:'c1',revision:1,sourceFence:'f1'},receipt:{commandId:'c1',fingerprint:'r1'}};}});
 o.begin('disk',height());const close=o.close('disk');close.catch(()=>{});const entry=o.journal.entries[0],preview=o.refresh();preview.catch(()=>{});await Promise.all([readEntered.promise,writeEntered.promise]);readGate.resolve();ackGate.resolve();const result=await Promise.allSettled([close,preview]);assert.equal(result[0].status,'rejected');assert.match(String(result[0].reason),/real checkpoint disk failure/);assert.equal(writes,1);assert.equal(o.failed,true);assert.equal(o.journal.prefix,0);assert.deepEqual(o.journal.entries,[entry]);assert.equal(o.snapshot.prefix,0);
});

test('foreign-source retirement during overlapping read and write cannot adopt the late own Ack',async()=>{
 const readEntered=deferred(),readGate=deferred(),writeEntered=deferred(),ackGate=deferred();let writes=0;
 const o=author({read:async()=>{readEntered.resolve();await readGate.promise;throw Error('Autorenquelle inzwischen geändert.');},write:async()=>{writes++;writeEntered.resolve();await ackGate.promise;return{ack:{commandId:'c1',revision:1,sourceFence:'f1'},receipt:{commandId:'c1',fingerprint:'r1'}};}});
 o.begin('foreign',height());const close=o.close('foreign');close.catch(()=>{});const entry=o.journal.entries[0],preview=o.refresh();preview.catch(()=>{});await Promise.all([readEntered.promise,writeEntered.promise]);o.retire();readGate.resolve();ackGate.resolve();await Promise.allSettled([close,preview]);assert.equal(writes,1);assert.equal(o.failed,true);assert.equal(o.journal.prefix,0);assert.deepEqual(o.journal.entries,[entry]);assert.equal(o.canonicalSource.revision,0);assert.equal(o.snapshot.prefix,0);assert.equal(o.snapshot.ground.length,0);
});

test('a genuine read failure without an overlapping writer remains an error',async()=>{
 const o=author({read:async()=>{throw Error('read unavailable');}});o.begin('active',height());await assert.rejects(o.refresh(),/read unavailable/);assert.equal(o.active.id,'active');assert.equal(o.journal.size,0);assert.equal(o.snapshot.ground.length,0);
});


test('a finite replay stays valid through continued same-gesture updates but never relabels its immutable version',async()=>{
 const entered=deferred(),gate=deferred();let current,first=true;
 const o=author({replay:async input=>{if(first){first=false;current=input.current;entered.resolve();await gate.promise;}return replayTerrainAuthor(input);}});
 o.begin('continuous',height());const old=o.refresh();await entered.promise;
 for(let n=1;n<=24;n++){o.update('continuous',height(8+n));assert.equal(o.refresh(),old);assert.equal(current(),true);}
 gate.resolve();const finite=await old;assert.equal(finite.active.action.stroke.strength,8);assert.equal(o.active.action.stroke.strength,32);assert(Object.isFrozen(finite));
 o.update('continuous',height(40));assert.equal(finite.active.action.stroke.strength,8);const latest=await o.refresh();assert(latest.content>finite.content);assert.equal(latest.active.action.stroke.strength,40);assert.equal(finite.ground[0].values[32*65+32],101);
 await o.close('continuous');assert.equal(o.journal.prefix,1);assert.equal(o.journal.size,0);assert.equal(o.snapshot.active,null);assert.equal(o.snapshot.source.revision,1);
});


test('one finite replay reuses only its exact decoded initial query once without minting a read identity',async()=>{
 const queries=[],seen=[];const o=author({read:async q=>{queries.push(structuredClone(q));return packet(q);},replay:async input=>{
  const a=await input.load(structuredClone(input.active.action.stroke));seen.push({initial:input.initial,first:a});
  assert.equal(a,input.initial);assert.equal(a.query,input.initial.query);assert.equal(queries.length,1);
  const b=await input.load(structuredClone(input.active.action.stroke));assert.notEqual(b,a);assert.equal(b.query.request,a.query.request+1);assert.equal(queries.length,2);
  const changed=structuredClone(input.active.action.stroke);changed.samples[1].x+=1;const c=await input.load(changed);assert.notDeepEqual(c.query.box,a.query.box);assert.equal(queries.length,3);
  return{ground:input.initial.ground,basis:input.initial.pages,bands:[]};}});
 o.begin('one',height());await o.refresh();assert.equal(seen.length,1);assert.equal(o.failed,false);
});

test('initial seed reuse misses a different box and cannot cross an author window or source invalidation',async()=>{
 let calls=0,first=true,release,entered;const gate=new Promise(r=>entered=r),lattices=[{id:2,x:0,y:0,dx:2,dy:2}];
 const o=author({read:async q=>{calls++;return packet(q);},replay:async input=>{
  if(first){first=false;const changed=structuredClone(input.active.action.stroke);changed.radius*=2;const other=await input.load(changed);assert.notEqual(other,input.initial);assert.notEqual(other.query.pixel,input.initial.query.pixel);entered();await new Promise(r=>release=r);await assert.rejects(input.load(input.active.action.stroke),/ersetzt/);return{ground:input.initial.ground,basis:input.initial.pages,bands:[]};}
  const same=await input.load(structuredClone(input.active.action.stroke));assert.equal(same,input.initial);assert.deepEqual(same.query.lattices,lattices);return{ground:input.initial.ground,basis:input.initial.pages,bands:[]};}});
 o.begin('window',height());const old=o.refresh();await gate;const next=o.changeLattices(lattices);release();await Promise.all([old,next]);assert.deepEqual(o.snapshot.ground[0].lattice,lattices[0]);assert.equal(calls,3);
 const sourceOwner=author({replay:async input=>{sourceOwner.retire();await assert.rejects(input.load(input.active.action.stroke),/ersetzt/);return{ground:input.initial.ground,basis:input.initial.pages,bands:[]};}});sourceOwner.begin('source',height());await sourceOwner.refresh();assert.equal(sourceOwner.failed,true);
});
