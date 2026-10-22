import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const directory=process.argv[2];
if(!directory)throw Error('Pass a before/after evidence directory');
const events=JSON.parse(gunzipSync(await readFile(directory+'/layout-trace.json.gz')));
const selectors={},bodyTriggers={};
let scheduled=0,recalculated=0;
for(const event of events){
  const data=event.args?.data;
  if(event.name==='ScheduleStyleInvalidationTracking'){
    scheduled++;
    if(data.nodeName?.startsWith('BODY')&&data.changedPseudo==='has'){
      const key=(data.stackTrace??[]).slice(0,2).map(frame=>frame.functionName).join(' > ');
      bodyTriggers[key]=(bodyTriggers[key]??0)+1;
    }
  }
  if(event.name==='StyleRecalcInvalidationTracking')recalculated++;
  if(event.name==='StyleInvalidatorInvalidationTracking')for(const {selector}of data.selectors??[])selectors[selector]=(selectors[selector]??0)+1;
}
const summary={scheduled,recalculated,bodyTriggers,selectors};
await writeFile(directory+'/invalidation-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(summary);
