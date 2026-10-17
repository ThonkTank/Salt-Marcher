import {Worker} from 'node:worker_threads';
import {join} from 'node:path';
import type {AtlasRegionSource,AtlasRegionQuery,AtlasRegionGeometry,AtlasObjectFocus} from '../src/app/atlas-region-contracts';
import {REGION_CACHE_BYTES} from '../src/app/atlas-region-contracts';
/** One persistent readonly worker. Replacement waits for the actual predecessor exit. */
export class AtlasRegionService {
 private worker:Worker|null=null;private identity='';private exit:Promise<unknown>=Promise.resolve();private pending:{resolve:(v:any)=>void;reject:(e:Error)=>void}|null=null;
 private generation=0;private closed=false;private source:AtlasRegionSource|null=null;
 private cache=new Map<string,{json:string;bytes:number}>();private cacheBytes=0;
 constructor(private workerFile=join(__dirname,'atlas-region-worker.cjs'),private cacheLimit=REGION_CACHE_BYTES){}
 get cursor(){return this.source?{epoch:this.source.epoch,sequence:this.source.sequence}:undefined;}
 cancel(){this.generation++;const worker=this.worker;this.worker=null;this.identity='';this.source=null;this.pending?.reject(new Error('Kartenausschnitt abgebrochen.'));this.pending=null;if(worker)void worker.terminate();}
 async cancelAndWait(){this.cancel();await this.exit;}
 async close(){this.closed=true;await this.cancelAndWait();this.cache.clear();this.cacheBytes=0;}
 private async run(source:AtlasRegionSource,job:object){
  const identity=JSON.stringify([source.filename,source.campaignId,source.token,source.epoch]);
  if(this.pending||this.identity!==identity)this.cancel();const generation=this.generation;await this.exitIfStopped();
  if(this.closed||generation!==this.generation)throw new Error('Kartenausschnitt abgebrochen.');
  if(!this.worker){
   const worker=new Worker(this.workerFile,{workerData:{filename:source.filename}});this.worker=worker;this.identity=identity;
   this.exit=new Promise(resolve=>worker.once('exit',resolve));
   worker.on('message',result=>{if(this.worker!==worker)return;const pending=this.pending;this.pending=null;if(result.error)pending?.reject(new Error(result.error));else pending?.resolve(result.value);});
   const fail=(e:Error)=>{if(this.worker!==worker)return;this.pending?.reject(e);this.pending=null;this.worker=null;this.source=null;this.identity='';};
   worker.once('error',e=>fail(e));worker.once('exit',()=>fail(new Error('Kartenausschnitt ohne Ergebnis beendet.')));
   source={...source,reset:true};
  }
  const value=await new Promise<any>((resolve,reject)=>{this.pending={resolve,reject};this.worker!.postMessage({...job,source});});
  if(this.closed||generation!==this.generation)throw new Error('Kartenausschnitt abgebrochen.');this.source=source;return value;
 }
 private async exitIfStopped(){if(!this.worker)await this.exit;}
 async read(source:AtlasRegionSource,query:AtlasRegionQuery):Promise<AtlasRegionGeometry>{
  if(this.closed)throw new Error('Kartenausschnitt abgebrochen.');
  const key=JSON.stringify([source.filename,source.token,source.fence,query]);
  const hit=this.cache.get(key);if(hit){this.cache.delete(key);this.cache.set(key,hit);return JSON.parse(hit.json);}
  const value=await this.run(source,{kind:'region',query}) as AtlasRegionGeometry,json=JSON.stringify(value),size=(json.length+key.length)*2;
  while(this.cacheBytes+size>this.cacheLimit&&this.cache.size){const [old,c]=this.cache.entries().next().value!;this.cache.delete(old);this.cacheBytes-=c.bytes;}
  if(size<=this.cacheLimit){this.cache.set(key,{json,bytes:size});this.cacheBytes+=size;}return value;
 }
 focus(source:AtlasRegionSource,kind:'room'|'city'|'building'|'element'|'scope',id:string):Promise<AtlasObjectFocus>{return this.run(source,{kind:'focus',objectKind:kind,id});}
 hit(source:AtlasRegionSource,query:AtlasRegionQuery,point:{x:number;y:number}):Promise<AtlasObjectFocus|null>{return this.run(source,{kind:'hit',query,point});}
}
