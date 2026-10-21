import {parentPort,workerData} from 'node:worker_threads';
import {validateBackupCandidate} from '../src/app/storage/snapshot-validation';

try {
  validateBackupCandidate(workerData.filename);
  parentPort!.postMessage({ok:true});
} catch(error) {
  parentPort!.postMessage({ok:false,error:(error as Error).message});
}
