import {availableParallelism,totalmem} from 'node:os';
import {readFileSync} from 'node:fs';
import path from 'node:path';
export function cgroupMemory() {
 const limits={high:null,max:null,peak:null,group:null};
 if(process.platform==='linux')try {
  const group=readFileSync('/proc/self/cgroup','utf8').split('\n').find(l=>l.startsWith('0::')).slice(3);
  limits.group=group;
  let directory=path.join('/sys/fs/cgroup',group);
  try{limits.peak=Number(readFileSync(path.join(directory,'memory.peak'),'utf8'));}catch{}
  for(;;){for(const file of ['memory.max','memory.high'])try {const n=Number(readFileSync(path.join(directory,file),'utf8').trim());if(Number.isFinite(n)&&n>0){const key=file==='memory.max'?'max':'high';limits[key]=Math.min(limits[key]??Infinity,n);}}catch{}
   if(directory==='/sys/fs/cgroup')break;directory=path.dirname(directory);
  }
 }catch{}
 return limits;
}
export function memoryLimit(){const limits=cgroupMemory();return Math.min(totalmem(),limits.high??Infinity,limits.max??Infinity);}
export function isMemoryBounded(){const limits=cgroupMemory();return limits.max!==null&&limits.max<=3*1024**3&&Math.min(limits.high??Infinity,limits.max)<=2*1024**3;}
export function testConcurrency({requested,serial=false,bytes=memoryLimit(),cpus=availableParallelism(),ci=!!process.env.CI}={}) {
 if(requested!==undefined&&(!Number.isSafeInteger(requested)||requested<1))throw Error('Concurrency must be a positive integer.');
 if(serial&&requested!==undefined&&requested!==1)throw Error('--serial conflicts with --concurrency.');
 // Reserve capacity for the runner and native/esbuild children; do not size by CPU alone.
 const ceiling=Math.max(1,Math.min(4,cpus,Math.floor((bytes-512*1024**2)/(2*1024**3))));
 if(requested>ceiling)throw Error(`Requested ${requested} workers exceeds memory/CPU limit ${ceiling}.`);
 return serial?1:requested??(ci?ceiling:1);
}
