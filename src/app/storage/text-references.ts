import type {DeskRef,DeskEntry} from '../scene-desk-contracts';
import {documentReferences} from '../text-references';
import {createHash} from 'node:crypto';
import {worldNoteDocument} from '../../features/world/world-notes';
import {checkedLocationDocument} from '../../features/location/location-schema';
import {readCreature,readEncounterPlan} from './encounters';
import {readItemDefinition} from './item-definitions';
const registered=new WeakSet<object>();
export function installTextReferenceReader(db:any){if(registered.has(db))return;db.function('gm_document_refs',{deterministic:true},(kind:string,payload:string,checksum:string)=>{try{if(createHash('sha256').update(payload).digest('hex')!==checksum)return '[]';const d=kind==='note'?worldNoteDocument(JSON.parse(payload)):checkedLocationDocument(JSON.parse(payload));return JSON.stringify(documentReferences(d).slice(0,200).map(r=>({kind:r.ref.kind,id:r.ref.id,label:r.label,field:r.field})));}catch{return '[]';}});registered.add(db);}
export const textReferenceSql=`SELECT 'note' sourceKind,n.id sourceId,json_extract(j.value,'$.kind') kind,json_extract(j.value,'$.id') id,json_extract(j.value,'$.label') alias,json_extract(j.value,'$.field') field FROM world_note n,json_each(gm_document_refs('note',n.payload,n.checksum)) j WHERE n.campaign_id=@cam AND n.trashed=0
 UNION ALL SELECT 'location',l.id,json_extract(j.value,'$.kind'),json_extract(j.value,'$.id'),json_extract(j.value,'$.label'),json_extract(j.value,'$.field') FROM location l,json_each(gm_document_refs('location',l.payload,l.checksum)) j WHERE l.campaign_id=@cam AND l.trashed=0`;
export function referenceEntry(db:any,cam:string,ref:DeskRef):DeskEntry&{revision:number}{
 let title='Ziel nicht verfügbar',label={note:'Weltinhalt',location:'Ort',creature:'Kreatur',item:'Gegenstand',encounter:'Begegnung'}[ref.kind],revision=0,unavailable=true;
 if(ref.kind==='creature'){try{const c=readCreature(ref.id);title=c.name;label='Kreatur';revision=1;unavailable=false;}catch{}}
 else if(ref.kind==='item'){try{const d=readItemDefinition(db,ref.id);title=d.name;label='Gegenstand';revision=d.revision;unavailable=d.trashed;}catch{}}
 else try{if(ref.kind==='encounter'){const d=readEncounterPlan(db,cam,ref.id);title=d.name;revision=d.revision;unavailable=false;}else{const table=ref.kind==='note'?'world_note':'location',row=db.prepare(`SELECT * FROM ${table} WHERE campaign_id=? AND id=?`).get(cam,ref.id);if(!row||createHash('sha256').update(row.payload).digest('hex')!==row.checksum)throw new Error('Textverweisziel beschädigt.');if(ref.kind==='note'){const d=worldNoteDocument(JSON.parse(row.payload));if(d.id!==row.id||d.revision!==row.revision)throw new Error('Textverweisziel widerspricht seiner Identität.');title=d.title;}else{const d=checkedLocationDocument(JSON.parse(row.payload));if(d.id!==row.id)throw new Error('Textverweisziel widerspricht seiner Identität.');title=d.name;}revision=row.revision;unavailable=!!row.trashed;}}catch{}
 return{ref,title,label,revision,unavailable};
}
export function searchTextReferences(db:any,cam:string,text:string,offset:number):{entries:(DeskEntry&{revision:number;alias:string})[];next:number|null}{
 installTextReferenceReader(db);const rows=db.prepare('SELECT kind,id,min(alias) alias FROM ('+textReferenceSql+") WHERE instr(lower(alias),lower(@text))>0 GROUP BY kind,id ORDER BY alias COLLATE NOCASE,kind,id LIMIT 41 OFFSET @offset").all({cam,text,offset});
 return{entries:rows.slice(0,40).map((r:any)=>{const e=referenceEntry(db,cam,{kind:r.kind,id:r.id});return{...e,alias:r.alias,label:r.alias+' → '+e.label};}),next:rows.length>40?offset+40:null};
}
