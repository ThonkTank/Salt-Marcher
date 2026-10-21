import {Worker} from 'node:worker_threads';
import {join} from 'node:path';

/** Read-only verification of one private snapshot. Publication stays in the store. */
export class BackupValidationService {
  private job: {worker:Worker; exit:Promise<void>} | null = null;
  private closed = false;
  constructor(private readonly workerFile=join(__dirname,'backup-validation-worker.cjs')) {}

  async validate(filename:string):Promise<void> {
    if(this.closed)throw Error('Sicherungsprüfung beendet.');
    if(this.job)throw Error('Sicherungsprüfung läuft bereits.');
    const worker=new Worker(this.workerFile,{workerData:{filename}});
    let response: {ok:boolean;error?:string}|undefined, failure:Error|undefined;
    // Wait for actual exit before the caller renames/removes the candidate.
    const exit=new Promise<void>(resolve=>worker.once('exit',code=>{
      if(code!==0&&!failure)failure=Error('Sicherungsprüfung unerwartet beendet.');
      resolve();
    }));
    const job={worker,exit};this.job=job;
    worker.once('message',value=>{response=value;});
    worker.once('error',error=>{failure=error;});
    try {
      await exit;
      if(this.closed)throw Error('Sicherungsprüfung beendet.');
      if(failure)throw failure;
      if(response?.ok!==true)throw Error(response?.error??'Sicherungsprüfung ohne Ergebnis beendet.');
    } finally {if(this.job===job)this.job=null;}
  }

  async close():Promise<void> {
    this.closed=true;
    const job=this.job;
    if(job){await job.worker.terminate();await job.exit;}
  }
}
