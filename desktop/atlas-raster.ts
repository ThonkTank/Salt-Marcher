import {Worker} from 'node:worker_threads';
import path from 'node:path';
import type {LandscapeBox} from '../src/app/atlas-landscape';
import type {LandscapeRaster} from '../src/app/landscape-raster';

/** One owned job per consumer; stale work is terminated, bounded PNGs cached. */
export class AtlasRasterService {
  private jobs=new Map<string,{worker:Worker;reject:(e:Error)=>void}>();
  private cache=new Map<string,LandscapeRaster>();
  private bytes=0;
  private generation=new Map<string,number>();
  private exits=new Map<string,Promise<void>>();
  private closed=false;
  constructor(private readonly workerFile=path.join(__dirname,'atlas-raster-worker.cjs'),private readonly byteLimit=64*1024*1024) {}
  async read(filename:string,campaignId:string,revision:number,box:LandscapeBox,width:number,height:number,consumer:'view'|'export'='view'):Promise<LandscapeRaster>{
    if(!box||Object.keys(box).length!==4||![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.width<=0||box.height<=0||!Number.isFinite(box.x+box.width)||!Number.isFinite(box.y+box.height)||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>1024||height>1024||!['view','export'].includes(consumer))throw new Error('Landschaftsübersicht prüfen.');
    if(this.closed)throw new Error('Landschaftsübersicht abgebrochen.');
    const key=JSON.stringify([filename,campaignId,revision,box,width,height]);
    this.cancel(consumer);
    const generation=this.generation.get(consumer);
    // Await exit even when the previous worker already posted its result.
    // A fast succession of camera requests must never grow a worker backlog.
    await this.exits.get(consumer);
    if(this.closed||generation!==this.generation.get(consumer))throw new Error('Landschaftsübersicht abgebrochen.');
    const hit=this.cache.get(key);if(hit){this.cache.delete(key);this.cache.set(key,hit);return hit;}
    const worker=new Worker(this.workerFile,{workerData:{filename,campaignId,revision,box,width,height}});
    const exit=new Promise<void>(resolve=>worker.once('exit',()=>resolve()));
    this.exits.set(consumer,exit);
    void exit.then(()=>{if(this.exits.get(consumer)===exit)this.exits.delete(consumer);});
    const value=await new Promise<LandscapeRaster>((resolve,reject)=>{
      this.jobs.set(consumer,{worker,reject});let done=false;
      const finish=(error?:Error,data?:{data:string})=>{
        if(done)return;done=true;if(this.jobs.get(consumer)?.worker===worker)this.jobs.delete(consumer);
        if(error)reject(error);else if(!data||typeof data.data!=='string'||data.data.length>8*1024*1024)reject(new Error('Landschaftsübersicht ungültig.'));
        else resolve({campaignId,revision,box:{...box},width,height,data:'data:image/png;base64,'+data.data});
      };
      worker.once('message',data=>finish(undefined,data));
      worker.once('error',()=>finish(new Error('Landschaftsübersicht konnte nicht berechnet werden.')));
      worker.once('exit',code=>{if(!done)finish(new Error(code?'Landschaftsübersicht abgebrochen.':'Landschaftsübersicht fehlt.'));});
    });
    if(this.closed||generation!==this.generation.get(consumer))throw new Error('Landschaftsübersicht abgebrochen.');
    const size=value.data.length*2;
    while(this.bytes+size>this.byteLimit&&this.cache.size){const [old,item]=this.cache.entries().next().value!;this.cache.delete(old);this.bytes-=item.data.length*2;}
    if(size<=this.byteLimit){this.cache.set(key,value);this.bytes+=size;}
    return value;
  }
  cancel(consumer:string){this.generation.set(consumer,(this.generation.get(consumer)??0)+1);const job=this.jobs.get(consumer);if(job){this.jobs.delete(consumer);job.reject(new Error('Landschaftsübersicht abgebrochen.'));void job.worker.terminate();}}
  close(){this.closed=true;for(const key of [...this.jobs.keys()])this.cancel(key);this.cache.clear();this.bytes=0;}
}
