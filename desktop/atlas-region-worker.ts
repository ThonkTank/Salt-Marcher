import {parentPort,workerData} from 'node:worker_threads';
import Database from 'better-sqlite3';
import {AtlasRegionReader} from '../src/app/storage/atlas-region';
const db=new Database(workerData.filename,{readonly:true,fileMustExist:true}),reader=new AtlasRegionReader(db,workerData.shadow);
parentPort!.on('message',async(job:any)=>{
 try{
  db.exec('BEGIN');await reader.sync(job.source);
  const value=job.kind==='focus'?reader.focus(job.source,job.objectKind,job.id):job.kind==='candidates'?reader.candidatesAt(job.source,job.query,job.point,job.offset,job.layer,job.visualElementId):job.kind==='hit'?reader.hit(job.source,job.query,job.point):reader.read(job.source,job.query);
  db.exec('COMMIT');parentPort!.postMessage({value});
 }catch(error){if(db.inTransaction)db.exec('ROLLBACK');parentPort!.postMessage({error:(error as Error).message});}
});
