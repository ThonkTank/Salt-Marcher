import type {AtlasCommitAck} from './campaign-atlas-contracts';
import type {TerrainLiveAction,TerrainLiveContext} from './terrain-live-stroke';

type Source=Pick<TerrainLiveContext,'expectedRevision'|'sourceFence'>;
/** Closed local gestures commit in author order. Camera cancellation never owns
 * this queue. A failed or uncertain receipt freezes every dependent gesture. */
export class TerrainStrokeQueue {
  private tail:Promise<void>=Promise.resolve();
  private count=0;
  private error:unknown;
  private source:Source;
  get confirmedSource(){return {...this.source};}
  get pending(){return this.count;}
  get failed(){return this.error!==undefined;}
  constructor(source:Source,private write:(a:TerrainLiveAction,c:TerrainLiveContext)=>Promise<AtlasCommitAck>,private accepted:(ack:AtlasCommitAck)=>void=()=>{}){this.source={...source};}
  enqueue(action:TerrainLiveAction,id:string):Promise<void>{
    if(this.failed)return Promise.reject(this.error);
    if(this.count>=32){this.error=Error('Zu viele offene Pinselzüge. Speicherstand klären.');return Promise.reject(this.error);}
    const snapshot=structuredClone(action);this.count++;
    const next=this.tail.then(async()=>{
      if(this.failed)throw this.error;
      const ack=await this.write(snapshot,{id,...this.source});
      if(!ack.sourceFence||!Number.isSafeInteger(ack.revision)||ack.revision<this.source.expectedRevision)
        throw Error('Speicherbestätigung des Pinselzugs unvollständig. Speicherstand klären.');
      this.source={expectedRevision:ack.revision,sourceFence:ack.sourceFence};this.accepted(ack);
    }).catch(error=>{this.error=error;throw error;}).finally(()=>{this.count--;});
    this.tail=next.catch(()=>{});return next;
  }
  async finish(){await this.tail;if(this.failed)throw this.error;}
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
