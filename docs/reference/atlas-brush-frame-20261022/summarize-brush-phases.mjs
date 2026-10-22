import {readFile,writeFile} from 'node:fs/promises';
const file=process.argv[2],r=JSON.parse(await readFile(file,'utf8'));
const metrics=r.metrics.map(m=>{
 const down=m.pointer.find(p=>p.type==='pointerdown')?.time,up=m.pointer.find(p=>p.type==='pointerup')?.time;
 if(down===undefined)return{name:m.name,p95:m.p95Ms,p99:m.p99Ms,max:m.maxMs};
 const draws=m.brushDraws.filter(d=>d.parent.includes('View.previewHeight')&&d.time>=down&&d.time<up&&d.frame!==null),frames=new Map();
 for(const d of draws){if(!frames.has(d.frame))frames.set(d.frame,[]);frames.get(d.frame).push(d);}
 const first=draws[0]?.frame,phases=m.brushPhases.filter(p=>p.frame===first);
 const height=m.brushPhases.filter(p=>p.name==='View.previewHeight'&&p.start>=down&&p.start<up);
 return{name:m.name,p95:m.p95Ms,p99:m.p99Ms,max:m.maxMs,heightDraws:draws.length,heightFrames:frames.size,duplicateHeightFrames:[...frames.values()].filter(a=>a.length>1).length,maxHeightDrawsPerFrame:Math.max(0,...[...frames.values()].map(a=>a.length)),firstHeightSubmissionMs:draws[0]?.time-down,firstFramePhases:phases.map(p=>({...p,start:p.start-down})),heightPreviewCpuMs:height.reduce((s,p)=>s+p.duration,0),longTasks:m.longTasks};
});
const summary={source:r.source,artifacts:r.artifacts,launches:r.launches,errors:r.errors,measurement:r.measurement,metrics};
await writeFile(file.replace(/\.json$/,'.summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(metrics.map(({firstFramePhases,...m})=>m),null,2));
