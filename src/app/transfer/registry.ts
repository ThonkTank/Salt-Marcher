import DATA_FORMAT from '../data-format.json';
import definitions from './tables.json';
import {createHash} from 'node:crypto';
import {transferModel,type TransferRow,type TransferContext,type ReferenceRole} from './codec';
import {transferCapabilityReferences} from './capability-references';
import {remapTextReferences} from '../text-references';

type ColumnRule=string|{model:string}|{variant:string;models:Record<string,string>}|{role:ReferenceRole;fixed:Record<string,string[]>};
interface TableContract {owner:string;mode:'copy'|'derived'|'discard';columns:Record<string,{type:string;transfer:ColumnRule}>}
export const transferTables:Readonly<Record<string,TableContract>>=definitions as Record<string,TableContract>;
const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
function fail(message:string):never {throw Error('Kampagnentransfer ist nicht vollständig definiert: '+message+'. Originaldaten bleiben erhalten.');}
export function assertTransferCoverage(db:any){
 const canonical=[...DATA_FORMAT.tables].sort(),registered=Object.keys(transferTables).sort();
 if(JSON.stringify(canonical)!==JSON.stringify(registered))fail('Tabellenkatalog');
 const actual=db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
 if(JSON.stringify(actual.map((t:{name:string})=>t.name).sort())!==JSON.stringify(canonical))fail('Datenbanktabellen');
 for(const {name} of actual){
  const contract=transferTables[name]!;
  if(!contract.owner)fail(name+' ohne Fachowner');
  const columns=db.prepare('SELECT name,type FROM pragma_table_info(?) ORDER BY cid').all(name);
  if(JSON.stringify(columns.map((c:{name:string;type:string})=>[c.name,c.type]))!==JSON.stringify(Object.entries(contract.columns).map(([k,c])=>[k,c.type])))fail(name+' Spalten');
 }
}
export interface CopyNames {sourceId:string;campaignId:string;name:string}
export function transferRow(table:string,value:TransferRow,context:TransferContext,names?:CopyNames):TransferRow {
 const contract=Object.hasOwn(transferTables,table)?transferTables[table]:undefined;if(!contract)fail(table);
 const out:TransferRow={};
 for(const [column,v]of Object.entries(value)){
  const entry=Object.hasOwn(contract.columns,column)?contract.columns[column]:undefined;if(!entry)fail(table+'.'+column);
  let rule=entry.transfer;
  if(v===null||typeof v!=='string'){out[column]=v;continue;}
  if(typeof rule==='object'){
   if('fixed'in rule){out[column]=Object.entries(rule.fixed).some(([k,values])=>values.includes(String(value[k])))?v:context.reference(v,rule.role);continue;}
   const model='model'in rule?rule.model:rule.models[String(value[rule.variant])];
   if(!model)fail(table+' Variante '+String(value['variant'in rule?rule.variant:'']));
   let parsed:unknown;try{parsed=JSON.parse(v);}catch{fail(table+'.'+column+' JSON');}
   out[column]=JSON.stringify(transferModel(model,parsed,context));continue;
  }
  switch(rule){
   case 'local':case 'shared':case 'definition':case 'mixed':out[column]=v?context.reference(v,rule==='mixed'&&value.campaign_id===null?'shared':rule):v;break;
   case 'text':out[column]=remapTextReferences(v,ref=>ref.kind==='creature'?ref.id:context.reference(ref.id,ref.kind==='item'?'shared':'local'));break;
   case 'room-key':{
    if(v.startsWith('@'))out[column]=v;
    else if(!v.includes(':'))out[column]=context.reference(v,'local');
    else {const whole=context.reference(v,'existing-local');out[column]=whole!==v?whole:v.slice(0,v.indexOf(':')+1)+context.reference(v.slice(v.indexOf(':')+1),'existing-local');}
    break;
   }
   case 'campaign-name':out[column]=names?.name??v;break;
   case 'setting-key':out[column]=names?v.replace(':'+names.sourceId,':'+names.campaignId):v;break;
   case 'setting-value':{
    const key=String(value.key);
    if(key.startsWith('default-scope:'))out[column]=context.reference(v,'local');
    else if(key.startsWith('preparation:')||key.startsWith('session-recap:'))out[column]=JSON.stringify(transferModel(key.startsWith('preparation:')?'settings_preparation':'settings_session_recap',JSON.parse(v),context));
    else fail('nicht portable Einstellung '+key);
    break;
   }
   case 'capability-references':out[column]=JSON.stringify(transferCapabilityReferences(JSON.parse(v),context));break;
   case 'opaque':out[column]=v;break;
   default:fail(table+'.'+column+' Regel '+rule);
  }
 }
 if(typeof out.payload==='string'&&Object.hasOwn(out,'checksum'))out.checksum=hash(out.payload);
 return out;
}
export function transferContext(reference:TransferContext['reference'],historical?:TransferContext['historical'],names?:CopyNames):TransferContext {
 const context:TransferContext={reference,historical,row:(table,row,active)=>transferRow(table,row,active??context,names)};
 return context;
}
/** Read-only preflight uses exactly the same contracts as collection and copy. */
export function validateTransferSnapshot(db:any){
 assertTransferCoverage(db);const context=transferContext(value=>value);
 for(const [table,contract]of Object.entries(transferTables)){
  if(contract.mode!=='copy')continue;
  for(const row of db.prepare('SELECT * FROM '+quote(table)).iterate())transferRow(table,row,context);
 }
}
