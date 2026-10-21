import {applyTerrainFrame,type TerrainFullFrame,type TerrainFrameIdentity,type TerrainFrame,type TerrainIdentity} from './terrain-frame';
export type {TerrainFrame,TerrainIdentity,TerrainInvalidation,TerrainFullFrame,TerrainFrameIdentity} from './terrain-frame';
import type {AtlasRegionQuery,AtlasRegionSource} from './atlas-region-contracts';
import type {TerrainProjectionRequest} from './terrain-projection';

export type TerrainFrameQuery =
  | {kind:'top';query:AtlasRegionQuery;detail?:import('./atlas-landscape').LandscapeBox}
  | {kind:'tilted';query:TerrainProjectionRequest};
export interface TerrainFrameRequest {source:TerrainIdentity;frame:TerrainFrameQuery;base?:TerrainFrameIdentity}
/** Valid only after the worker has pinned and checked the requested revision.
 * Receipt-only/no-op writes can change the connection fence without changing
 * terrain. The journal distinguishes those from unversioned source changes.
 */
export function terrainSnapshotStillValid(source:AtlasRegionSource,current:AtlasRegionSource){
  return current.filename===source.filename&&current.token===source.token&&
    current.campaignId===source.campaignId&&current.epoch===source.epoch&&
    JSON.stringify(current.shadow)===JSON.stringify(source.shadow)&&
    (current.revision>source.revision||current.revision===source.revision&&current.sequence===source.sequence);
}
/** Independent display lane: one read and one latest confirmed successor.
 * An older completed snapshot can be shown while newer writes continue.
 * It is never relabelled with the requested revision.
 */
export class TerrainPresentation {
  private wanted:TerrainIdentity|null=null;
  private running:Promise<void>|null=null;
  private stopped=false;
  private shown=-1;
  private frame:TerrainFullFrame|undefined;
  constructor(private read:(identity:TerrainIdentity,base?:TerrainFrameIdentity)=>Promise<TerrainFrame>,
    private present:(frame:TerrainFullFrame)=>void,private failed:(error:unknown)=>void){}
  update(identity:TerrainIdentity){
    if(this.stopped)return;
    this.wanted=identity;
    if(!this.running)this.running=this.pump().finally(()=>{this.running=null;});
  }
  private async pump(){
    while(this.wanted&&!this.stopped){
      const source=this.wanted;this.wanted=null;
      try{
        const frame=await this.read(source,this.frame?.target);
        if(!this.stopped&&frame.target.revision>=source.revision&&frame.target.revision>this.shown){
          this.frame=applyTerrainFrame(this.frame,frame);this.present(this.frame);this.shown=frame.target.revision;
        }
        const successor=this.wanted as TerrainIdentity|null; // update() may run while read() is awaited.
        if(successor&&successor.revision<=this.shown)this.wanted=null;
      }catch(error){
        // A write can win the race before a worker opens its snapshot. A newer
        // confirmed successor retries that read; author commands are never retried.
        if(!this.stopped&&!(this.wanted&&String(error).includes('inzwischen geändert')))this.failed(error);
      }
    }
  }
  /** Writers have finished. Keep their already requested final snapshot visible
   * before releasing the gesture; cancellation still uses stop() immediately. */
  async finish(){await this.running;this.stop();}
  stop(){this.stopped=true;this.wanted=null;this.frame=undefined;}
}
