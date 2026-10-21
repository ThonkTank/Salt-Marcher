import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createNativeSession} from './native-session.mjs';
import {atlasCanvasReady} from './atlas-canvas-probe.mjs';
const root=process.cwd(),require=createRequire(import.meta.url);
require('esbuild').buildSync({entryPoints:['src/app/storage/store.ts'],outfile:'.build/campaign-trash-store.cjs',bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore}=require(root+'/.build/campaign-trash-store.cjs'),Database=require('better-sqlite3');
const native=await createNativeSession({root,output:process.env.QA_EVIDENCE_DIR??root+'/.build/campaign-trash',name:'campaign-trash'});
const store=new CampaignStore(native.profile+'/workbench.sqlite');
const room=name=>({id:randomUUID(),scopeId:'local',floorId:'ground',number:'1',name,revision:0,polygons:[{outer:[{x:0,y:0},{x:6,y:0},{x:6,y:6},{x:0,y:6}],holes:[]}],sections:[{id:randomUUID(),kind:'markdown',markdown:'Unveränderter Schlüssel: '+name+'\r\nGeheimer Ausgang.'}]});
const a=store.create('Nordmark',[room('Torhalle')]),b=store.create('Nordmark',[room('Bibliothek')]);
store.campaignCatalog({commandId:randomUUID(),kind:'open',id:b.id});store.tutorial('skipped');store.close();
const db=new Database(native.profile+'/workbench.sqlite',{readonly:true});
const active=()=>db.prepare("SELECT value FROM settings WHERE key='active'").get()?.value??null;
const rooms=()=>db.prepare('SELECT * FROM room ORDER BY campaign_id,id').all(),before=rooms();
const usage=()=>db.prepare('SELECT * FROM campaign_usage ORDER BY campaign_id').all(),usageBefore=usage();
const record=id=>db.prepare('SELECT c.*,l.trashed FROM campaign c JOIN campaign_lifecycle l ON l.campaign_id=c.id WHERE c.id=?').get(id);
let page;
const card=id=>page.locator('#campaign-screen-list [data-campaign-id="'+id+'"]');
async function start(){page=await native.launch();await page.locator('.campaign-card').first().waitFor();assert.equal(await page.locator('#campaign-screen').isVisible(),true);}
async function edit(id){await card(id).getByRole('button',{name:'Bearbeiten…',exact:true}).click();await page.locator('#campaign-identity-name').waitFor();}
try{
 await start();assert.equal(await page.locator('#campaign-screen-list .campaign-card').count(),2);assert.match(await card(b.id).innerText(),/aktiv/);assert.match(await card(a.id).innerText(),new RegExp(a.id));
 await native.capture(page,'01-duplicate-identities');
 // An abandoned rename must not change either the stored name or the next draft.
 await edit(b.id);await page.locator('#campaign-identity-name').fill('Nicht speichern');await page.locator('#campaign-identity-name').press('Escape');
 await edit(b.id);assert.equal(await page.locator('#campaign-identity-name').inputValue(),'Nordmark');await page.locator('#campaign-identity-name').press('Escape');assert.equal(record(b.id).name,'Nordmark');
 // Search by the visible identity, then trash precisely the active duplicate.
 await page.locator('#campaign-screen-search').fill(b.id);assert.equal(await page.locator('#campaign-screen-list .campaign-card').count(),1);
 await edit(b.id);await page.locator('#campaign-identity-trash').click();await page.waitForFunction(()=>document.querySelector('#campaign-trash-open').textContent==='Papierkorb (1)');
 assert.equal(active(),null);assert.equal(record(b.id).trashed,1);assert.equal(record(a.id).trashed,0);assert.deepEqual(rooms(),before);assert.deepEqual(usage(),usageBefore);
 await page.locator('#campaign-trash-open').click();await page.locator('#campaign-trash-search').fill(b.id);const trashed=page.locator('#campaign-trash-list [data-campaign-id="'+b.id+'"]');assert.match(await trashed.innerText(),new RegExp(b.id));
 await native.capture(page,'02-trash');
 // A wrong deletion confirmation is rejected by Main; Escape returns to trash.
 await trashed.getByRole('button',{name:'Dauerhaft löschen…',exact:true}).click();await page.locator('#campaign-delete-name').fill('nordmark');await page.locator('#campaign-delete-form').getByRole('button',{name:'Dauerhaft löschen',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#campaign-delete-status').textContent.includes('exakten Namen'));
 assert.equal(record(b.id).trashed,1);assert.deepEqual(rooms(),before);await page.locator('#campaign-delete-name').press('Escape');assert.equal(await page.locator('#campaign-trash-dialog').isVisible(),true);
 await trashed.getByRole('button',{name:'Wiederherstellen',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#campaign-trash-count').textContent==='0 von 0 Kampagnen im Papierkorb');
 assert.equal(await page.locator('#campaign-trash-dialog').isVisible(),true);assert.equal(active(),null);assert.equal(record(b.id).trashed,0);assert.deepEqual(rooms(),before);assert.deepEqual(usage(),usageBefore);
 await native.capture(page,'03-restored-without-activation');await page.locator('#campaign-trash-close').click();
 await page.locator('#campaign-screen-search').fill(a.id);await edit(a.id);await page.locator('#campaign-identity-name').fill('Nordmark Archiv');await page.locator('#campaign-identity-form').getByRole('button',{name:'Speichern',exact:true}).click();await page.locator('#campaign-identity-dialog').waitFor({state:'hidden'});
 assert.equal(record(a.id).name,'Nordmark Archiv');assert.equal(record(b.id).name,'Nordmark');assert.equal(active(),null);assert.deepEqual(usage(),usageBefore);await native.close();
 await start();assert.equal(active(),null);assert.equal(await page.getByRole('button',{name:'Fortsetzen',exact:true}).count(),0);
 await page.locator('#campaign-screen-search').fill(b.id);await card(b.id).getByRole('button',{name:'Öffnen',exact:true}).click();await page.waitForFunction(()=>document.body.classList.contains('has-workspace')&&!document.querySelector('main').inert);
 assert.equal(active(),b.id);assert.deepEqual(rooms(),before);
 if(await page.locator('#campaign-atlas').isHidden()){if(!await page.locator('#atlas-tab').isVisible())await page.locator('#workspace-nav-summary').click();await page.locator('#atlas-tab').click();}
 await atlasCanvasReady(page);await page.locator('#atlas-search').fill('Bibliothek');await page.locator('#atlas-search-results button').filter({hasText:'Bibliothek'}).click();await atlasCanvasReady(page);assert.equal(await page.locator('#campaign-header-name').textContent(),'Nordmark');
 await native.capture(page,'04-explicitly-reopened');await native.close();
 await start();assert.match(await card(b.id).innerText(),/aktiv/);assert.equal(await card(b.id).getByRole('button',{name:'Fortsetzen',exact:true}).count(),1);assert.equal(record(a.id).name,'Nordmark Archiv');assert.match(await card(a.id).innerText(),/Nordmark Archiv/);assert.deepEqual(rooms(),before);await native.close();
 await native.finish({checks:['duplicate identities and identity search','cancelled rename discarded and explicit rename survives restart','active trash clears active pointer without replacement','wrong permanent-delete confirmation preserves data','restore preserves identity/content/usage without activation','fresh explicit opening and startup remain separate']});
}catch(error){await native.fail(error);throw error;}finally{db.close();await native.dispose();}
