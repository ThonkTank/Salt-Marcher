import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
buildSync({stdin:{contents:"export * from './src/app/editor-session'; export * from './src/app/editor-registry';",resolveDir:process.cwd()},outfile:'.build/editor-session-tests.cjs',bundle:true,platform:'node',format:'cjs'});
const {EditorSession,EditorRegistry}=require('../.build/editor-session-tests.cjs');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('dispatch is registered before synchronous bridge failure; unresolved command survives detachment',async()=>{
 const session=new EditorSession(),command=session.command();command.value={commandId:'original',raw:'not a number'};
 let attempts=0;const task=session.run(async()=>{attempts++;assert.equal(session.status.saving,true);throw Error('lost answer');});
 assert.equal(attempts,0);assert.equal(session.status.saving,true);
 await assert.rejects(task,/lost answer/);session.deactivate();await session.settle();
 assert.equal(session.status.saving,false);assert.equal(session.status.unresolvedCommand,true);
 assert.deepEqual(command.value,{commandId:'original',raw:'not a number'});assert.equal(attempts,1);
 command.value=null;assert.equal(session.status.unresolvedCommand,false);
});

test('deactivation cancels reads and previews but drains an accepted write to its real completion',async()=>{
 const session=new EditorSession(),read=session.read(),held=deferred(),slot=session.operation();
 let accepted=0,settled=false,paint=0;const current=session.capture();
 slot.value=session.run(async()=>{accepted++;await held.promise;if(current())paint++;return true;});
 await tick();session.deactivate();slot.value=null;
 const drain=session.settle().then(()=>{settled=true;});await tick();
 assert.equal(read.signal.aborted,true);assert.equal(read.current(),false);assert.equal(accepted,1);assert.equal(settled,false);
 held.resolve();await drain;assert.equal(paint,0);assert.equal(settled,true);
});

test('old settlement cannot clear a newer operation, including a same-context replacement',async()=>{
 const session=new EditorSession(),slot=session.operation(),old=deferred(),next=deferred();
 slot.value=old.promise;session.generation++;slot.value=next.promise;old.resolve(false);await tick();
 assert.equal(slot.value,next.promise);assert.equal(session.status.saving,true);
 slot.clear(old.promise);assert.equal(slot.value,next.promise);
 next.resolve(true);await session.settle();assert.equal(slot.value,null);
});

test('two simultaneous saves and input typed during persistence remain independent of domain adoption',async()=>{
 const session=new EditorSession(),first=deferred(),second=deferred();let raw='invalid 1',retained=null,adopted=null;
 session.observeDraft(()=>({openInput:raw!==retained,retainedDraft:retained!==null,unresolvedCommand:false}));
 session.input.version++;const revision=session.input.version,sent=raw;
 const keep=session.run(async()=>{await first.promise;retained=sent;session.input.retained=revision;});
 const other=session.run(()=>second.promise);raw='still invalid 2';session.input.version++;
 first.resolve();await keep;
 assert.equal(session.status.openInput,true);assert.equal(session.status.retainedDraft,true);assert.equal(session.status.saving,true);assert.equal(adopted,null);
 second.resolve();await other;await session.settle();assert.equal(session.status.openInput,true);
 // Rehydration preserves invalid bytes without implying adoption.
 const fresh=new EditorSession();raw=retained;
 fresh.observeDraft(()=>({openInput:false,retainedDraft:raw!==null,unresolvedCommand:false}));
 assert.equal(raw,'invalid 1');assert.equal(fresh.status.retainedDraft,true);assert.equal(adopted,null);
});

test('repeated A/B/A contexts never revive old leases, even with identical domain IDs',()=>{
 const session=new EditorSession(),a=session.capture();session.generation++;const b=session.capture();
 session.deactivate();session.generation++;const again=session.capture();
 assert.equal(a(),false);assert.equal(b(),false);assert.equal(again(),true);
 const read=session.read();read.finish();session.deactivate();assert.equal(read.current(),false);
});

test('registry preserves order, stops on refusal, and passes explicit transition reasons',async()=>{
 const calls=[],registry=new EditorRegistry(['one','two','three'].map(id=>({id,flush:reason=>{calls.push([id,reason]);return id!=='two';}})));
 for(const reason of ['checkpoint','navigation','campaign','close']){calls.length=0;assert.equal(await registry.flush(reason),false);assert.deepEqual(calls,[['one',reason],['two',reason]]);}
 await assert.rejects(registry.flush('navigation',['missing']),/Unregistered/);
 assert.throws(()=>new EditorRegistry([{id:'same'},{id:'same'}]),/Duplicate/);
});

test('registry activation order differs from flush order; read-only observers have no session',async()=>{
 const calls=[],session=new EditorSession(),registry=new EditorRegistry([
  {id:'writer',session,activate:{order:2,run:async c=>calls.push(['writer',c])},flush:()=>true},
  {id:'view',activate:{order:1,run:c=>calls.push(['view',c])}},
 ]);
 await registry.activate('campaign');assert.deepEqual(calls,[['view','campaign'],['writer','campaign']]);
 assert.equal(registry.status.length,1);registry.deactivate();assert.equal(session.status.attached,false);
});

test('drain waits for a detached job before the domain owner decides whether leaving is safe',async()=>{
 const session=new EditorSession(),slot=session.operation(),held=deferred();let confirmed=false;
 slot.value=held.promise.then(result=>{confirmed=result;return result;});slot.value=null;
 const calls=[],registry=new EditorRegistry([{id:'writer',session,flush:()=>confirmed},{id:'after',flush:()=>{calls.push('after');return true;}}]);
 const drain=registry.flush('close');await tick();assert.deepEqual(calls,[]);held.resolve(false);
 assert.equal(await drain,false);assert.deepEqual(calls,[]);
});

test('new input in an earlier editor is drained again before the later save permits navigation',async()=>{
 const held=deferred(),calls=[];let raw='first',saved='',late=true;
 const registry=new EditorRegistry([
  {id:'first',flush:()=>{calls.push(raw);saved=raw;return true;}},
  {id:'later',flush:async()=>{if(late){late=false;await held.promise;}return true;}},
 ]);
 const drain=registry.flush('campaign');await tick();raw='typed during another save';registry.changed();held.resolve();
 assert.equal(await drain,true);assert.equal(saved,raw);assert.deepEqual(calls,['first','typed during another save']);
});

test('a superseded boundary cannot flush the new context or claim that the old navigation succeeded',async()=>{
 const held=deferred();let later=0;
 const registry=new EditorRegistry([{id:'first',flush:()=>held.promise},{id:'later',flush:()=>{later++;return true;}}]);
 const drain=registry.flush('navigation');await tick();registry.deactivate();await registry.activate('new');held.resolve(true);
 assert.equal(await drain,false);assert.equal(later,0);
});

test('the matching confirmed writer can release its drain before entering a navigation callback',async()=>{
 const session=new EditorSession(),slot=session.operation(),registry=new EditorRegistry([{id:'writer',session,flush:()=>true}]);
 let committed=0;
 const task=session.run(async()=>{committed++;slot.clear(task);return registry.flush('navigation');});
 slot.value=task;assert.equal(await task,true);assert.equal(committed,1);
});

test('immediate dispatch reserves the accepted task before starting the first raw draft write',async()=>{
 const session=new EditorSession(),held=deferred();let calls=0;
 const task=session.start(()=>{calls++;assert.equal(session.status.saving,true);return held.promise;});
 assert.equal(calls,1);session.deactivate();let done=false;const drain=session.settle().then(()=>done=true);await tick();assert.equal(done,false);
 held.resolve(true);assert.equal(await task,true);await drain;
 const failed=session.start(()=>{assert.equal(session.status.saving,true);throw Error('synchronous bridge failure');});
 await assert.rejects(failed,/synchronous bridge failure/);await session.settle();assert.equal(session.status.saving,false);
});
