import {Worker} from 'node:worker_threads';
import path from 'node:path';
import type {CampaignStore} from '../src/app/storage/store';
import type {LandscapeBox} from '../src/app/atlas-landscape';
import type {SpatialTerrainDraft} from '../src/app/spatial-terrain';
import type {VegetationScene} from '../src/app/vegetation';

let active:Worker|undefined;
/** One bounded proposal per desktop host; replacing a proposal cancels its worker. */
export async function spatialRoutePreview(store:CampaignStore,token:string,box:LandscapeBox,mpp:number,draft:SpatialTerrainDraft,fence?:string):Promise<VegetationScene>{
  const source=store.atlasRegionSource(token),revision=store.atlasIdentity(token).revision;
  if(fence!==undefined&&fence!==source.fence)throw Error('Gelände inzwischen geändert. Vorschau erneut öffnen.');
  if(active)await active.terminate();
  return new Promise((resolve,reject)=>{
    const worker=new Worker(path.join(__dirname,'terrain-route-worker.cjs'),{workerData:{source,revision,box,mpp,draft}});active=worker;
    let settled=false;
    const finish=(error?:Error,value?:VegetationScene)=>{
      if(settled)return;settled=true;clearTimeout(timer);if(active===worker)active=undefined;void worker.terminate();
      if(error)reject(error);else{
        try{if(store.atlasRegionSource(token).fence!==source.fence)throw Error('Gelände inzwischen geändert. Vorschau erneut berechnen.');resolve(value!);}catch(e){reject(e);}
      }
    };
    const timer=setTimeout(()=>finish(Error('Planung dauert zu lange. Kürzeren Abschnitt wählen.')),15000);
    worker.once('message',r=>finish(r.error?Error(r.error):undefined,r.value));
    worker.once('error',e=>finish(e));worker.once('exit',()=>finish(Error('Planung abgebrochen.')));
  });
}
