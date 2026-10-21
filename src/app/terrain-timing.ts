/** Opt-in diagnostics only. Durations use the local monotonic clock; clocks from
 * different processes must never be subtracted. No geometry or campaign data. */
export interface TerrainTimingEvent {stage:string;start:number;duration:number;revision?:number}
export interface TerrainTiming {events:TerrainTimingEvent[];dropped:number}
const host=globalThis as typeof globalThis & {__saltTerrainTrace?:TerrainTiming;process?:{env?:Record<string,string|undefined>}};
if(host.process?.env?.SALTMARCHER_TERRAIN_TRACE==='1')host.__saltTerrainTrace??={events:[],dropped:0};
const noop=()=>{};
export function terrainTraceStart(stage:string,revision?:number):()=>void {
  const trace=host.__saltTerrainTrace;if(!trace)return noop;
  const start=performance.now();let ended=false;
  return()=>{if(ended)return;ended=true;if(trace.events.length>=4096){trace.dropped++;return;}
    trace.events.push({stage,start,duration:performance.now()-start,...(revision===undefined?{}:{revision})});};
}
export function terrainTraceMeasure<T>(stage:string,run:()=>T,revision?:number):T {
  const end=terrainTraceStart(stage,revision);try{return run();}finally{end();}
}
export function takeTerrainTrace():TerrainTiming|undefined {
  const trace=host.__saltTerrainTrace;if(!trace)return;
  host.__saltTerrainTrace={events:[],dropped:0};return trace;
}
