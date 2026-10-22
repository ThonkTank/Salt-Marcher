// Read retained Chromium events; sums are wall durations, not additive CPU cost.
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const directory=process.argv[2];
if(!directory)throw Error('Pass a before/after evidence directory');
const events=JSON.parse(gunzipSync(await readFile(directory+'/layout-trace.json.gz')));
const groups=new Map();
for(const event of events){
  if(event.ph!=='X'||!['UpdateLayoutTree','Layout'].includes(event.name))continue;
  const stack=event.args?.beginData?.stackTrace??event.args?.data?.stackTrace??[];
  const key=event.name+': '+stack.slice(0,4).map(frame=>frame.functionName).join(' > ');
  const group=groups.get(key)??{count:0,wallMs:0};
  group.count++;group.wallMs+=event.dur/1000;groups.set(key,group);
}
const summary=Object.fromEntries([...groups].sort((a,b)=>b[1].wallMs-a[1].wallMs));
await writeFile(directory+'/layout-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(summary);
