import type {AtlasCommand,AtlasCommitAck} from './campaign-atlas-contracts';
import type {TerrainLiveAction,TerrainLiveContext} from './terrain-live-stroke';

type Source=Pick<TerrainLiveContext,'expectedRevision'|'sourceFence'>;
export interface TerrainQueueCapture {readonly ordinal:number;readonly id:string;readonly action:TerrainLiveAction}
function immutable<T>(value:T):T {if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))immutable(v);}return value;}
/** Durable owner of accepted, not yet checkpointed input; independent of any UI queue instance. */
export class TerrainStrokeJournal {
 private captures=new Map<number,TerrainQueueCapture>();
 private next=0;
 private waiters:{resolve:()=>void;reject:(e:unknown)=>void}[]=[];
 prefix=0;
 failure:unknown;
 generation=0;
 get frozen(){return this.failure!==undefined;}
 get entries():readonly TerrainQueueCapture[]{return [...this.captures.values()];}
 get size(){return this.captures.size;}
 capture(action:TerrainLiveAction,id:string){
  if(this.frozen)throw this.failure;
  if(this.size>=32)throw Error('Zu viele offene Pinselzüge. Aktiven Zug halten.');
  if(this.entries.some(e=>e.id===id))throw Error('Pinselzug bereits angenommen.');
  const entry=Object.freeze({ordinal:++this.next,id,action:immutable(structuredClone(action))});this.captures.set(entry.ordinal,entry);return entry;
 }
 confirm(entry:TerrainQueueCapture){
  if(this.frozen)throw this.failure;
  if(entry.ordinal!==this.prefix+1||this.captures.get(entry.ordinal)!==entry)throw Error('Autorenpräfix inzwischen geändert.');
  this.prefix=entry.ordinal;this.captures.delete(entry.ordinal);
  for(const w of this.waiters.splice(0))w.resolve();
 }
 freeze(error:unknown){if(!this.frozen){this.failure=error??Error('Speicherstand ungeklärt.');this.generation++;}for(const w of this.waiters.splice(0))w.reject(this.failure);}
 /** Called only after the bound canonical checkpoint has installed. */
 resumeHead(entry:TerrainQueueCapture,generation:number){if(!this.frozen||this.generation!==generation||this.entries[0]!==entry||entry.ordinal!==this.prefix+1)throw Error('Speicherklärung inzwischen geändert.');this.failure=undefined;this.confirm(entry);}
 discard(entries:readonly TerrainQueueCapture[],generation:number){if(!this.frozen||this.generation!==generation||entries.length!==this.size||this.entries.some((e,i)=>e!==entries[i]))throw Error('Gehaltene Züge inzwischen geändert.');this.captures.clear();}
 /** A held, not-yet-accepted gesture can leave without waiting for storage.
  * Removing its waiter must never remove an accepted journal capture. */
 capacity(signal?:AbortSignal):Promise<boolean>{
  if(this.frozen)return Promise.reject(this.failure);if(signal?.aborted)return Promise.resolve(false);if(this.size<32)return Promise.resolve(true);
  return new Promise<boolean>((resolve,reject)=>{
   const cleanup=()=>{const at=this.waiters.indexOf(waiter);if(at>=0)this.waiters.splice(at,1);signal?.removeEventListener('abort',abort);};
   const abort=()=>{cleanup();resolve(false);};
   const waiter={resolve:()=>{cleanup();resolve(true);},reject:(error:unknown)=>{cleanup();reject(error);}};
   this.waiters.push(waiter);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  });
 }
}
/** Writes serialize through the complete asynchronous checkpoint. A failed or
 * uncertain receipt retains every dependent immutable capture in the journal. */
export interface TerrainQueueAbsence {readonly outcome:'not-applied';readonly command:AtlasCommand;readonly receipt:{readonly commandId:string;readonly fingerprint:string};current():boolean}
export interface TerrainQueueRecovery {readonly queue:TerrainStrokeQueue;readonly generation:number;readonly head:TerrainQueueCapture;readonly entries:readonly TerrainQueueCapture[];readonly source:Source}
export class TerrainStrokeQueue {
 private tail:Promise<void>=Promise.resolve();
 private count=0;
 private attempted=new Set<TerrainQueueCapture>();
 private recovering:Promise<void>|null=null;
 private source:Source;
 get confirmedSource(){return {...this.source};}
 get pending(){return this.count;}
 get failed(){return this.journal.frozen;}
 constructor(source:Source,private write:(a:TerrainLiveAction,c:TerrainLiveContext)=>Promise<AtlasCommitAck>,private accepted:(ack:AtlasCommitAck,entry:TerrainQueueCapture)=>void|Promise<void>=()=>{},readonly journal=new TerrainStrokeJournal()){this.source={...source};}
 captureRecovery():TerrainQueueRecovery|null{const entries=this.journal.entries;return this.failed&&entries.length?Object.freeze({queue:this,generation:this.journal.generation,head:entries[0]!,entries:Object.freeze(entries),source:Object.freeze({...this.source})}):null;}
 recoveryCurrent(b:TerrainQueueRecovery){const entries=this.journal.entries;return b.queue===this&&this.failed&&b.generation===this.journal.generation&&entries.length===b.entries.length&&entries.every((e,i)=>e===b.entries[i])&&b.source.expectedRevision===this.source.expectedRevision&&b.source.sourceFence===this.source.sourceFence;}
 unwritten(b:TerrainQueueRecovery){if(!this.recoveryCurrent(b))throw Error('Speicherklärung inzwischen geändert.');return b.entries.filter(e=>!this.attempted.has(e));}
 /** No writer for the recovered head; existing immutable suffix entries alone
  * return to their ordinary serial write/checkpoint path. */
 recoverApplied(b:TerrainQueueRecovery,ack:AtlasCommitAck,install:()=>Promise<void>,adopted:()=>void=()=>{}):Promise<void>{
  if(this.recovering)return this.recovering;
  const task=(async()=>{await this.tail;if(!this.recoveryCurrent(b)||!this.attempted.has(b.head))throw Error('Speicherklärung inzwischen geändert.');await install();if(!this.recoveryCurrent(b))throw Error('Speicherklärung inzwischen geändert.');this.journal.resumeHead(b.head,b.generation);this.attempted.delete(b.head);this.source={expectedRevision:ack.revision,sourceFence:ack.sourceFence!};adopted();for(const entry of b.entries.slice(1))this.schedule(entry).catch(()=>{});await this.finish();})();
  this.recovering=task;void task.finally(()=>{if(this.recovering===task)this.recovering=null;}).catch(()=>{});return task;
 }
 absenceCurrent(b:TerrainQueueRecovery,w:TerrainQueueAbsence){const c=w.command;return this.recoveryCurrent(b)&&this.count===0&&!this.recovering&&w.outcome==='not-applied'&&w.current()&&!c.target&&c.commandId===w.receipt.commandId&&!!w.receipt.fingerprint&&c.terrainStroke?.id===b.head.id&&c.terrainStroke.expectedRevision===b.source.expectedRevision&&c.sourceFence===b.source.sourceFence&&JSON.stringify(c.action)===JSON.stringify(b.head.action)&&this.attempted.has(b.head)&&b.entries.slice(1).every(e=>!this.attempted.has(e));}
 discardUnapplied(b:TerrainQueueRecovery,entries:readonly TerrainQueueCapture[],w:TerrainQueueAbsence){if(!this.absenceCurrent(b,w)||entries.length!==b.entries.length||entries.some((e,i)=>e!==b.entries[i]))throw Error('Nicht gespeicherte Züge inzwischen geändert.');this.journal.discard(b.entries,b.generation);this.attempted.clear();}
 discardApplied(b:TerrainQueueRecovery,unwritten:readonly TerrainQueueCapture[]){if(!this.recoveryCurrent(b)||this.count||this.recovering||!this.attempted.has(b.head)||b.entries.slice(1).some(e=>this.attempted.has(e))||unwritten.length!==b.entries.length-1||unwritten.some((e,i)=>e!==b.entries[i+1]))throw Error('Gehaltene Folgezüge inzwischen geändert.');this.journal.discard(b.entries,b.generation);this.attempted.clear();}
 enqueue(action:TerrainLiveAction,id:string):Promise<void>{
  let entry:TerrainQueueCapture;try{entry=this.journal.capture(action,id);}catch(error){return Promise.reject(error);}return this.schedule(entry);
 }
 private schedule(entry:TerrainQueueCapture):Promise<void>{
  this.count++;
  const next=this.tail.then(async()=>{
   if(this.failed)throw this.journal.failure;
   this.attempted.add(entry);const ack=await this.write(entry.action,{id:entry.id,...this.source});
   if(this.failed)throw this.journal.failure;
   if(!ack.sourceFence||!Number.isSafeInteger(ack.revision)||ack.revision<this.source.expectedRevision)throw Error('Speicherbestätigung des Pinselzugs unvollständig. Speicherstand klären.');
   await this.accepted(ack,entry);
   if(this.failed)throw this.journal.failure;
   this.journal.confirm(entry);this.attempted.delete(entry);this.source={expectedRevision:ack.revision,sourceFence:ack.sourceFence};
  }).catch(error=>{this.journal.freeze(error);throw error;}).finally(()=>{this.count--;});
  this.tail=next.catch(()=>{});return next;
 }
 async finish(){await this.tail;if(this.failed)throw this.journal.failure;}
}

/** Holds one local gesture. Storage starts only at pointer-up; subsequent
 * gestures can use its displayed result while its receipt is outstanding. */
export class TerrainDraftStroke {
  private action:TerrainLiveAction|null=null;
  private completed:Promise<void>|null=null;
  hasCommittedChanges=false;
  constructor(private commit:(action:TerrainLiveAction)=>Promise<void>){}
  update(action:TerrainLiveAction){if(!this.completed)this.action=structuredClone(action);}
  finish(){return this.completed??=this.action?this.commit(this.action).then(()=>{this.hasCommittedChanges=true;}):Promise.resolve();}
  stop(){this.action=null;return this.completed??Promise.resolve();}
}
