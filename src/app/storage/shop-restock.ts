import {createHash} from 'node:crypto';
import {integerWeights} from '../generation-contracts';
import type {Shop,ShopRestockTable,ShopStock} from '../items-contracts';

const instant=(v:unknown)=>typeof v==='string'&&/^(0|[1-9][0-9]{0,29})$/.test(v);
const interval=(v:unknown)=>typeof v==='string'&&/^[1-9][0-9]{0,17}$/.test(v);
const positive=(v:number,max=1000000)=>Number.isSafeInteger(v)&&v>0&&v<=max;
export function validateRestockTables(shop:Shop,pending=false){
 if(shop.restockTables===undefined)return;
 if(!Array.isArray(shop.restockTables)||shop.restockTables.length>100)throw new Error('Ungültige Warenauffülltabellen.');
 const ids=new Set<string>();
 for(const table of shop.restockTables){
  if(!table||typeof table.id!=='string'||!table.id||table.id.length>1000||ids.has(table.id)||!Number.isSafeInteger(table.revision)||table.revision<(pending?0:1)||typeof table.name!=='string'||!table.name.trim()||table.name.length>1000||typeof table.seed!=='string'||!table.seed.trim()||table.seed.length>1000||!positive(table.rolls,100)||!Array.isArray(table.entries)||!table.entries.length||table.entries.length>1000)throw new Error('Warenauffülltabelle benötigt Namen, Zufallsbasis und 1–100 Ziehungen.');
  ids.add(table.id);const entries=new Set<string>();
  for(const e of table.entries){const stock=shop.stock.find(s=>s.id===e?.entryId);if(!e||!stock||stock.unique||entries.has(e.entryId)||!positive(e.minimum)||!positive(e.maximum)||e.maximum<e.minimum)throw new Error('Auffülltabelle benötigt eindeutige Mengenstapel mit gültigen Mindest-/Höchstmengen.');entries.add(e.entryId);}
  if(!integerWeights(table.entries.map(e=>e.weight)).some(w=>w>0n))throw new Error('Mindestens ein Warengewicht muss positiv sein.');
  if(table.schedule!==null&&(!table.schedule||!interval(table.schedule.intervalMs)||!instant(table.schedule.nextDueMs)))throw new Error('Warenauffülltabelle benötigt ein positives Intervall und eine gültige Fälligkeit.');
 }
}
const authored=(t:ShopRestockTable)=>JSON.stringify({name:t.name,seed:t.seed,rolls:t.rolls,entries:t.entries,intervalMs:t.schedule?.intervalMs??null});
export function prepareRestockTables(shop:Shop,prior:Shop|null,time:()=>bigint,through:bigint|null){
 for(const table of shop.restockTables??[]){
  const old=prior?.restockTables?.find(t=>t.id===table.id);
  const changed=!old||authored(old)!==authored(table);
  table.revision=old?old.revision+(changed?1:0):1;
  if(table.schedule){
   if(changed||!old?.schedule||table.schedule.nextDueMs==='0')table.schedule.nextDueMs=(time()+BigInt(table.schedule.intervalMs)).toString();
   else table.schedule.nextDueMs=old.schedule.nextDueMs;
   if(!instant(table.schedule.nextDueMs)||through!==null&&BigInt(table.schedule.nextDueMs)<=through)throw new Error('Neue Warenfälligkeit würde bestätigte Auffüllungen wiederholen oder ist nicht darstellbar.');
  }
 }
}
/** One bounded draw stream; only selected stock is changed. The caller owns the transaction. */
export function drawRestockTable(shop:Shop,table:ShopRestockTable,seed:string,periods=1n,firstDue?:bigint){
 const draws=periods*BigInt(table.rolls);
 if(draws>100000n)throw new Error('Mehr als 100.000 Warenziehungen in einem Zeitschritt. Zeit in kleineren Schritten bestätigen oder die Auffüllregel anpassen.');
 const weights=integerWeights(table.entries.map(e=>e.weight));let total=0n;
 const stockById=new Map(shop.stock.map(s=>[s.id,s]));
 const edges=weights.map(w=>total+=w),selected=new Map<string,{stock:ShopStock;before:number;added:number}>();
 const random=(key:string)=>BigInt('0x'+createHash('sha256').update(seed+'|'+key).digest('hex'));
 for(let p=0n;p<periods;p++)for(let draw=0;draw<table.rolls;draw++){
  const key=(firstDue===undefined?'manual':(firstDue+p*BigInt(table.schedule!.intervalMs)).toString())+'|'+draw;
  const roll=random(key+'|entry')%total;let lo=0,hi=edges.length-1;while(lo<hi){const mid=(lo+hi)>>>1;if(roll<edges[mid]!)hi=mid;else lo=mid+1;}
  const entry=table.entries[lo]!,stock=stockById.get(entry.entryId)!;
  const quantity=entry.minimum+Number(random(key+'|quantity')%BigInt(entry.maximum-entry.minimum+1));
  let outcome=selected.get(stock.id);if(!outcome){outcome={stock,before:stock.quantity,added:0};selected.set(stock.id,outcome);}
  outcome.added+=quantity;stock.quantity+=quantity;
  if(!Number.isSafeInteger(stock.quantity)||stock.quantity>1000000)throw new Error('Gewichtete Auffüllung überschreitet die Bestandsgrenze. Menge oder Zeitraum verringern.');
 }
 return [...selected.values()].map(o=>({entryId:o.stock.id,reference:{...o.stock.reference},before:o.before,added:o.added,quantity:o.stock.quantity}));
}
