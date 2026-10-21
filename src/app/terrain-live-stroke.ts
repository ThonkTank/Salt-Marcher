import {terrainTraceStart} from './terrain-timing';
import type {AtlasAction,AtlasCommitAck} from './campaign-atlas-contracts';
export type TerrainLiveAction=Extract<AtlasAction,{kind:'landscape-height-stroke'|'landscape-color-stroke'}>;
export interface TerrainLiveContext {id:string;expectedRevision:number;sourceFence:string}

/** One in-flight write and one coalesced snapshot. A failed/unknown write is never retried here. */
export class TerrainLiveStroke {
  private pending:{action:TerrainLiveAction;start:number;count:number}|null=null;
  private running:Promise<void>|null=null;
  private consumed=0;
  private queuedTiming:()=>void=()=>{};
  private stopped=false;
  private failure:unknown;
  private committedChanges=false;
  get hasCommittedChanges(){return this.committedChanges;}
  constructor(private context:TerrainLiveContext,private write:(a:TerrainLiveAction,c:TerrainLiveContext)=>Promise<AtlasCommitAck>,private failed:(error:unknown)=>void,private idle:()=>void=()=>{}){}
  update(action:TerrainLiveAction){
    if(this.stopped)return;
    this.queuedTiming();this.queuedTiming=terrainTraceStart("brush.queue");
    const count=action.kind==='landscape-height-stroke'?action.stroke.samples.length:0,start=Math.max(0,this.consumed-1);
    this.pending={count,start,action:structuredClone(action.kind==='landscape-height-stroke'?{...action,stroke:{...action.stroke,samples:action.stroke.samples.slice(start)}}:action)};
    if(!this.running){this.running=this.pump().finally(()=>{this.running=null;if(!this.stopped)this.idle();});}
  }
  private async pump(){
    try{
      while(this.pending&&!this.stopped){
        this.queuedTiming();
        const {action:snapshot,count,start}=this.pending;this.pending=null;
        if(count&&count<=Math.max(1,this.consumed))continue;
        const from=Math.max(0,this.consumed-1)-start;
        const action=snapshot.kind==='landscape-height-stroke'?{...snapshot,stroke:{...snapshot.stroke,samples:snapshot.stroke.samples.slice(from).map(p=>({...p,t:p.t-snapshot.stroke.samples[from]!.t}))}}:snapshot;
        const ack=await this.write(action,{...this.context});
        if(!ack.sourceFence)throw Error('Speicherbestätigung des Pinselzugs unvollständig. Speicherstand klären.');
        if(ack.revision>this.context.expectedRevision)this.committedChanges=true;
        this.context={...this.context,expectedRevision:ack.revision,sourceFence:ack.sourceFence};this.consumed=count;
      }
    }catch(error){this.failure=error;this.stopped=true;this.pending=null;this.failed(error);}
  }
  async finish(){await this.running;this.stopped=true;if(this.failure)throw this.failure;}
  async stop(){this.stopped=true;this.pending=null;await this.running;}
}
