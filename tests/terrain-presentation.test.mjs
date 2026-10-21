import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
buildSync({entryPoints:['src/app/terrain-presentation.ts'],outfile:'.build/terrain-presentation-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {TerrainPresentation,terrainSnapshotStillValid}=createRequire(import.meta.url)('../.build/terrain-presentation-test.cjs');
const identity=revision=>({revision,fence:'f'+revision});
const frame=revision=>({kind:'full',target:identity(revision),view:'top',layer:{},invalidation:{reset:false,bounds:[]}});
const tick=()=>new Promise(setImmediate);
test('slow display keeps one read and latest successor, publishing actual snapshot identities',async()=>{
 const requests=[],resolve=[],shown=[],errors=[];
 const display=new TerrainPresentation(source=>{requests.push(source);return new Promise(r=>resolve.push(r));},f=>shown.push(f.target),e=>errors.push(e));
 display.update(identity(1));for(let n=2;n<=100;n++)display.update(identity(n));
 assert.equal(requests.length,1);
 resolve.shift()(frame(1));await tick();
 assert.deepEqual(shown,[identity(1)],'older confirmed picture remains useful, never relabelled as 100');
 assert.deepEqual(requests,[identity(1),identity(100)]);
 // Main can open a newer committed snapshot than the caller knew about.
 resolve.shift()(frame(101));await tick();assert.deepEqual(shown,[identity(1),identity(101)]);assert.deepEqual(errors,[]);
 display.update(identity(102));display.stop();resolve.shift()(frame(102));await tick();
 assert.equal(shown.length,2,'late replies cannot redraw a closed gesture');
});
test('stale queued snapshots yield to latest confirmed input; terminal failures remain visible',async()=>{
 const rejects=[],errors=[],requests=[];
 const display=new TerrainPresentation(source=>{requests.push(source);return new Promise((_,r)=>rejects.push(r));},()=>assert.fail('no picture'),e=>errors.push(e.message));
 display.update(identity(1));display.update(identity(2));rejects.shift()(Error('Gelände inzwischen geändert'));await tick();
 assert.equal(requests.length,2);assert.deepEqual(errors,[]);
 rejects.shift()(Error('worker exited'));await tick();assert.deepEqual(errors,['worker exited']);
 display.update(identity(3));assert.equal(requests.length,3);
 display.stop();rejects.shift()(Error('late failure'));await tick();assert.equal(errors.length,1);
});
test('a reply older than requested cannot replace the shown frame',async()=>{
 const shown=[],display=new TerrainPresentation(async()=>frame(4),f=>shown.push(f),e=>{throw e;});
 display.update(identity(5));await tick();assert.deepEqual(shown,[]);
});

test('gesture finish presents the last confirmed successor before closing, while explicit stop still revokes it',async()=>{
 for(const cancel of [false,true]){
  const resolves=[],shown=[],display=new TerrainPresentation(()=>new Promise(r=>resolves.push(r)),f=>shown.push(f.target.revision),e=>{throw e;});
  display.update(identity(1));display.update(identity(2));let done=false;
  const finished=display.finish().then(()=>done=true);assert.equal(done,false);
  resolves.shift()(frame(1));await tick();assert.deepEqual(shown,[1]);assert.equal(done,false);
  if(cancel)display.stop();resolves.shift()(frame(2));await finished;
  assert.deepEqual(shown,cancel?[1]:[1,2]);display.update(identity(3));assert.equal(resolves.length,0);
 }
});

test('snapshot delivery tolerates later commits and receipt-only writes but rejects unversioned or foreign changes',()=>{
 const source={filename:'db',token:'t',campaignId:'c',epoch:'e',sequence:3,revision:7,fence:'a'};
 assert(terrainSnapshotStillValid(source,{...source,fence:'receipt'}));
 assert(terrainSnapshotStillValid(source,{...source,revision:8,sequence:4,fence:'b'}));
 for(const changed of [{revision:6},{sequence:4},{epoch:'other'},{token:'other'},{filename:'other'},{campaignId:'other'},{shadow:{epoch:'preview'}}])assert.equal(terrainSnapshotStillValid(source,{...source,...changed}),false);
});
