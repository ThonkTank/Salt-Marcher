import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {parseHTML} from 'linkedom';

buildSync({entryPoints:['src/app/campaign-manager-ui.ts'],outfile:'.build/campaign-transfer-ui.cjs',bundle:true,platform:'node',format:'cjs'});
const require=createRequire(import.meta.url);
const tick=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture(t,{unreadable=false}={}){
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),previous={window:globalThis.window,document:globalThis.document},memory=new Map(),messages=[],changes=[],calls=[];
 Object.assign(globalThis,{window,document});t.after(()=>Object.assign(globalThis,previous));
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};}
 let reads=0;window.localStorage={getItem:k=>{reads++;if(unreadable)throw Error('Auftragsvermerk nicht lesbar');return memory.get(k)??null;},setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const preview={ticket:'copy-ticket',name:'Original',copy:true,bytes:100,applicationVersion:'test',audioFiles:0,counts:[],conflicts:[],problems:[]};
 window.campaign={campaignOverview:async()=>{throw Error('Katalog nicht lesbar');},prepareCampaignCopy:async token=>{calls.push(['copy',token]);return{ok:true,value:preview};},cancelCampaignTransfer:async ticket=>{calls.push(['cancel',ticket]);return{ok:true};},onCampaignTransfer:()=>{}};
 delete require.cache[require.resolve('../.build/campaign-transfer-ui.cjs')];const ui=require('../.build/campaign-transfer-ui.cjs');
 ui.initCampaignManager((...a)=>messages.push(a),()=>({token:'source-token'}),async()=>true,async id=>changes.push(id));
 return{window,document,memory,messages,changes,calls,readable:()=>{unreadable=false;},reads:()=>reads,get:id=>document.getElementById(id)};
}
test('transfer opens and cancels its own copy preview even when the campaign catalog is unavailable',async t=>{
 const x=fixture(t);x.get('campaign-manager').onclick();await tick();assert.equal(x.get('campaign-manager-dialog').open,true);assert.deepEqual(x.messages,[]);
 x.get('campaign-copy').onclick();await tick();assert.equal(x.get('campaign-transfer-dialog').open,true);assert.equal(x.get('campaign-transfer-name').value,'Original – Kopie');assert.deepEqual(x.calls,[['copy','source-token']]);
 x.get('campaign-transfer-cancel').onclick();await tick();assert.equal(x.get('campaign-transfer-dialog').open,false);assert.deepEqual(x.calls.at(-1),['cancel','copy-ticket']);assert.deepEqual(x.changes,[]);assert.deepEqual(x.messages,[]);
});
test('an uncertain copy outcome is reconciled once without selecting a campaign or depending on another catalog read',async t=>{
 const x=fixture(t);let accepts=0,checks=0;
 x.window.campaign.acceptCampaignTransfer=async()=>{accepts++;throw Error('Antwort verloren');};
 x.window.campaign.campaignTransferStatus=async()=>{checks++;return{ok:true,value:checks===1?{state:'pending'}:{state:'applied',campaign:{id:'copy-id',name:'Kopie'}}};};
 x.get('campaign-manager').onclick();x.get('campaign-copy').onclick();await tick();x.get('campaign-transfer-form').onsubmit({preventDefault(){}});await tick();
 assert.equal(accepts,1);assert.equal(x.get('campaign-copy').disabled,true);assert.equal(x.get('campaign-transfer-check').hidden,false);assert.equal(x.memory.get('campaign-pending-transfer'),'copy-ticket');assert.deepEqual(x.changes,[]);
 x.get('campaign-transfer-check').onclick();await tick();assert.equal(accepts,1);assert.equal(checks,2);assert.deepEqual(x.changes,[undefined]);assert.equal(x.memory.size,0);assert.equal(x.get('campaign-transfer-dialog').open,false);assert.equal(x.get('campaign-copy').disabled,false);assert.match(x.messages.at(-1)[0],/Übernahme bestätigt: Kopie/);
});

test('unavailable transfer recovery cannot interrupt startup and reopening retries only its read',async t=>{
 const x=fixture(t,{unreadable:true});x.memory.set('campaign-pending-transfer','retained-ticket');assert.equal(x.reads(),0,'optional recovery is not a startup dependency');
 x.get('campaign-manager').onclick();await tick();assert.equal(x.get('campaign-manager-dialog').open,undefined);assert.match(x.messages.at(-1)[0],/Auftragsvermerk nicht lesbar/);assert.equal(x.memory.get('campaign-pending-transfer'),'retained-ticket');assert.deepEqual(x.calls,[]);assert.deepEqual(x.changes,[]);
 x.readable();x.get('campaign-manager').onclick();await tick();assert.equal(x.get('campaign-manager-dialog').open,true);assert.equal(x.get('campaign-copy').disabled,true);assert.equal(x.get('campaign-transfer-check').hidden,false);assert.equal(x.memory.get('campaign-pending-transfer'),'retained-ticket');assert.deepEqual(x.calls,[]);assert.deepEqual(x.changes,[]);
 let checks=0;x.window.campaign.campaignTransferStatus=async ticket=>{assert.equal(ticket,'retained-ticket');checks++;return{ok:true,value:{state:'not-applied'}};};
 x.get('campaign-transfer-check').onclick();await tick();assert.equal(checks,1);assert.equal(x.get('campaign-copy').disabled,false);assert.equal(x.memory.size,0);assert.deepEqual(x.calls,[]);assert.deepEqual(x.changes,[]);
});

for(const recovered of [false,true])test(`confirmed ${recovered?'recovered':'direct'} transfer remains usable when local cleanup fails`,async t=>{
 const x=fixture(t);let accepts=0,checks=0,blocked=true;
 x.window.localStorage.removeItem=k=>{if(blocked)throw Error('Lokale Bereinigung gesperrt');x.memory.delete(k);};
 x.window.campaign.acceptCampaignTransfer=async()=>{accepts++;if(recovered)throw Error('Antwort verloren');return{ok:true,value:{id:'copy-id',name:'Kopie'}};};
 x.window.campaign.campaignTransferStatus=async()=>{checks++;return{ok:true,value:{state:'applied',campaign:{id:'copy-id',name:'Kopie'}}};};
 x.get('campaign-manager').onclick();x.get('campaign-copy').onclick();await tick();x.get('campaign-transfer-form').onsubmit({preventDefault(){}});await tick();
 assert.equal(accepts,1);assert.deepEqual(x.changes,[recovered?undefined:'copy-id']);assert.equal(x.get('campaign-transfer-dialog').open,false);
 assert.equal(x.memory.get('campaign-pending-transfer'),'copy-ticket');assert.equal(x.get('campaign-copy').disabled,true);assert.match(x.messages.at(-1)[0],/(?:Kampagne übernommen|Übernahme bestätigt)/i);assert.match(x.messages.at(-1)[0],/Auftragsvermerk.*nicht entfernt/);
 x.get('campaign-manager').onclick();await tick();assert.equal(x.get('campaign-transfer-check').hidden,false);assert.match(x.get('campaign-transfer-progress').textContent,/ausschließlich.*Buchungsstatus/);
 x.get('campaign-transfer-check').onclick();await tick();assert.equal(accepts,1);assert.equal(x.memory.size,1);assert.equal(x.get('campaign-copy').disabled,true);assert.deepEqual(x.changes,[recovered?undefined:'copy-id',undefined]);
 blocked=false;x.get('campaign-transfer-check').onclick();await tick();assert.equal(accepts,1);assert.equal(checks,recovered?3:2);assert.equal(x.memory.size,0);assert.equal(x.get('campaign-copy').disabled,false);assert.doesNotMatch(x.messages.at(-1)[0],/nicht entfernt/);
});
test('an unbooked transfer keeps its ticket and new transfers locked until cleanup is possible',async t=>{
 const x=fixture(t);x.memory.set('campaign-pending-transfer','unbooked');x.window.localStorage.removeItem=()=>{throw Error('Cleanup blocked');};
 x.window.campaign.campaignTransferStatus=async()=>({ok:true,value:{state:'not-applied'}});x.get('campaign-manager').onclick();await tick();x.get('campaign-transfer-check').onclick();await tick();
 assert.deepEqual(x.calls,[]);assert.deepEqual(x.changes,[]);assert.equal(x.memory.get('campaign-pending-transfer'),'unbooked');assert.equal(x.get('campaign-copy').disabled,true);assert.doesNotMatch(x.messages.at(-1)[0],/Du kannst die Übernahme erneut starten/);
});
