import {AtlasRegionCache} from '../src/app/storage/atlas-region-cache';
import {computeTerrainStroke,TerrainScalePyramid} from '../src/app/storage/terrain-scale';
import {terrainTraceStart} from '../src/app/terrain-timing';
import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';
import {takeTerrainTrace} from '../src/app/terrain-timing';
import { AtlasRegionReader } from '../src/app/storage/atlas-region';
import {AtlasReadCancelled} from '../src/app/storage/atlas-read-cancellation';

const db = new Database(workerData.filename, { readonly: true, fileMustExist: true }),
  reader = new AtlasRegionReader(db, workerData.shadow,workerData.cacheDirectory&&!workerData.shadow?new AtlasRegionCache(workerData.cacheDirectory):undefined),pyramid=new TerrainScalePyramid();

let preparation:{fence:string;stroke:string;steps:Generator<void>}|undefined;
let projection:{fence:string;query:string;steps:ReturnType<AtlasRegionReader['terrainSteps']>|ReturnType<AtlasRegionReader['colorSteps']>|ReturnType<AtlasRegionReader['liveTerrainSteps']>}|undefined;

parentPort!.on('message', async (job: any) => {
  if(projection&&(projection.fence!==job.source.fence||['terrain-live','terrain-stroke','region'].includes(job.kind)))projection=undefined;
  const geometry=['region','focus','candidates','hit'].includes(job.kind);
  let syncStarted=false,readStarted=false,endRead:(()=>void)|undefined;
  try {
    db.exec('BEGIN');
    // The first SELECT pins the WAL snapshot before async index maintenance.
    // A queued source must never label newer terrain rows as an older revision.
    if(job.kind==='terrain-live'||job.kind==='terrain-stroke'||job.kind==='terrain'||job.kind==='terrain-color'||job.kind==='terrain-refine'){
      const root=db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(job.source.campaignId) as {revision:number}|undefined;
      if(root?.revision!==job.source.revision)throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
    }
    const endSync=terrainTraceStart("region.sync",job.source.revision);
    syncStarted=true;await reader.sync(job.source,geometry);pyramid.sync(db,job.source);endSync();
    if(job.kind==='terrain-stroke'){
      const stroke=JSON.stringify(job.stroke);
      if(!job.continuation)preparation={fence:job.source.fence,stroke,steps:pyramid.warm(db,job.source.campaignId,job.stroke)};
      if(!preparation||preparation.fence!==job.source.fence||preparation.stroke!==stroke)throw Error('Geländeberechnung inzwischen ersetzt.');
      if(!preparation.steps.next().done){db.exec('COMMIT');parentPort!.postMessage({value:{terrainContinuation:true}});return;}
      preparation=undefined;
    }
    endRead=terrainTraceStart("region.read",job.source.revision);readStarted=true;
    let value;
    if(job.kind==='terrain'||job.kind==='terrain-color'||job.kind==='terrain-refine'){
      const query=JSON.stringify([job.kind,job.query,job.base]);
      if(!job.continuation)projection={fence:job.source.fence,query,steps:job.kind==='terrain-refine'?reader.liveTerrainSteps(job.source,job.query,job.base):job.kind==='terrain-color'?reader.colorSteps(job.source,job.query):reader.terrainSteps(job.source,job.query)};
      if(!projection||projection.fence!==job.source.fence||projection.query!==query)throw Error('Geländeberechnung inzwischen ersetzt.');
      const step=projection.steps.next();
      if(!step.done){
        endRead();db.exec('COMMIT');
        const terrainTrace=takeTerrainTrace();parentPort!.postMessage({value:{terrainProjectionContinuation:true},...(terrainTrace?{terrainTrace}:{})});return;
      }
      projection=undefined;value=step.value;
    }else value = job.kind === 'terrain-stroke' ? {fence:job.source.fence,revision:job.source.revision,stroke:JSON.stringify(job.stroke),records:computeTerrainStroke(db,job.source.campaignId,job.stroke,pyramid,job.stroke.visibility?reader.terrainVisibility(job.source,job.stroke.visibility):undefined)} : job.kind === 'terrain-live' ? reader.liveTerrain(job.source,job.query,job.base) : job.kind === 'focus'
      ? reader.focus(job.source, job.objectKind, job.id)
      : job.kind === 'candidates'
        ? reader.candidatesAt(job.source, job.query, job.point, job.offset, job.layer, job.visualElementId)
        : job.kind === 'hit'
          ? reader.hit(job.source, job.query, job.point)
          : reader.read(job.source, job.query,job.cancellation);
    endRead();db.exec('COMMIT');
    const terrainTrace=takeTerrainTrace();
    parentPort!.postMessage({ value,...(terrainTrace?{terrainTrace}:{} ) });
  } catch (error) {
    endRead?.();
    if(error instanceof AtlasReadCancelled&&readStarted){
      // Read iterators have unwound. Keep the completed TEMP index maintenance:
      // rolling it back would make every camera successor rebuild the world.
      db.exec('COMMIT');
      const terrainTrace=takeTerrainTrace();
      parentPort!.postMessage({value:{regionReadCancelled:true},...(terrainTrace?{terrainTrace}:{})});return;
    }
    if(job.kind==='terrain-stroke')preparation=undefined;
    if(job.kind==='terrain'||job.kind==='terrain-color'||job.kind==='terrain-refine')projection=undefined;
    if (db.inTransaction) {
      db.exec('ROLLBACK');if(syncStarted)reader.rollback(geometry);
    }
    const terrainTrace=takeTerrainTrace();
    parentPort!.postMessage({ error: (error as Error).message,...(terrainTrace?{terrainTrace}:{} ) });
  }
});
