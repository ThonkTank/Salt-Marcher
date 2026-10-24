import contracts from './contracts.json';
import {remapTextReferences} from '../text-references';

export type TransferValue = null | boolean | number | string | TransferValue[] | {[key:string]:TransferValue};
export type TransferRow = Record<string, unknown>;
export type ReferenceRole = 'local' | 'shared' | 'mixed' | 'definition' | 'existing-local';
export interface TransferContext {
 reference(value:string,role:ReferenceRole):string;
 historical?(definitionId:string):string|undefined;
 row(table:string,value:TransferRow,context?:TransferContext):TransferRow;
}
type Role = string | {keep:string[];otherwise:Role} | {by:string;cases:Record<string,Role>;otherwise:Role} | {fields:Record<string,Role>;values:Role} | {json:string;invalid:'preserve'} | {reference:ReferenceRole;historical:string};
interface Shape {name:string;fields:Record<string,Rule>;keys?:string;values?:Rule}
type Rule = {literal:string|number|boolean|null}|{scalar:string}|{role:Role}|{array:Rule}|{union:Rule[]}|{node:number};
const schema=contracts as unknown as {roots:Record<string,Rule>;nodes:Shape[]};
class UnsupportedTransfer extends Error {}
function unsupported(path:string):never {throw new UnsupportedTransfer('Nicht unterstützter Transferinhalt: '+path+'. Originaldaten bleiben erhalten.');}
function text(value:string,context:TransferContext){return remapTextReferences(value,ref=>ref.kind==='creature'?ref.id:context.reference(ref.id,ref.kind==='item'?'shared':'local'));}
function reference(value:unknown,role:ReferenceRole,context:TransferContext,path:string){
 if(value===null)return value;
 if(typeof value!=='string')return unsupported(path);
 return value===''?value:context.reference(value,role);
}
function visit(rule:Rule,value:unknown,context:TransferContext,path:string,parent:TransferRow={},historyTable?:string):unknown {
 if('literal'in rule){if(value!==rule.literal)unsupported(path);return value;}
 if('scalar'in rule){if(typeof value!==rule.scalar)unsupported(path);return value;}
 if('role'in rule){
  if(typeof rule.role==='object'){
   const role=rule.role;
   if('keep'in role&&typeof value==='string'&&role.keep.includes(value))return value;
   if('keep'in role)return visit({role:role.otherwise},value,context,path,parent,historyTable);
   if('by'in role){const key=String(parent[role.by]);return visit({role:Object.hasOwn(role.cases,key)?role.cases[key]!:role.otherwise},value,context,path,parent,historyTable);}
   if('reference'in role)return reference(value,role.reference,context,path);
   if('json'in role){
    if(typeof value!=='string')unsupported(path);
    let parsed:unknown;try{parsed=JSON.parse(value);}catch{return value;}
    const probe:TransferContext={reference:v=>v,row:(table,row)=>context.row(table,row,probe)};
    try{transferModel(role.json,parsed,probe);}catch(error){if(!(error instanceof UnsupportedTransfer))throw error;return value;}
    return JSON.stringify(transferModel(role.json,parsed,context));
   }
   if(!value||typeof value!=='object'||Array.isArray(value))unsupported(path);
   return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,visit({role:Object.hasOwn(role.fields,key)?role.fields[key]!:role.values},v,context,path+'.'+key,parent,historyTable)]));
  }
  switch(rule.role){
   case 'opaque':return structuredClone(value);
   case 'external':if(typeof value!=='string')unsupported(path);return value;
   case 'text':if(typeof value!=='string')unsupported(path);return text(value,context);
   case 'local':case 'shared':case 'mixed':case 'definition':return reference(value,rule.role,context,path);
   case 'token':if(typeof value!=='string')unsupported(path);return 'portable-context-requires-activation';
   case 'history-row':{
    if(value===null)return null;
    if(!historyTable||!value||typeof value!=='object'||Array.isArray(value))unsupported(path);
    return context.row(historyTable,value as TransferRow,context);
   }
   default:return unsupported(path+' ('+rule.role+')');
  }
 }
 if('array'in rule){if(!Array.isArray(value))unsupported(path);return value.map((v,i)=>visit(rule.array,v,context,path+'['+i+']',parent,historyTable));}
 if('union'in rule){
  // Try structurally matching branches without exposing speculative references to
  // the collector. Only the selected branch participates in identity closure.
  const probe:TransferContext={reference:v=>v,row:(table,row)=>context.row(table,row,probe)};
  let failure:UnsupportedTransfer|undefined;
  for(const candidate of rule.union)try{visit(candidate,value,probe,path,parent,historyTable);return visit(candidate,value,context,path,parent,historyTable);}catch(error){if(!(error instanceof UnsupportedTransfer))throw error;if(!failure||error.message.length>failure.message.length)failure=error;}
  if(failure)throw failure;return unsupported(path);
 }
 const shape=schema.nodes[rule.node];if(!shape||!value||typeof value!=='object'||Array.isArray(value))unsupported(path);
 const record=value as TransferRow,out:TransferRow=Object.create(null);
 const owner=typeof record.table==='string'?record.table:record.key&&typeof record.key==='object'&&'table'in record.key?String(record.key.table):historyTable;
 for(const [key,v]of Object.entries(record)){
  const field=Object.hasOwn(shape.fields,key)?shape.fields[key]:undefined;
  if(field)out[key]=visit(field,v,context,path+'.'+key,record,owner);
  else if(shape.values){const mapped=shape.keys==='local'||shape.keys==='shared'?context.reference(key,shape.keys):key;out[mapped]=visit(shape.values,v,context,path+'.'+key,record,owner);}
  else unsupported(path+'.'+key);
 }
 for(const [key,field]of Object.entries(shape.fields))if('role'in field&&typeof field.role==='object'&&'historical'in field.role&&typeof record[key]==='string'){
  const alias=context.historical?.(record[key] as string);if(alias&&!record[field.role.historical])out[field.role.historical]=alias;
 }
 return out;
}
export function transferModel(model:string,value:unknown,context:TransferContext):unknown {
 const root=Object.hasOwn(schema.roots,model)?schema.roots[model]:undefined;if(!root)unsupported(model);
 return visit(root,value,context,model);
}
