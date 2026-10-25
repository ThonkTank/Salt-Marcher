import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseHTML} from 'linkedom';
import {initExtensions} from '../../../src/app/workspace/extensions-ui';
import type {ExtensionCommand,ExtensionInfo,ExtensionPage} from '../../../src/app/workspace/extension-contracts';

const pendingKey='extension-pending-write';
const page:ExtensionPage={items:[{id:'way.notes',revision:3,generation:'generation',manifest:{id:'way.notes',name:'Wegnotizen',version:'1.0.0',hostApi:1,unitCodec:'way-note:1',rights:['ownedUnits.read','ownedUnits.write']},hash:'a'.repeat(64),state:'installed',grants:['ownedUnits.read','ownedUnits.write']}],problems:[],next:null};
const valid:ExtensionCommand={commandId:'command-1',action:{kind:'revoke',id:'way.notes',expectedRevision:3}};
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function until(check:()=>boolean){for(let index=0;index<20;index++){if(check())return;await settle();}assert.ok(check(),'expected UI state');}

function fixture(saved:string|null,{holdList=false,readFails=false,archiveFails=false,paged=false}={}){
 const parsed=parseHTML(readFileSync(join(process.cwd(),'src/app/workspace/index.html'),'utf8')),priorDocument=globalThis.document,priorWindow=globalThis.window,store=new Map<string,string>(),messages:{text:string;error?:boolean}[]=[],executed:ExtensionCommand[]=[],outcomes:ExtensionCommand[]=[];if(saved!==null)store.set(pendingKey,saved);let rejectRead=readFails,rejectArchive=archiveFails,releaseList:(()=>void)|null=null;
 const {document,window}=parsed;Object.assign(globalThis,{document,window});const dialog=document.getElementById('extensions-dialog') as HTMLDialogElement;Object.defineProperty(dialog,'open',{value:false,writable:true});dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
 window.localStorage={getItem:(key:string)=>{if(rejectRead)throw new Error('read failed');return store.get(key)??null;},setItem:(key:string,value:string)=>{if(rejectArchive&&key.startsWith('extension-damaged-write:'))throw new Error('archive failed');store.set(key,value);},removeItem:(key:string)=>{store.delete(key);}} as Storage;
 const listed=holdList?new Promise<void>(resolve=>{releaseList=resolve;}):Promise.resolve();
 const info=page.items[0] as ExtensionInfo;
 window.campaign={extensions:async(after:string|null)=>{await listed;return{ok:true as const,value:{...page,items:after?[]:page.items,next:paged&&after===null?'extension:installed:way.notes':null}};},extensionPreview:async()=>({ok:true as const,value:null}),executeExtension:async(command:ExtensionCommand)=>{executed.push(command);return{ok:true as const,value:info};},extensionOutcome:async(command:ExtensionCommand)=>{outcomes.push(command);return{ok:true as const,value:info};}} as unknown as typeof window.campaign;
 initExtensions((text,error)=>messages.push({text,error}));const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;el<HTMLButtonElement>('extensions-open').onclick?.(new window.Event('click') as any);
 return{el,store,messages,executed,outcomes,releaseList:()=>releaseList?.(),allowRead:()=>{rejectRead=false;},allowArchive:()=>{rejectArchive=false;},cleanup(){Object.assign(globalThis,{document:priorDocument,window:priorWindow});}};
}

test('damaged pending metadata blocks writes until a fresh list is read and the exact bytes are archived',async()=>{
 const raw='';const x=fixture(raw,{holdList:true,paged:true});try{const reset=x.el<HTMLButtonElement>('extension-reset-recovery'),pick=x.el<HTMLButtonElement>('extension-pick'),more=x.el<HTMLButtonElement>('extension-more');assert.equal(x.el('extension-recovery').hidden,false);assert.equal(pick.disabled,true);assert.equal(reset.disabled,true);pick.onclick?.(new Event('click') as any);assert.equal(x.executed.length,0);x.releaseList();await until(()=>!more.hidden);assert.equal(reset.disabled,true);assert.equal(more.disabled,false);more.onclick?.(new Event('click') as any);await until(()=>!reset.disabled);const remove=[...x.el('extension-list').querySelectorAll('button')].at(-1) as HTMLButtonElement;assert.equal(remove.disabled,true);reset.onclick?.(new Event('click') as any);assert.equal(x.store.has(pendingKey),false);assert.equal([...x.store.entries()].filter(([key])=>key.startsWith('extension-damaged-write:'))[0]?.[1],raw);assert.equal(x.el('extension-recovery').hidden,true);assert.equal(pick.disabled,false);assert.equal(remove.disabled,false);assert.equal(x.executed.length,0);
 }finally{x.cleanup();}
});

test('a valid pending command remains available only for outcome lookup',async()=>{
 const x=fixture(JSON.stringify(valid));try{await settle();assert.equal(x.el('extension-recovery').hidden,true);assert.equal(x.el<HTMLButtonElement>('extension-outcome').hidden,false);assert.equal(x.el<HTMLButtonElement>('extension-pick').disabled,true);x.el<HTMLButtonElement>('extension-reset-recovery').onclick?.(new Event('click') as any);assert.equal(x.store.get(pendingKey),JSON.stringify(valid));x.el<HTMLButtonElement>('extension-outcome').onclick?.(new Event('click') as any);await settle();await settle();assert.deepEqual(x.outcomes,[valid]);assert.equal(x.store.has(pendingKey),false);
 }finally{x.cleanup();}
});

test('archive failure keeps the damaged command and all writes blocked',async()=>{
 const raw='{"commandId":false}';const x=fixture(raw,{archiveFails:true});try{const reset=x.el<HTMLButtonElement>('extension-reset-recovery');await until(()=>!reset.disabled);reset.onclick?.(new Event('click') as any);assert.equal(x.store.get(pendingKey),raw);assert.equal(x.el('extension-recovery').hidden,false);assert.equal(x.el<HTMLButtonElement>('extension-pick').disabled,true);assert.equal(x.messages.at(-1)?.text,'archive failed');
 }finally{x.cleanup();}
});

test('changed bytes are never cleared and reopening re-evaluates temporary storage failures',async()=>{
 const x=fixture('{old');try{const reset=x.el<HTMLButtonElement>('extension-reset-recovery');await until(()=>!reset.disabled);x.store.set(pendingKey,JSON.stringify(valid));reset.onclick?.(new Event('click') as any);assert.equal(x.store.get(pendingKey),JSON.stringify(valid));assert.match(x.messages.at(-1)?.text??'',/geändert/);x.el<HTMLButtonElement>('extensions-close').onclick?.(new Event('click') as any);x.el<HTMLButtonElement>('extensions-open').onclick?.(new Event('click') as any);await settle();assert.equal(x.el('extension-recovery').hidden,true);assert.equal(x.el<HTMLButtonElement>('extension-outcome').hidden,false);
 }finally{x.cleanup();}
 const y=fixture(null,{readFails:true});try{await settle();assert.equal(y.el('extension-recovery').hidden,false);assert.equal(y.el<HTMLButtonElement>('extension-pick').disabled,true);y.el<HTMLButtonElement>('extensions-close').onclick?.(new Event('click') as any);y.allowRead();y.el<HTMLButtonElement>('extensions-open').onclick?.(new Event('click') as any);await settle();assert.equal(y.el('extension-recovery').hidden,true);assert.equal(y.el<HTMLButtonElement>('extension-pick').disabled,false);
 }finally{y.cleanup();}
});
