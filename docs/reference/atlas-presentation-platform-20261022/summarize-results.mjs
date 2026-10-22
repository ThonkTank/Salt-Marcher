import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const file=process.argv[2];if(!file?.endsWith('.json.gz'))throw Error('Pass a raw result.json.gz');
const r=JSON.parse(gunzipSync(await readFile(file)));
const summary={summary:true,rawEvidence:file.split('/').at(-1),source:r.source,dirty:r.dirty,artifacts:r.artifacts,launches:r.launches,errors:r.errors,records:r.records,populated:r.populated,large:r.large,mixedFixture:r.mixedFixture,measurement:r.measurement,opening:r.opening,traceComplete:r.traceComplete,metrics:r.metrics.map(m=>({name:m.name,wallMs:m.wallMs,p95Ms:m.p95Ms,p99Ms:m.p99Ms,maxMs:m.maxMs,frames:m.frames.length,longTasks:m.longTasks,brushFeedback:m.brushFeedback,state:m.state,status:m.status}))};
await writeFile(file.slice(0,-3),JSON.stringify(summary,null,2)+'\n');
