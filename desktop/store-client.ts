import {Worker} from 'node:worker_threads';
import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {storeMethods,specialMethods,type AsyncStoreOperations,type StoreOperation,type StoreArguments,type StoreResult} from './store-operations';
import {encodeStoreValue,decodeStoreValue,type StoreWire} from './store-transport';

export class StoreOutcomeUnknownError extends Error {
 constructor(detail:string){super('Speicherbestätigung ungeklärt. Keine automatische Wiederholung. Nach Neustart den Buchungsbeleg prüfen. '+detail);this.name='StoreOutcomeUnknownError';}
}
export interface StoreShutdown {databaseClosed:boolean;exitCode:number}
interface Pending {resolve:(value:any)=>void;reject:(error:Error)=>void}
/** Exactly one worker per host lifetime; failure is terminal until an ordered app restart. */
export class StoreClient extends EventEmitter {
 private worker:Worker;
 private pending=new Map<number,Pending>();
 private sequence=0;
 private state:'starting'|'ready'|'closing'|'failed'|'closed'='starting';
 private stopped:Promise<StoreShutdown>;
 private closeTask:Promise<StoreShutdown>|null=null;
 private databaseClosed=false;
 private rejectReady!:(error:Error)=>void;
 readonly ready:Promise<void>;
 constructor(readonly filename:string,applicationVersion:string,workerFile=join(__dirname,'store-worker.cjs')){
  super();
  this.worker=new Worker(workerFile,{workerData:{filename,applicationVersion}});
  let readyResolve:()=>void,readyReject:(error:Error)=>void;
  this.ready=new Promise<void>((resolve,reject)=>{readyResolve=resolve;readyReject=reject;this.rejectReady=reject;});
  // A caller may attach later; preserve rejection without creating an unhandled promise.
  void this.ready.catch(()=>{});
  const failed=(detail:string)=>{
   if(this.state==='closed'||this.state==='failed')return;
   this.state='failed';const error=new StoreOutcomeUnknownError(detail);readyReject(error);
   for(const pending of this.pending.values())pending.reject(error);this.pending.clear();this.emit('failure',error);
  };
  this.worker.on('message',(message:{kind:string;id?:number;value?:StoreWire;error?:string})=>{
   if(message.kind==='ready'){if(this.state==='starting'){this.state='ready';readyResolve();}return;}
   if(message.kind==='fatal'){failed(message.error??'Speicherprozess fehlgeschlagen.');return;}
   if(message.kind==='closed'){this.databaseClosed=true;return;}
   if(message.kind==='progress'){this.emit('progress',decodeStoreValue(message.value!));return;}
   const pending=this.pending.get(message.id!);if(!pending)return;
   this.pending.delete(message.id!);
   if(message.kind==='result')try{pending.resolve(decodeStoreValue(message.value!));}catch(error){pending.reject(new StoreOutcomeUnknownError(String(error)));}
   else pending.reject(message.kind==='unknown'?new StoreOutcomeUnknownError(message.error??'Antwort nicht übertragbar.'):new Error(message.error??'Store-Auftrag abgewiesen.'));
  });
  this.worker.once('error',error=>failed(error.message));
  this.stopped=new Promise(resolve=>this.worker.once('exit',exitCode=>{
   if(!this.databaseClosed||exitCode!==0||this.pending.size)failed('Speicherprozess unerwartet beendet.');
   this.state='closed';resolve({databaseClosed:this.databaseClosed&&exitCode===0,exitCode});
  }));
 }
 call<K extends StoreOperation>(method:K,...args:StoreArguments<K>):Promise<StoreResult<K>>{
  if(this.state!=='ready')return Promise.reject(new StoreOutcomeUnknownError('Speicherprozess ist nicht aufnahmebereit.'));
  let value:StoreWire;try{value=encodeStoreValue(args);}catch(error){return Promise.reject(error);}
  const id=++this.sequence;
  return new Promise((resolve,reject)=>{
   this.pending.set(id,{resolve,reject}); // must precede postMessage, including synchronous send failure
   try{this.worker.postMessage({kind:'call',id,method,value});}
   catch(error){this.pending.delete(id);reject(new StoreOutcomeUnknownError(String(error)));}
  });
 }
 close():Promise<StoreShutdown>{
  if(this.closeTask)return this.closeTask;
  if(this.state==='ready'||this.state==='starting'){if(this.state==='starting')this.rejectReady(new Error('Speicherstart beendet.'));this.state='closing';this.worker.postMessage({kind:'close'});}
  return this.closeTask=this.stopped;
 }
}
export interface StoreClient extends AsyncStoreOperations {}
for(const method of [...storeMethods,...specialMethods])Object.defineProperty(StoreClient.prototype,method,{value:function(this:StoreClient,...args:any[]){return this.call(method,...args as StoreArguments<typeof method>);}});
