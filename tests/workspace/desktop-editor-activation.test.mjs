import { sourceFunctions } from '../helpers/source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
const source = readFileSync('src/app/workspace/renderer.ts', 'utf8');
const activation = sourceFunctions(source, ['activate', 'drainActivation']);
const boundaries = sourceFunctions(source, ['flushAll', 'leaveCampaign', 'leaveWorkspace']);
buildSync({
  stdin: {
    resolveDir: process.cwd(),
    loader: 'ts',
    contents: `
import {EditorSession} from './src/app/shared/editor-session';
import {EditorRegistry} from './src/app/shared/editor-registry';
export function fixture({failures=0,empty=false}={}){
 const session=new EditorSession(),controls=new Map(),main={inert:false},header={inert:false},nav={inert:false};
 const document={querySelector:id=>({main,header,nav})[id]},el=id=>{if(!controls.has(id))controls.set(id,{value:'',textContent:'',dataset:{}});return controls.get(id);};
 let workspace=empty?null:{token:'A',campaign:{id:'A',name:'A'}},activationIntent=0,queuedActivation=null,activationJob=null,activating=false,activationFailed=false;
 let allowed=true,paused=0,shellHook=null;const attempts=[],messages=[];
 if(empty)session.deactivate();
 const registry=new EditorRegistry([{id:'writer',session,flush:()=>allowed&&session.capture()(),activate:{order:0,run:()=>session.generation++},deactivate:()=>{paused++;},suspendBeforeActivation:true}]);
 const editors={flush:(reason)=>registry.flush(reason),activate:w=>registry.activate(w),deactivate:()=>registry.deactivate(),suspend:()=>registry.suspend()};
 const api={activateShell:async id=>{attempts.push(id);if(shellHook)return shellHook(id);if(failures-->0)return{ok:false,error:'held source unavailable'};return{ok:true,value:{token:id}};},workspaceInitial:async token=>({ok:true,value:{token,campaign:{id:token,name:token}}})};
 const unwrap=r=>{if(!r.ok)throw Error(r.error);return r.value;},status=(text,error)=>messages.push({text,error}),rememberView=()=>{},geometryOnly=w=>w,setWorkspaceAvailable=()=>{},setDraft=async()=>{},renderList=()=>{},updateHistory=()=>{},viewStorage={},readWorkspaceView=()=>({tab:'atlas',scrollY:0}),reopenView=async()=>{},preparationHasDrafts=()=>false,roomDraftReadFailed=false,draft=null,selected=()=>null;
 const roomEditor={setDraft,renderList,updateHistory,saved:true};
 ${boundaries}
 ${activation}
 return{activate,session,main,attempts,messages,allow:v=>allowed=v,shell:fn=>shellHook=fn,state:()=>({workspace,activationFailed,paused})};
}`,
  },
  outfile: '.build/editor-activation-tests.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { fixture } = createRequire(import.meta.url)('../../.build/editor-activation-tests.cjs');
const tick = () => new Promise((resolve) => setImmediate(resolve));
test('a failed campaign load remains read-only but can retry the drained source session', async () => {
  const x = fixture({ failures: 1 }),
    old = x.session.capture();
  await x.activate('B');
  assert.equal(x.state().activationFailed, true);
  assert.equal(x.main.inert, true);
  assert.equal(x.session.status.attached, true);
  assert.equal(x.state().workspace.token, 'A');
  await x.activate('B');
  assert.equal(x.state().activationFailed, false);
  assert.equal(x.main.inert, false);
  assert.equal(x.state().workspace.token, 'B');
  assert.deepEqual(x.attempts, ['B', 'B']);
  assert.equal(old(), false);
});
test('a refused source drain neither detaches editors nor silences native output', async () => {
  const x = fixture();
  x.allow(false);
  await x.activate('B');
  assert.deepEqual(x.attempts, []);
  assert.equal(x.state().paused, 0);
  assert.equal(x.session.status.attached, true);
  assert.equal(x.main.inert, false);
  assert.equal(x.state().workspace.token, 'A');
});
test('a newer queued campaign owns the only new editor activation', async () => {
  const x = fixture();
  let release;
  const held = new Promise((resolve) => (release = resolve));
  x.shell((id) => (id === 'B' ? held : { ok: true, value: { token: id } }));
  const first = x.activate('B');
  await tick();
  const second = x.activate('C');
  assert.equal(first, second);
  assert.equal(x.session.generation, 0);
  release({ ok: true, value: { token: 'B' } });
  await first;
  assert.deepEqual(x.attempts, ['B', 'C']);
  assert.equal(x.state().workspace.token, 'C');
  assert.equal(x.session.generation, 2);
});
test('opening after removal of the old workspace does not flush detached editors', async () => {
  const x = fixture({ empty: true });
  await x.activate('B');
  assert.equal(x.state().workspace.token, 'B');
  assert.equal(x.state().activationFailed, false);
  assert.equal(x.main.inert, false);
});
