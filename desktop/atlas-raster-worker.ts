import {parentPort,workerData} from 'node:worker_threads';
import Database from 'better-sqlite3';
import {PNG} from 'pngjs';
import {LandscapeRasterizer} from '../src/app/landscape-raster';
import type {LandscapeBox} from '../src/app/atlas-landscape';
const job=workerData as {filename:string;campaignId:string;revision:number;box:LandscapeBox;width:number;height:number};
const db=new Database(job.filename,{readonly:true,fileMustExist:true});
try {
  const data=db.transaction(()=>{
    const root=db.prepare('SELECT revision FROM campaign_atlas WHERE campaign_id=?').get(job.campaignId) as {revision:number}|undefined;
    if(root?.revision!==job.revision)throw new Error('Atlasstand inzwischen geändert.');
    const image=new LandscapeRasterizer(job.box,job.width,job.height);
    const rows=db.prepare(`SELECT payload FROM atlas_landscape WHERE campaign_id=? AND max_x>=? AND min_x<=? AND max_y>=? AND min_y<=? AND json_extract(payload,'$.kind')='patch' AND json_extract(payload,'$.values.terrain') IS NOT NULL ORDER BY CAST(json_extract(payload,'$.resolution') AS REAL) DESC,coalesce(json_extract(payload,'$.order'),0),rowid`);
    for(const row of rows.iterate(job.campaignId,job.box.x,job.box.x+job.box.width,job.box.y,job.box.y+job.box.height) as Iterable<{payload:string}>)image.paint(JSON.parse(row.payload));
    return image.finish();
  })();
  const png=PNG.sync.write({width:job.width,height:job.height,data:Buffer.from(data)} as PNG);
  parentPort!.postMessage({data:png.toString('base64')});
} finally {db.close();}
