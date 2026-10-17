import {Worker} from 'node:worker_threads';
import {join} from 'node:path';
import type {AtlasRegionSource,AtlasRegionQuery,AtlasRegionGeometry,AtlasObjectFocus,AtlasHitPage} from '../src/app/atlas-region-contracts';
import {REGION_CACHE_BYTES} from '../src/app/atlas-region-contracts';
type Queued={source:AtlasRegionSource;job:object;resolve:(value:any)=>void;reject:(error:Error)=>void};
/** One readonly worker, one active request and one replaceable successor. Camera motion never destroys its index. */
export class AtlasRegionService {
 private worker:Worker|null=null;private identity='';private exit:Promise<unknown>=Promise.resolve();private pending:{resolve:(v:any)=>void;reject:(e:Error)=>void}|null=null;
 private generation=0;private closed=false;private source:AtlasRegionSource|null=null;private queued:Queued|null=null;private draining=false;private starts=0;
 private cache=new Map<string,{json:string;bytes:number}>();private cacheBytes=0;
 constructor(private workerFile=join(__dirname,'atlas-region-worker.cjs'),private cacheLimit=REGION_CACHE_BYTES){}
 get cursor(){return this.source?{epoch:this.source.epoch,sequence:this.source.sequence,...(this.source.shadow?{shadow:{epoch:this.source.shadow.epoch,sequence:this.source.shadow.sequence}}:{})}:undefined;}
 get diagnostics(){return{workerStarts:this.starts,active:!!this.pending,queued:!!this.queued,cacheBytes:this.cacheBytes};}
 private sourceIdentity(s:AtlasRegionSource){return JSON.stringify([s.filename,s.campaignId,s.token,s.epoch,s.shadow?.filename,s.shadow?.scopeId,s.shadow?.epoch]);}
 cancel(){this.generation++;const worker=this.worker;this.worker=null;this.identity='';this.source=null;this.pending?.reject(new Error('Kartenausschnitt abgebrochen.'));this.pending=null;this.queued?.reject(new Error('Kartenausschnitt abgebrochen.'));this.queued=null;if(worker)void worker.terminate();}
 async cancelAndWait(){this.cancel();await this.exit;}
 async close(){this.closed=true;await this.cancelAndWait();this.cache.clear();this.cacheBytes=0;}
 private enqueue(source:AtlasRegionSource,job:object){
  if(this.closed)return Promise.reject(new Error('Kartenausschnitt abgebrochen.'));
  if(this.worker&&this.sourceIdentity(source)!==this.identity)this.cancel();
  this.queued?.reject(new Error('Kartenausschnitt durch neuere Anfrage ersetzt.'));
  const promise=new Promise<any>((resolve,reject)=>{this.queued={source,job,resolve,reject};});void this.drain();return promise;
 }
 private async drain(){
  if(this.draining)return;this.draining=true;
  try{while(this.queued&&!this.closed){const request=this.queued;this.queued=null;try{request.resolve(await this.run(request.source,request.job));}catch(e){request.reject(e as Error);}}}
  finally{this.draining=false;}
 }
 private async run(source:AtlasRegionSource,job:object){
  const identity=this.sourceIdentity(source),generation=this.generation;if(!this.worker)await this.exit;
  if(this.closed||generation!==this.generation)throw new Error('Kartenausschnitt abgebrochen.');
  if(!this.worker){
   const worker=new Worker(this.workerFile,{workerData:{filename:source.filename,shadow:source.shadow}});this.starts++;this.worker=worker;this.identity=identity;
   this.exit=new Promise(resolve=>worker.once('exit',resolve));
   worker.on('message',result=>{if(this.worker!==worker)return;const pending=this.pending;this.pending=null;if(result.error)pending?.reject(new Error(result.error));else pending?.resolve(result.value);});
   const fail=(e:Error)=>{if(this.worker!==worker)return;this.pending?.reject(e);this.pending=null;this.worker=null;this.source=null;this.identity='';};
   worker.once('error',fail);worker.once('exit',()=>fail(new Error('Kartenausschnitt ohne Ergebnis beendet.')));
   source={...source,reset:true};
  }else if(this.source?.fence===source.fence){
   // A successor captured before the first response has no cursor yet. Same source needs no rebuild.
   source={...source,reset:false,changes:[]};
  }
  const value=await new Promise<any>((resolve,reject)=>{this.pending={resolve,reject};this.worker!.postMessage({...job,source});});
  if(this.closed||generation!==this.generation)throw new Error('Kartenausschnitt abgebrochen.');this.source=source;return value;
 }
 async read(source:AtlasRegionSource,query:AtlasRegionQuery):Promise<AtlasRegionGeometry>{
  if(this.closed)throw new Error('Kartenausschnitt abgebrochen.');
  const key=JSON.stringify([source.filename,source.token,source.fence,query]);
  const hit=this.cache.get(key);if(hit){this.cache.delete(key);this.cache.set(key,hit);return JSON.parse(hit.json);}
  const value=await this.enqueue(source,{kind:'region',query}) as AtlasRegionGeometry,json=JSON.stringify(value),size=(json.length+key.length)*2;
  while(this.cacheBytes+size>this.cacheLimit&&this.cache.size){const [old,c]=this.cache.entries().next().value!;this.cache.delete(old);this.cacheBytes-=c.bytes;}
  if(size<=this.cacheLimit){this.cache.set(key,{json,bytes:size});this.cacheBytes+=size;}return value;
 }
 focus(source:AtlasRegionSource,kind:'room'|'city'|'building'|'element'|'scope',id:string):Promise<AtlasObjectFocus>{return this.enqueue(source,{kind:'focus',objectKind:kind,id});}
 hit(source:AtlasRegionSource,query:AtlasRegionQuery,point:{x:number;y:number}):Promise<AtlasObjectFocus|null>{return this.enqueue(source,{kind:'hit',query,point});}
 candidates(source:AtlasRegionSource,query:AtlasRegionQuery,point:{x:number;y:number},offset=0,layer:'geometry'|'landscape'|'all'='geometry'):Promise<AtlasHitPage>{return this.enqueue(source,{kind:'candidates',query,point,offset,layer});}
}
