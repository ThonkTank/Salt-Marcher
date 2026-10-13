import {createHash,randomUUID} from 'node:crypto';
import type {Shop,ShopView,ShopSummary,ItemShopCommand,ItemShopAck} from '../items-contracts';
import {copper,type LedgerItem} from '../progression';
import {saveLedger,event,readLedgerItem} from './progression';
import {readItemDefinition,saveItemDefinition,installItemDefinitions,validateItemDefinitionVersions,checkedDefinition} from './item-definitions';
import {scenePreparation} from './session';
import {readLiveScene,readCampaignTime} from './live';
import {formatInstant} from '../live-contracts';
const json=(v:unknown)=>JSON.stringify(v),hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function decoded<T>(row:any):T{if(!row||hash(row.payload)!==row.checksum)throw new Error('Shopdaten fehlen oder sind beschädigt.');return JSON.parse(row.payload);}
export function installItemsSchema(db:any){installItemDefinitions(db);db.exec(`CREATE TABLE IF NOT EXISTS shop(campaign_id TEXT NOT NULL REFERENCES campaign(id),id TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS shop_event(campaign_id TEXT NOT NULL,shop_id TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(campaign_id,id),FOREIGN KEY(campaign_id,shop_id) REFERENCES shop(campaign_id,id)) STRICT;
 CREATE TABLE IF NOT EXISTS shop_receipt(command_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaign(id),fingerprint TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL) STRICT;`);}
function owner(db:any,cam:string,s:Shop){if(!['npc','location'].includes(s.owner.kind))throw new Error('Shop benötigt einen NPC oder Ort als Besitzer.');const row=db.prepare(`SELECT * FROM ${s.owner.kind==='npc'?'world_note':'location'} WHERE campaign_id=? AND id=?`).get(cam,s.owner.id);if(!row)throw new Error('Shopbesitzer fehlt.');const d=decoded<any>(row);if(s.owner.kind==='npc'&&d.kind!=='npc')throw new Error('Shopbesitzer muss ein NPC sein.');const name=d.title??d.name;if(d.id!==s.owner.id||s.owner.kind==='location'&&d.kind!=='location'||typeof name!=='string'||!name.trim()||name.length>1000)throw new Error('Shopbesitzer hat keine gültige Identität oder Bezeichnung.');return{name,unavailable:!!row.trashed};}
function saveShop(db:any,cam:string,s:Shop){const payload=json(s);db.prepare('INSERT INTO shop VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum').run(cam,s.id,s.revision,payload,hash(payload));}
function validateShopShape(s:Shop,pending=false){
 const text=(v:unknown,max:number,nonempty=false)=>typeof v==='string'&&v.length<=max&&(!nonempty||!!v.trim());
 if(!s||!text(s.id,1000,true)||!Number.isSafeInteger(s.revision)||s.revision<(pending?0:1)||!text(s.name,1000,true)||!text(s.notes,100000)||typeof s.trashed!=='boolean'||!s.owner||!['npc','location'].includes(s.owner.kind)||!text(s.owner.id,1000,true)||!Array.isArray(s.stock)||s.stock.length>1000)throw new Error('Shopbeschreibung oder Revision ungültig.');
 const ids=new Set<string>(),instances=new Set<string>();
 for(const e of s.stock){
  if(!e||!text(e.id,1000,true)||ids.has(e.id)||!e.reference||e.reference.kind!=='authored'||!text(e.reference.definitionId,1000,true)||!Number.isSafeInteger(e.reference.revision)||e.reference.revision<1||!text(e.notes,100000)||typeof e.unique!=='boolean')throw new Error('Shopbestandszeile oder Gegenstandsreferenz ungültig.');
  ids.add(e.id);qty(e.quantity,true);price(e.buyCopper);price(e.sellCopper);
  if(e.unique){if(e.quantity>1||!text(e.instanceId,1000,true)||instances.has(e.instanceId!)||e.restock!==null)throw new Error('Einzelstück benötigt eine eindeutige Identität und keine Auffüllregel.');instances.add(e.instanceId!);}
  else if(e.instanceId!==null)throw new Error('Mengenstapel darf keine Einzelstückidentität haben.');
  if(e.restock!==null){const r=e.restock;if(!r||!['fill','add'].includes(r.mode)||typeof r.intervalMs!=='string'||!/^[1-9][0-9]{0,17}$/.test(r.intervalMs)||typeof r.nextDueMs!=='string'||!/^(0|[1-9][0-9]{0,29})$/.test(r.nextDueMs))throw new Error('Auffüllregel benötigt Menge und positives Intervall.');qty(r.quantity);}
 }
}
function shopRecord(db:any,cam:string,id:string):Shop{const row=db.prepare('SELECT * FROM shop WHERE campaign_id=? AND id=?').get(cam,id),s=decoded<Shop>(row);validateShopShape(s);if(s.id!==id||s.revision!==row.revision)throw new Error('Shoprevision widersprüchlich.');return s;}
function history(db:any,cam:string,s:Shop,description:string,facts:unknown){const id=randomUUID(),payload=json({time:new Date().toISOString(),description,facts});db.prepare('INSERT INTO shop_event VALUES(?,?,?,?,?)').run(cam,s.id,id,payload,hash(payload));return id;}
function restockThrough(db:any,cam:string,id:string):bigint|null{
 let through:bigint|null=null;
 for(const row of db.prepare('SELECT payload,checksum FROM shop_event WHERE campaign_id=? AND shop_id=?').iterate(cam,id)){
  const facts=decoded<any>(row).facts;
  if(!facts||facts.intervals===undefined||facts.instantMs===undefined)continue;
  const instant=facts.lastDueMs??facts.instantMs;
  if(typeof instant!=='string'||!/^(0|[1-9][0-9]{0,29})$/.test(instant))throw new Error('Auffüllzeit im Shopverlauf beschädigt.');
  const value=BigInt(instant);if(through===null||value>through)through=value;
 }
 return through;
}
function restockTimeNotice(db:any,cam:string,id:string):string|null{
 const through=restockThrough(db,cam,id),focus=db.prepare('SELECT focus_id FROM live_state WHERE campaign_id=?').get(cam)?.focus_id;
 if(!focus)return null;
 let scene;try{scene=readLiveScene(db,cam,focus);}catch{return 'Scenezeit nicht verfügbar. Shopbestand bleibt unverändert.';}
 if(through===null||through<=BigInt(scene.clock.instantMs))return null;
 return 'Auffüllungen bis '+formatInstant(through.toString())+' bleiben erhalten. Die Gruppe im Fokus steht bei '+formatInstant(scene.clock.instantMs)+'.';
}
export function readShop(db:any,cam:string,id:string):ShopView{
 const s=shopRecord(db,cam,id),o=owner(db,cam,s);
 return{shop:s,ownerName:o.name,unavailable:o.unavailable||s.trashed,timeNotice:restockTimeNotice(db,cam,id),items:[...new Set(s.stock.map(e=>e.reference.definitionId))].map(id=>readItemDefinition(db,id)),history:db.prepare('SELECT * FROM shop_event WHERE campaign_id=? AND shop_id=? ORDER BY rowid DESC LIMIT 50').all(cam,id).map((r:any)=>({id:r.id,...decoded<any>(r)}))};
}
function listShops(db:any,cam:string,includeTrashed:boolean,accept?:(s:Shop)=>boolean):ShopSummary[]{
 const list:ShopSummary[]=[];
 for(const row of db.prepare('SELECT id FROM shop WHERE campaign_id=?').iterate(cam)){
  let s:Shop|undefined;
  try{
   s=shopRecord(db,cam,row.id);const o=owner(db,cam,s),unavailable=o.unavailable||s.trashed;
   if(!includeTrashed&&unavailable||accept&&!accept(s))continue;
   list.push({id:s.id,name:s.name,revision:s.revision,ownerName:o.name,unavailable,problem:null});
  }catch(error){list.push({id:row.id,name:s?.name??'Unlesbarer Shop',revision:null,ownerName:'Zuordnung nicht geprüft',unavailable:true,problem:row.id+': '+(error instanceof Error?error.message:'Shopdaten nicht verfügbar.')});}
 }
 return list.sort((a,b)=>a.name.localeCompare(b.name));
}
export function readShops(db:any,cam:string,includeTrashed:boolean){return listShops(db,cam,includeTrashed);}
export function sceneShops(db:any,cam:string,sceneId:string){const scene=db.prepare('SELECT location_id FROM live_scene WHERE campaign_id=? AND id=?').get(cam,sceneId);if(!scene)throw new Error('Scene fehlt.');const actors=new Set(scenePreparation(db,cam,sceneId).groups.flatMap(g=>g.actors).filter(a=>!a.unavailable).map(a=>a.id));return listShops(db,cam,false,s=>s.owner.kind==='location'?s.owner.id===scene.location_id:actors.has(s.owner.id));}

function sceneTime(db:any,cam:string,id:string|null){
 if(!id)return{sceneId:null,locationId:null,instantMs:null};
 const scene=readLiveScene(db,cam,id);if(scene.retired)throw new Error('Handelsgruppe ist archiviert.');
 return{sceneId:scene.id,locationId:scene.locationId,instantMs:scene.clock.instantMs};
}
function scheduleTime(db:any,cam:string,shopId:string,basis:Extract<ItemShopCommand['action'],{kind:'shop'}>['scheduleClock']){
 if(basis){
  const scene=readLiveScene(db,cam,basis.sceneId);
  if(scene.retired||scene.clock.revision!==basis.expectedRevision)throw new Error('Scenezeit für neue Auffüllregel geändert. Erneut ansehen.');
  const instant=BigInt(scene.clock.instantMs),through=restockThrough(db,cam,shopId);
  if(through!==null&&instant<through)throw new Error('Scenezeit liegt vor bestätigten Auffüllungen dieses Shops. Eine passende Zeitbasis wählen.');
  return instant;
 }
 if(db.prepare('SELECT 1 FROM live_state WHERE campaign_id=?').get(cam))throw new Error('Neue Auffüllregel benötigt eine ausdrücklich gewählte Scenezeit als Zeitbasis.');
 return BigInt(readCampaignTime(db,cam).instantMs);
}
function qty(n:number,zero=false){if(!Number.isSafeInteger(n)||n<(zero?0:1)||n>1000000)throw new Error('Menge muss eine ganze Zahl bis 1.000.000 sein.');}
function price(s:string){if(typeof s!=='string'||!/^(0|[1-9][0-9]{0,17})$/.test(s))throw new Error('Ungültiger Preis.');}
function checkedShop(db:any,cam:string,s:Shop,expected:number|null,basis:Extract<ItemShopCommand['action'],{kind:'shop'}>['scheduleClock']){
 validateShopShape(s,true);
 const row=db.prepare('SELECT revision FROM shop WHERE campaign_id=? AND id=?').get(cam,s.id);
 if((row?.revision??null)!==expected)throw new Error('Shop geändert. Bitte aktualisieren.');
 owner(db,cam,s);if(row)shopRecord(db,cam,s.id);
 const through=restockThrough(db,cam,s.id);
 for(const e of s.stock){
  const d=readItemDefinition(db,e.reference.definitionId);e.reference={...e.reference,revision:d.revision};
  if(e.restock){if(e.restock.nextDueMs==='0')e.restock.nextDueMs=(scheduleTime(db,cam,s.id,basis)+BigInt(e.restock.intervalMs)).toString();if(through!==null&&BigInt(e.restock.nextDueMs)<=through)throw new Error('Neue Fälligkeit würde bestätigte Auffüllungen dieses Shops wiederholen.');}
 }
 return{...s,revision:(expected??0)+1};
}
export function restockDue(db:any,cam:string,instantMs:string){if(!/^(0|[1-9][0-9]{0,29})$/.test(instantMs))throw new Error('Ungültige Auffüllzeit.');const current=BigInt(instantMs);for(const row of db.prepare('SELECT id FROM shop WHERE campaign_id=?').all(cam)){const s=shopRecord(db,cam,row.id);if(s.trashed||owner(db,cam,s).unavailable)continue;let changed=false;for(const e of s.stock){const rule=e.restock;if(!rule||e.unique||BigInt(rule.nextDueMs)>current)continue;const count=(current-BigInt(rule.nextDueMs))/BigInt(rule.intervalMs)+1n,before=e.quantity,next=rule.mode==='fill'?BigInt(Math.max(e.quantity,rule.quantity)):BigInt(e.quantity)+count*BigInt(rule.quantity);if(next>1000000n)throw new Error('Automatisches Auffüllen überschreitet die Bestandsgrenze. Passe die Regel an.');e.quantity=Number(next);rule.nextDueMs=(BigInt(rule.nextDueMs)+count*BigInt(rule.intervalMs)).toString();history(db,cam,s,'Automatisch aufgefüllt',{entryId:e.id,before,quantity:e.quantity,intervals:count.toString(),instantMs:current.toString(),lastDueMs:(BigInt(rule.nextDueMs)-BigInt(rule.intervalMs)).toString()});changed=true;}if(changed){s.revision++;saveShop(db,cam,s);}}}
export function executeItemShop(db:any,c:ItemShopCommand,guard:()=>void):ItemShopAck{return db.transaction(()=>{guard();if(!c.commandId||typeof c.commandId!=='string')throw new Error('Änderungskennung fehlt.');const fp=hash(json({campaignId:c.campaignId,action:c.action})),prior=db.prepare('SELECT * FROM shop_receipt WHERE command_id=?').get(c.commandId);if(prior){if(prior.campaign_id!==c.campaignId||prior.fingerprint!==fp)throw new Error('Änderungskennung anders verwendet.');return decoded<ItemShopAck>(prior);}const a=c.action,cam=c.campaignId;let result:ItemShopAck;
 if(a.kind==='definition'){result={definition:saveItemDefinition(db,a.definition,a.expectedRevision)};}
 else if(a.kind==='definition-trash'){const d=readItemDefinition(db,a.id);result={definition:saveItemDefinition(db,{...d,trashed:a.trashed},a.expectedRevision)};}
 else if(a.kind==='shop'){const s=checkedShop(db,cam,structuredClone(a.shop),a.expectedRevision,a.scheduleClock);saveShop(db,cam,s);history(db,cam,s,a.expectedRevision===null?'Shop angelegt':'Bestand / Shop bearbeitet',{shop:s});result={shop:readShop(db,cam,s.id)};}
 else{const s=shopRecord(db,cam,a.shopId),o=owner(db,cam,s);if(s.revision!==a.expectedRevision||s.trashed||o.unavailable)throw new Error('Shop geändert oder Besitzer im Papierkorb.');const ledgerIds:string[]=[];
 if(a.kind==='purchase'){qty(a.quantity);const e=s.stock.find(e=>e.id===a.entryId);if(!e||a.quantity>e.quantity)throw new Error('Menge überschreitet den Shopbestand.');const d=readItemDefinition(db,e.reference.definitionId);if(d.trashed||d.revision!==a.expectedDefinitionRevision)throw new Error('Gegenstand geändert oder im Papierkorb.');const member=db.prepare('SELECT active,membership_revision,scene_id FROM roster_member WHERE campaign_id=? AND id=?').get(cam,a.characterId);if(!member?.active||member.membership_revision!==a.expectedMembershipRevision)throw new Error('Empfänger geändert oder inaktiv.');const time=sceneTime(db,cam,member.scene_id);
 const l:LedgerItem={id:randomUUID(),characterId:a.characterId,revision:1,reference:{...e.reference,revision:d.revision},name:d.name,category:d.category,quantity:a.quantity,unitCopper:d.unitCopper,origin:'purchase',status:'received',actualSaleCopper:null,paidCopper:copper(a.actualGold),counterparty:s.name+' · '+o.name,counterpartyReference:{shopId:s.id,owner:s.owner},instanceId:e.instanceId,treasureId:null,combatId:null,...time,recordedAt:new Date().toISOString(),parentId:null};e.quantity-=a.quantity;saveLedger(db,cam,l);ledgerIds.push(l.id);event(db,cam,l.characterId,'shop-purchase',{entry:l,shopId:s.id});history(db,cam,s,'Kauf: '+a.quantity+' × '+d.name,{entry:l});
 }else if(a.kind==='sell'){qty(a.quantity);const l=readLedgerItem(db,cam,a.ledgerId),before=structuredClone(l);if(l.revision!==a.expectedLedgerRevision||l.status!=='received'||a.quantity>l.quantity)throw new Error('Persönlicher Beutestand geändert.');const d=readItemDefinition(db,l.reference.definitionId);if(d.revision!==a.expectedDefinitionRevision)throw new Error('Gegenstandsdefinition geändert.');const member=db.prepare('SELECT scene_id FROM roster_member WHERE campaign_id=? AND id=?').get(cam,l.characterId);if(!member)throw new Error('Verkäufer fehlt.');const part:LedgerItem={...l,...sceneTime(db,cam,member.scene_id),id:randomUUID(),revision:1,quantity:a.quantity,status:'sold',actualSaleCopper:copper(a.actualGold),counterparty:s.name+' · '+o.name,counterpartyReference:{shopId:s.id,owner:s.owner},parentId:l.id,recordedAt:new Date().toISOString()};delete part.currentName;delete part.currentUnitCopper;l.quantity-=a.quantity;l.revision++;saveLedger(db,cam,l);saveLedger(db,cam,part);ledgerIds.push(l.id,part.id);let e=s.stock.find(e=>e.reference.definitionId===d.id&&(l.instanceId?e.instanceId===l.instanceId:!e.unique));if(e){if(e.unique&&e.quantity)throw new Error('Einzelstück bereits im Shopbestand.');e.quantity+=a.quantity;qty(e.quantity);e.reference.revision=d.revision;}else{const prices=a.newStockPrices?{buyCopper:copper(a.newStockPrices.buyGold),sellCopper:copper(a.newStockPrices.sellGold)}:d.unitCopper===null?null:{buyCopper:d.unitCopper,sellCopper:d.unitCopper};if(!prices)throw new Error('Neuer Shopbestand mit unbekanntem Wert benötigt ausdrückliche Ankaufs- und Verkaufspreise.');s.stock.push({id:randomUUID(),reference:{kind:'authored',definitionId:d.id,revision:d.revision},quantity:a.quantity,unique:!!l.instanceId,instanceId:l.instanceId??null,...prices,notes:a.notes,restock:null});}event(db,cam,l.characterId,'shop-sale',{before,portion:part,shopId:s.id,notes:a.notes});history(db,cam,s,'Verkauf an Shop: '+a.quantity+' × '+d.name,{entry:part});
 }else if(a.kind==='restock'){qty(a.quantity);const e=s.stock.find(e=>e.id===a.entryId);if(!e||e.unique||!['fill','add'].includes(a.mode))throw new Error('Auffüllen benötigt einen Mengenstapel.');const before=e.quantity;e.quantity=a.mode==='fill'?Math.max(e.quantity,a.quantity):e.quantity+a.quantity;qty(e.quantity,true);history(db,cam,s,'Manuell aufgefüllt',{entryId:e.id,before,quantity:e.quantity,reason:a.reason});}else throw new Error('Unbekannte Shopaktion.');
 s.revision++;saveShop(db,cam,s);result={shop:readShop(db,cam,s.id),ledgerIds};}
 const payload=json(result);db.prepare('INSERT INTO shop_receipt VALUES(?,?,?,?,?)').run(c.commandId,cam,fp,payload,hash(payload));return result;
 }).immediate();}
export function validateItemsBackup(db:any){for(const row of db.prepare('SELECT id FROM item_definition UNION SELECT id FROM authored_item').iterate())readItemDefinition(db,row.id);validateItemDefinitionVersions(db);for(const row of db.prepare('SELECT campaign_id,id FROM shop').iterate())readShop(db,row.campaign_id,row.id);for(const table of ['shop_event','shop_receipt'])for(const row of db.prepare(`SELECT * FROM ${table}`).iterate()){const value=decoded<any>(row);if(table==='shop_receipt'){if(value.definition)checkedDefinition(value.definition);for(const d of value.shop?.items??[])checkedDefinition(d);}}}
