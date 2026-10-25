import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from './helpers/dom.mjs';
buildSync({entryPoints:['src/app/graph-ui.ts'],outfile:'.build/review-retention-graph-ui.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url);
for(const phase of ['graph','raster'])test('leaving a protected '+phase+' preview requires explicit resolution while editor flushing stays available',async t=>{
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),old={window:globalThis.window,document:globalThis.document};Object.assign(globalThis,{window,document});t.after(()=>Object.assign(globalThis,old));
 delete require.cache[require.resolve('../.build/review-retention-graph-ui.cjs')];const ui=require('../.build/review-retention-graph-ui.cjs'),messages=[];
 let workspace={campaign:{id:'campaign'},token:'activation',graphPreview:{id:'preview',revision:1,scopeId:'scope',phase,protected:true}};
 ui.initGraph((...args)=>messages.push(args),()=>workspace,()=>null,async()=>true,async next=>{workspace=next;},()=>{},async()=>{});ui.syncGraphBanner(workspace);
 assert.equal(await ui.flushGraph(),true,'internal editing must remain possible');assert.equal(ui.canLeaveGraphPreview(),false);assert.match(messages.at(-1)[0],/übernehmen.*Ursprung vollständig wiederherstellen/);assert.equal(messages.at(-1)[1],true);assert.equal(document.getElementById('graph-preview-banner').hidden,false);assert.equal(document.getElementById('graph-accept').disabled,phase!=='raster');assert.ok(workspace.graphPreview);
 workspace={...workspace,graphPreview:undefined};ui.syncGraphBanner(workspace);assert.equal(await ui.flushGraph(),true);assert.equal(ui.canLeaveGraphPreview(),true);assert.equal(document.getElementById('graph-preview-banner').hidden,true);
});
