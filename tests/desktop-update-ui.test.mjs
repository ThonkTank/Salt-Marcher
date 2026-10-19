import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),tick=()=>new Promise(r=>setImmediate(r));
test('update UI keeps install behind successful editor flush and unsubscribes',async t=>{
 await build({entryPoints:['src/app/update-ui.ts'],outfile:'.build/update-ui.test.cjs',bundle:true,platform:'node',format:'cjs'});
 const {window,document}=parseHTML('<html><body><header></header></body></html>'),oldWindow=globalThis.window,oldDocument=globalThis.document;
 globalThis.window=window;globalThis.document=document;t.after(()=>{globalThis.window=oldWindow;globalThis.document=oldDocument;});
 let allowed=false,installs=0,flushes=0,unsubscribed=false;
 const state={phase:'ready',currentVersion:'1.0.0',automatic:true,lastChecked:null,available:{version:'1.0.1',notes:'<script>must remain text</script>'},received:100,total:100,message:'Bereit'};
 window.campaign={updateStatus:async()=>({ok:true,value:state}),updateInstall:async()=>{installs++;return{ok:true,value:undefined};},onUpdate:()=>()=>{unsubscribed=true;}};
 require('../.build/update-ui.test.cjs').initUpdateUI(async()=>{flushes++;return allowed;});await tick();
 assert.equal(document.querySelector('#updates-notes script'),null);
 document.querySelector('#updates-install').click();await tick();assert.equal(flushes,1);assert.equal(installs,0);assert.match(document.querySelector('#updates-message').textContent,/Abschluss/);
 allowed=true;document.querySelector('#updates-install').click();await tick();assert.equal(installs,1);
 window.dispatchEvent(new window.Event('unload'));assert.equal(unsubscribed,true);
});
