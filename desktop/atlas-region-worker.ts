import {computeTerrainStroke,TerrainScalePyramid} from '../src/app/storage/terrain-scale';
import {terrainTraceStart} from '../src/app/terrain-timing';
import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';
import {takeTerrainTrace} from '../src/app/terrain-timing';
import { AtlasRegionReader } from '../src/app/storage/atlas-region';

const db = new Database(workerData.filename, { readonly: true, fileMustExist: true }),
  reader = new AtlasRegionReader(db, workerData.shadow),pyramid=new TerrainScalePyramid();

let preparation:{fence:string;stroke:string;steps:Generator<void>}|undefined;
let projection:{fence:string;query:string;steps:ReturnType<AtlasRegionReader['terrainSteps']>}|undefined;

parentPort!.on('message', async (job: any) => {
  if(projection&&(projection.fence!==job.source.fence||['terrain-live','terrain-stroke','region'].includes(job.kind)))projection=undefined;
  try {
    db.exec('BEGIN');
    // The first SELECT pins the WAL snapshot before async index maintenance.
    // A queued source must never label newer terrain rows as an older revision.
    if(job.kind==='terrain-live'||job.kind==='terrain-stroke'||job.kind==='terrain'){
      const root=db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(job.source.campaignId) as {revision:number}|undefined;
      if(root?.revision!==job.source.revision)throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');
    }
    const endSync=terrainTraceStart("region.sync",job.source.revision);
    await reader.sync(job.source);pyramid.sync(db,job.source);endSync();
    if(job.kind==='terrain-stroke'){
      const stroke=JSON.stringify(job.stroke);
      if(!job.continuation)preparation={fence:job.source.fence,stroke,steps:pyramid.warm(db,job.source.campaignId,job.stroke)};
      if(!preparation||preparation.fence!==job.source.fence||preparation.stroke!==stroke)throw Error('Geländeberechnung inzwischen ersetzt.');
      if(!preparation.steps.next().done){db.exec('COMMIT');parentPort!.postMessage({value:{terrainContinuation:true}});return;}
      preparation=undefined;
    }
    const endRead=terrainTraceStart("region.read",job.source.revision);
    let value;
    if(job.kind==='terrain'){
      const query=JSON.stringify(job.query);
      if(!job.continuation)projection={fence:job.source.fence,query,steps:reader.terrainSteps(job.source,job.query)};
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
          : reader.read(job.source, job.query);
    endRead();db.exec('COMMIT');
    const terrainTrace=takeTerrainTrace();
    parentPort!.postMessage({ value,...(terrainTrace?{terrainTrace}:{} ) });
  } catch (error) {
    if(job.kind==='terrain-stroke')preparation=undefined;
    if(job.kind==='terrain')projection=undefined;
    if (db.inTransaction) {
      db.exec('ROLLBACK');
    }
    const terrainTrace=takeTerrainTrace();
    parentPort!.postMessage({ error: (error as Error).message,...(terrainTrace?{terrainTrace}:{} ) });
  }
});
