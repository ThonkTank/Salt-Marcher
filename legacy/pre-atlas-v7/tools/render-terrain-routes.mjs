import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=process.cwd(),out=root+'/.build/terrain-routes-prototype';await mkdir(out,{recursive:true});
await build({entryPoints:['tools/terrain-routes-prototype.ts'],outfile:out+'/app.js',bundle:true,platform:'browser',format:'iife'});
await writeFile(out+'/index.html',`<!doctype html><html lang="de"><meta charset="utf-8"><title>Straßen und Flüsse · Vergleich</title>
<style>html,body{margin:0;height:100%;background:#eee9dc;color:#283a2e;font:16px system-ui}body{display:grid;grid-template-rows:70px minmax(0,1fr)}header{padding:14px 24px}button{padding:8px 18px;margin-left:10px}main{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 20px 20px;min-height:0}section{display:grid;grid-template-rows:34px minmax(0,1fr);min-height:0}canvas{width:100%;height:100%;min-height:0;border:1px solid #aaab93}</style>
<header><strong>Hangstraße · Fluss · Tunnel · Brücke · Furt</strong><button id="top">Draufsicht</button><button id="tilt">Kippen</button></header>
<main><section><strong>Ungeplante Linien</strong><canvas></canvas></section><section><strong>Geplante Verläufe mit Geländeform</strong><canvas></canvas></section></main><script src="app.js"></script></html>`);
await writeFile(out+'/main.cjs',`const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{const w=new BrowserWindow({width:1500,height:950,webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false}});w.loadFile(__dirname+'/index.html');});app.on('window-all-closed',()=>app.quit());`);
const {_electron}=createRequire(import.meta.url)('playwright-core');
const app=await _electron.launch({executablePath:root+'/node_modules/electron/dist/electron',args:[out+'/main.cjs','--ozone-platform=x11']});
const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.waitForFunction(()=>document.body.dataset.ready==='true',null,{timeout:60000});
 for(const mode of ['top','tilt']){await page.locator('#'+mode).click();await page.screenshot({path:out+'/'+mode+'.png'});}
 const data=await page.evaluate(()=>window.routeProbe.read());assert.equal(data.length,5);assert.deepEqual(errors,[]);
 await writeFile(out+'/result.json',JSON.stringify({data,errors},null,2));
 const exit=new Promise(resolve=>app.process().once('exit',(code,signal)=>resolve({code,signal})));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());assert.deepEqual(await exit,{code:0,signal:null});
 console.log(out);
}finally{await app.close();}
