import {mkdirSync,writeFileSync,readdirSync,readFileSync,copyFileSync,existsSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectTests} from './test-selection.mjs';
import {memoryLimit,testConcurrency,isMemoryBounded,cgroupMemory} from './local-check-policy.mjs';
import {runLocalCheck,propagateExit} from './run-local-check.mjs';
let selection;
try {selection=selectTests(process.argv.slice(2));}catch(error){console.error(error.message);process.exit(1);}
if(selection.list){console.log(selection.files.join('\n'));process.exit(0);}
if(process.platform==='linux'&&!process.env.CI&&!isMemoryBounded()){
 propagateExit(await runLocalCheck(process.execPath,[fileURLToPath(import.meta.url),...process.argv.slice(2)]));
} else {
 const concurrency=testConcurrency({requested:selection.concurrency,serial:selection.serial});
 const runDirectory=path.resolve('.build/test-runs',randomUUID());mkdirSync(runDirectory,{recursive:true});
 process.env.SALT_TEST_RUN_DIR=runDirectory;
 const start=performance.now();
 const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),node:process.version,concurrency,memoryLimitBytes:memoryLimit(),policy:process.env.CI?'ci':process.platform==='linux'?'bounded-local':'portable-local',files:selection.files,runDirectory};
 let result={code:1,signal:null};
 try {
  const {prepareTestCatalog}=await import('./test-assets.mjs');
  prepareTestCatalog();
  if(selection.files.includes('.build/tests.cjs')){
   const {ensureTestAsset,publishTestAlias}=await import('./test-assets.mjs');
   publishTestAlias(ensureTestAsset('core'),'.build/tests.cjs');
  }
  report.prepareMs=performance.now()-start;
  result=await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,['--test',`--test-concurrency=${concurrency}`,'--test-reporter=spec','--test-reporter=tap','--test-reporter-destination=stdout',`--test-reporter-destination=${path.join(runDirectory,'tests.tap')}`,...selection.files],{stdio:'inherit'});
   const onInt=()=>child.kill('SIGINT'),onTerm=()=>child.kill('SIGTERM');process.on('SIGINT',onInt);process.on('SIGTERM',onTerm);
   const clear=()=>{process.off('SIGINT',onInt);process.off('SIGTERM',onTerm);};
   child.once('error',e=>{clear();reject(e);});child.once('exit',(code,signal)=>{clear();resolve({code,signal});});
  });
 }catch(error){report.error=error.message;console.error(error);}
 report.totalMs=performance.now()-start;report.testMs=report.totalMs-(report.prepareMs??report.totalMs);
 report.assets=readdirSync(runDirectory).filter(f=>f.startsWith('asset-')).map(f=>JSON.parse(readFileSync(path.join(runDirectory,f),'utf8')));
 report.cgroup=cgroupMemory();
 Object.assign(report,result);
 if(existsSync(path.join(runDirectory,'tests.tap')))copyFileSync(path.join(runDirectory,'tests.tap'),'.build/tests.tap');
 const json=JSON.stringify(report,null,2)+'\n';writeFileSync(path.join(runDirectory,'report.json'),json);writeFileSync('.build/test-run.json',json);
 console.log(`Selected test run: ${(report.totalMs/1000).toFixed(1)}s; ${concurrency} test processes; ${report.assets.filter(a=>a.cache==='miss').length} shared builds, ${report.assets.filter(a=>a.cache==='hit').length} cache hits. Report: ${runDirectory}/report.json`);
 propagateExit(result);
}
