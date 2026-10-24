import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,mkdir,cp,readFile,writeFile,realpath} from 'node:fs/promises';
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import path from 'node:path';
const require=createRequire(import.meta.url),{_electron,chromium}=require('playwright-core');
const base=path.resolve(process.argv[2]??'.build/update-native-base');
const activeWorkspace=process.argv.includes('--workspace'),forced=process.argv.includes('--force'),scenario=(activeWorkspace?'workspace':'start-screen')+(forced?'-forced':'');
const softwareGpu=process.argv.includes('--software-gpu');
const {schema}=JSON.parse(await readFile(path.join(base,'resources/app/build-info.json'),'utf8'));
const fixtureBase=path.resolve('.build/native-update-fixtures');await mkdir(fixtureBase,{recursive:true});
const temp=await mkdtemp(path.join(fixtureBase,'run-')),root=path.join(temp,'installation'),profile=path.join(temp,'custom-profile'),evidence=path.resolve(`.build/update-native-${scenario}-evidence.json`);
const {privateKey,publicKey}=generateKeyPairSync('ed25519'),publicPem=publicKey.export({type:'spki',format:'pem'}),commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
await build({entryPoints:['desktop/update-package.ts'],outfile:'.build/native-update-package.cjs',bundle:true,platform:'node',format:'cjs'});
await build({entryPoints:['src/app/storage/store.ts'],outfile:'.build/desktop/native-update-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {packUpdate,unpackUpdate}=require(path.resolve('.build/native-update-package.cjs')),{CampaignStore}=require(path.resolve('.build/desktop/native-update-store.cjs'));
async function version(v,debug=false){
 const dir=path.join(temp,'source-'+v);await cp(base,dir,{recursive:true});
 // CI has no physical GPU. Configure both test versions so the updater's
 // independently launched child uses the same explicit software WebGL backend.
 const switches=[...(softwareGpu?[['use-gl','angle'],['use-angle','swiftshader'],['enable-unsafe-swiftshader','']]:[]),...(debug?[['remote-debugging-port',String(port)]]:[])];
 const banner=switches.map(([name,value])=>`require('electron').app.commandLine.appendSwitch(${JSON.stringify(name)}, ${JSON.stringify(value)});`).join('\n');
 await build({entryPoints:['desktop/main.ts'],outfile:path.join(dir,'resources/app/main.cjs'),bundle:true,platform:'node',format:'cjs',external:['electron','better-sqlite3'],define:{__APP_VERSION__:JSON.stringify(v)},banner:{js:banner}});
 await writeFile(path.join(dir,'resources/app/update-public-key.pem'),publicPem);
 await writeFile(path.join(dir,'resources/app/build-info.json'),JSON.stringify({applicationVersion:v,commit,product:'saltmarcher-workbench',dataLine:'CampaignWorkbench',schema}));
 const archive=path.join(temp,`SaltMarcher-${v}-linux-x64.zip`),hashes=await packUpdate(dir,archive,v,commit);
 const manifest={format:1,product:'saltmarcher-workbench',dataLine:'CampaignWorkbench',version:v,commit,platform:'linux-x64',archive:path.basename(archive),...hashes,schema};
 const signed=Buffer.from(JSON.stringify(manifest)),signature=sign(null,signed,privateKey);
 return{dir,archive,manifest,signed,signature};
}
let app,browser,childPid,gpuRenderer=null;const errors=[];
try{
 const old=await version('90.0.0'),next=await version('90.0.1',true);
 const extracted=await unpackUpdate(old.archive,path.join(temp,'unpacked'),old.manifest);
 await writeFile(path.join(extracted,'saltmarcher-update.json'),old.signed);await writeFile(path.join(extracted,'saltmarcher-update.json.sig'),old.signature);
 // Seed a genuine database plus opaque local files and media before bootstrap.
 await mkdir(profile);let store=new CampaignStore(path.join(profile,'workbench.sqlite'),'90.0.0');const campaign=store.create('Update-Abend'),other=store.create('Inaktive Kampagne');const workspace=store.activate(campaign.id),command=action=>({commandId:randomUUID(),token:workspace.token,campaignId:campaign.id,action});const groupId=store.executeProgress(command({kind:'group-create',title:'Hafenwache',encounterId:null,expectedEncounterRevision:null})).groupId;const draft={writeId:randomUUID(),groupId,revision:1,title:'',notes:'Unfertige Notiz\r\nbleibt vollständig',locationId:null,actors:[]};store.keepGroupDraft(workspace.token,draft,null);const scene=store.executeLive(command({kind:'initialize',expectedRosterRevision:store.live(workspace.token).rosterRevision})).scene;const liveBefore=store.live(workspace.token);store.close();
 await mkdir(path.join(profile,'audio'));await writeFile(path.join(profile,'audio/retained.ogg'),'unchanged media');await writeFile(path.join(profile,'unfinished-notes.txt'),'Unfertiger Entwurf – unverändert');
 const env={...process.env,XDG_DATA_HOME:path.join(temp,'desktop-data')};
 execFileSync(path.join(extracted,'Installieren.sh'),[root,profile],{env,timeout:120000});
 const oldDir=await realpath(path.join(root,'current'));
 app=await _electron.launch({executablePath:path.join(oldDir,'electron'),args:['--data-dir',profile],env,timeout:45000});const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>document.body.dataset.tutorialReady==='true');if(await page.locator('#tutorial-dialog').isVisible())await page.locator('#tutorial-skip').click();
 if(activeWorkspace){
   await page.locator('.campaign-card[data-campaign-id="'+campaign.id+'"]').getByRole('button',{name:/^(Öffnen|Fortsetzen)$/}).click();
   await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
   await page.waitForFunction(()=>document.querySelector('#campaign-map')?.dataset.terrainReady==='ready',null,{timeout:60000});
   gpuRenderer=await page.evaluate(()=>{
     const gl=document.querySelector('#atlas-terrain-spatial canvas').getContext('webgl2');
     const debug=gl.getExtension('WEBGL_debug_renderer_info');
     return gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER);
   });
   if(softwareGpu)assert.match(gpuRenderer,/SwiftShader/i);
 }
 async function openUpdates(page){
   const trigger=await page.locator('body').evaluate(b=>b.classList.contains('atlas-workspace'))?'#atlas-navigation':'#application-trigger';
   await page.locator(trigger).click();await page.locator('#application-settings').click();await page.locator('#settings-updates').click();
   assert.equal(await page.locator('#preset-manager').evaluate(d=>d.open),false,'Settings must close before updates can leave the workspace');
   return trigger;
 }
 await app.evaluate(async(_,{archive,signed,signature,manifest})=>{
   const fs=process.getBuiltinModule('node:fs'),stream=process.getBuiltinModule('node:stream');
   globalThis.fetch=async url=>{
     if(String(url).includes('/releases?'))return new Response(JSON.stringify([{draft:false,prerelease:false,tag_name:'v'+manifest.version,body:'Native Testversion',assets:[{name:'saltmarcher-update.json'},{name:'saltmarcher-update.json.sig'},{name:manifest.archive}]}]));
     if(String(url).endsWith('.json.sig'))return new Response(Buffer.from(signature,'base64'));
     if(String(url).endsWith('.json'))return new Response(Buffer.from(signed,'base64'));
     if(String(url).endsWith('.zip'))return new Response(stream.Readable.toWeb(fs.createReadStream(archive)));
     throw new Error('Unexpected URL '+url);
   };
 },{archive:next.archive,signed:next.signed.toString('base64'),signature:next.signature.toString('base64'),manifest:next.manifest});
 const menuTrigger=await openUpdates(page);
 await page.locator('#updates-close').click();assert.equal(await page.locator(menuTrigger).evaluate(b=>document.activeElement===b),true);
 await openUpdates(page);
 await page.locator('#updates-check').click();await page.locator('#updates-download').waitFor({state:'visible'});
 assert.equal(await realpath(path.join(root,'current')),oldDir);
 await page.locator('#updates-download').click();await page.locator('#updates-install').waitFor({state:'visible',timeout:120000});
 await page.screenshot({path:path.resolve(`.build/update-native-${scenario}-ready.png`)});
 assert.equal(await page.locator('#updates-version').textContent(),'Installiert: 90.0.0 · Verfügbar: 90.0.1');
 // Recreate the original blocked-close condition behind Updates. Only this
 // diagnostic scenario reopens a clean editor; no real user profile is used.
 if(forced)await page.locator('#preset-manager').evaluate(d=>d.show());
 const immediateFeedback=await page.evaluate(()=>{
   document.querySelector('#updates-install').click();
   return{message:document.querySelector('#updates-message').textContent,progressVisible:!document.querySelector('#updates-progress').hidden,indeterminate:!document.querySelector('#updates-progress').hasAttribute('value'),disabled:document.querySelector('#updates-install').disabled};
 });
 assert.match(immediateFeedback.message,/Neustart wird vorbereitet/);
 assert(immediateFeedback.progressVisible&&immediateFeedback.indeterminate&&immediateFeedback.disabled);
 if(forced){
   await page.locator('#updates-force').waitFor({state:'visible'});
   assert.match(await page.locator('#updates-message').textContent(),/Installation nicht gestartet/);
   await page.locator('#updates-force').click();
   assert.equal(await page.locator('#updates-force-back').evaluate(b=>document.activeElement===b),true);
   await page.screenshot({path:path.resolve(`.build/update-native-${scenario}-confirmation.png`)});
   await page.locator('#updates-force-back').click();assert.equal(await realpath(path.join(root,'current')),oldDir);
   await page.locator('#updates-force').click();await page.locator('#updates-force-confirm').click({noWaitAfter:true});
 }
 for(let n=0;n<600;n++){
   const journal=await readFile(path.join(root,'.update-journal.json'),'utf8').then(JSON.parse,()=>null);if(journal?.childPid)childPid=journal.childPid;
   if(journal?.phase==='rolled-back')throw new Error('Update rolled back: '+journal.error);
   if(journal?.phase==='committed')break;
   await new Promise(r=>setTimeout(r,200));if(n===599)throw new Error('Update did not commit. '+JSON.stringify(journal));
 }
 browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);const restarted=browser.contexts()[0].pages().find(p=>p.url().startsWith('campaign://app/'));assert(restarted);
 await restarted.waitForFunction(()=>document.body.dataset.tutorialReady==='true');
 await openUpdates(restarted);
 await restarted.waitForFunction(()=>document.querySelector('#updates-version').textContent.includes('90.0.1'));
 assert.equal(await readFile(path.join(profile,'audio/retained.ogg'),'utf8'),'unchanged media');assert.equal(await readFile(path.join(profile,'unfinished-notes.txt'),'utf8'),'Unfertiger Entwurf – unverändert');
 await restarted.screenshot({path:path.resolve(`.build/update-native-${scenario}-restarted.png`)});
 // Close through the normal UI guard, not a force kill, then inspect SQLite.
 await restarted.evaluate(()=>{document.querySelector('#updates-close').click();window.campaign.closeReady();});
 for(let n=0;n<100;n++){try{process.kill(childPid,0);}catch{break;}await new Promise(r=>setTimeout(r,100));}
 store=new CampaignStore(path.join(profile,'workbench.sqlite'),'90.0.1');try{assert.deepEqual(store.list().campaigns.map(c=>c.id).sort(),[campaign.id,other.id].sort());const reopened=store.activate(campaign.id);assert.deepEqual(store.groupDraft(reopened.token,groupId),draft);assert.deepEqual(store.live(reopened.token),liveBefore);assert(scene.id);}finally{store.close();}
 const journal=JSON.parse(await readFile(path.join(root,'.update-journal.json'),'utf8'));assert.equal(journal.phase,'committed');assert.equal(await readFile(path.join(journal.backup,'audio/retained.ogg'),'utf8'),'unchanged media');assert.deepEqual(errors,[]);
 await writeFile(evidence,JSON.stringify({passed:true,from:'90.0.0',to:'90.0.1',profile,root,bootstrap:true,manualDownload:true,manualInstall:true,settingsNavigation:true,activeWorkspace,softwareGpu,gpuRenderer,forcedWithConfirmation:forced,immediateFeedback,normalRestart:true,customProfile:true,mediaAndCampaignsPreserved:true,unfinishedDraftAndLiveStatePreserved:true,backup:journal.backup},null,2));console.log('Native packaged update passed: '+evidence);
}finally{
 await browser?.close().catch(()=>{});await app?.close().catch(()=>{});
 if(childPid){try{const cmd=await readFile('/proc/'+childPid+'/cmdline','utf8');if(cmd.includes(profile))process.kill(childPid,'SIGKILL');}catch{}}
 // Keep the isolated fixture/evidence for diagnosis; never touch a real profile.
}
