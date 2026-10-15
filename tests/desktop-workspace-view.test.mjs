import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
buildSync({entryPoints:['src/app/workspace-view.ts'],outfile:'.build/workspace-view.cjs',bundle:true,platform:'node',format:'cjs'});
const {workspaceTabs,readWorkspaceView,rememberWorkspaceView}=require('../.build/workspace-view.cjs');
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
test('navigation survives a new reader and stays separate for each campaign',()=>{
 const storage=memory();rememberWorkspaceView(storage,'A',{tab:'live',scrollY:643});rememberWorkspaceView(storage,'B',{tab:'preparation',scrollY:91});
 assert.deepEqual(readWorkspaceView(storage,'A'),{tab:'live',scrollY:643});assert.deepEqual(readWorkspaceView(storage,'B'),{tab:'preparation',scrollY:91});assert.deepEqual(readWorkspaceView(storage,'C'),{tab:'atlas',scrollY:0});
 for(const tab of workspaceTabs){rememberWorkspaceView(storage,'B',{tab,scrollY:0});assert.equal(readWorkspaceView(storage,'B').tab,tab);}
});
for(const value of ['bad','null','{}','{"tab":"deleted","scrollY":12}','{"tab":"live","scrollY":-1}','{"tab":"live","scrollY":1e99}'])test('unusable local preference falls back without blocking: '+value,()=>{assert.deepEqual(readWorkspaceView({getItem:()=>value},'A'),{tab:'atlas',scrollY:0});});
test('unavailable preferences never prevent campaign content operations',()=>{const storage={getItem(){throw Error('denied');},setItem(){throw Error('quota');}};assert.deepEqual(readWorkspaceView(storage,'A'),{tab:'atlas',scrollY:0});assert.doesNotThrow(()=>rememberWorkspaceView(storage,'A',{tab:'live',scrollY:0}));});
