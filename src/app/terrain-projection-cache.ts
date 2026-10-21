import type {TerrainHeightSource} from './terrain-height-lattice';
import {TerrainCache,terrainBoxesOverlap} from './terrain-cache';
import {streamTerrainField,streamTerrainFieldSteps,streamTerrainFieldRows,streamTerrainFieldBlock,type TerrainField,type TerrainLattice,type TerrainStream} from './terrain-field-stream';
import type {LandscapeBox} from './atlas-landscape';
import {terrainDirtyRects} from './terrain-dirty-rects';
type Surface={kind:'surface';lattice:TerrainLattice;heights:Float32Array;ground?:Float32Array;levels?:Float32Array;dirty:Uint8Array};
type HeightBlock=Omit<TerrainHeightSource,'read'>&{values:Float32Array};
type Tile={kind:'height';block:HeightBlock}|Surface|{kind:'field';field:TerrainField}|{kind:'pixels';pixels:Uint8Array};
type GridData={surface:Float32Array;ground?:Float32Array;levels?:Float32Array};
/** 16 MiB of the consumer's 64 MiB derived-cache budget.
 * Other shares: landscape PNGs 8, response bases 8, Main's replies 16 canonical surface blocks 8 and scale pyramid 8 (64 MiB total).
 * Active frames, GPU allocations and temporary sampling fields are working memory, measured separately.
 */
export class TerrainProjectionCache {
  readonly tiles:TerrainCache<Tile>;
  private generation=0;
  constructor(limit=16*1024*1024){this.tiles=new TerrainCache<Tile>(limit);}
  invalidate(boxes:LandscapeBox[],reset=false){
    if(reset||boxes.length)this.generation++;
    if(reset){this.tiles.clear();return;}
    this.tiles.invalidate(boxes,(tile,changes)=>{
      if(tile.kind!=='surface')return false;
      for(const {index,box}of this.blocks(tile.lattice))
        if(!tile.dirty[index]&&changes.some(change=>terrainBoxesOverlap(box,change)))tile.dirty[index]=1;
      return true;
    });
  }
  field(lattice:TerrainLattice,sea:number,stream:TerrainStream,surface:boolean,band?:{first:number;count:number}){
    const key=JSON.stringify(['field',lattice,sea,surface,band]),hit=this.tiles.get(key);
    if(hit?.kind==='field')return hit.field;
    const field=band?streamTerrainFieldRows(lattice,band.first,band.count,sea,stream,surface):streamTerrainField(lattice,sea,stream,surface);
    const box={x:lattice.x-lattice.dx/2,y:lattice.y+(band?.first??0)*lattice.dy-lattice.dy/2,width:lattice.columns*lattice.dx,height:(band?.count??lattice.rows)*lattice.dy};
    this.tiles.put(key,box,{kind:'field',field},key.length*2+field.heights.byteLength+field.water.byteLength+(field.surface?.byteLength??0)+(field.levels?.byteLength??0));
    return field;
  }
  heightBlock(id:string){const hit=this.tiles.get('height:'+id);return hit?.kind==='height'?hit.block:undefined;}
  rememberHeightBlock(id:string,box:LandscapeBox,block:HeightBlock){
    const key='height:'+id;
    // Decoded numerical samples only: no author JSON/base64 or mutable record.
    this.tiles.put(key,box,{kind:'height',block},key.length*2+block.values.byteLength+512);
  }
  private *blocks(lattice:TerrainLattice){
    // The visibility lattice includes a large camera margin. A 32-node block
    // can cover a quarter of the authored world; four keeps local edits local.
    let index=0;
    for(let y=0;y<lattice.rows;y+=4)for(let x=0;x<lattice.columns;x+=4){
      const rect={x,y,width:Math.min(4,lattice.columns-x),height:Math.min(4,lattice.rows-y)};
      const box={x:lattice.x+(x-.5)*lattice.dx,y:lattice.y+(y-.5)*lattice.dy,width:rect.width*lattice.dx,height:rect.height*lattice.dy};
      yield {rect,index:index++,box};
    }
  }
  seedGrid(lattice:TerrainLattice,sea:number,heights:Float32Array,ground?:Float32Array,levels?:Float32Array){
    if(heights.length!==lattice.columns*lattice.rows||ground&&ground.length!==heights.length||levels&&levels.length!==heights.length||!!ground!==!!levels)throw Error('Geländerastergröße prüfen.');
    const key=JSON.stringify(['surface',lattice,sea]),dirty=new Uint8Array(Math.ceil(lattice.columns/4)*Math.ceil(lattice.rows/4));
    const box={x:lattice.x-lattice.dx/2,y:lattice.y-lattice.dy/2,width:lattice.columns*lattice.dx,height:lattice.rows*lattice.dy};
    // A single contiguous raster avoids thousands of key lookups and row copies.
    // Own the arrays: a returned frame or trusted worker seed must never alias it.
    this.tiles.put(key,box,{kind:'surface',lattice:{...lattice},heights:heights.slice(),ground:ground?.slice(),levels:levels?.slice(),dirty},key.length*2+heights.byteLength+(ground?.byteLength??0)+(levels?.byteLength??0)+dirty.byteLength+128);
  }
  grid(lattice:TerrainLattice,sea:number,stream:TerrainStream){return this.gridData(lattice,sea,stream,false).surface;}
  /** Editable ground and potential water levels share the surface's reads and invalidation. */
  gridData(lattice:TerrainLattice,sea:number,stream:TerrainStream,editable=true):GridData{
    const steps=this.gridDataSteps(lattice,sea,stream,function*(){},editable,65536);
    for(;;){const step=steps.next();if(step.done)return step.value;}
  }
  /** Completed row bands release all source iterators. Surface cache publication
   * stays atomic: cancellation, failure or invalidation never cleans a partial grid. */
  *gridDataSteps(lattice:TerrainLattice,sea:number,stream:TerrainStream,checkpoint:()=>Generator<void>,editable=true,maxSamples=4096):Generator<void,GridData>{
    const generation=this.generation,cache=this;
    function* pause(){yield* checkpoint();if(cache.generation!==generation)throw Error('Gelände inzwischen geändert. Ausschnitt erneut laden.');}
    const key=JSON.stringify(['surface',lattice,sea]),hit=this.tiles.get(key);
    // Cold/reset views stream each source through a few bands, not hundreds of
    // tiny queries/decodes. Subsequent local edits rebuild only dirty blocks.
    if(hit?.kind!=='surface'||editable&&!hit.ground||hit.dirty.reduce((sum,v)=>sum+v,0)>hit.dirty.length/2){
      const full=yield* streamTerrainFieldSteps(lattice,sea,stream,true,pause,maxSamples);
      const ground=editable?full.heights:undefined,levels=editable?full.levels:undefined;
      this.seedGrid(lattice,sea,full.surface!,ground,levels);return {surface:full.surface!,ground,levels};
    }
    const heights=hit.heights.slice(),ground=hit.ground?.slice(),levels=hit.levels?.slice();
    if(!hit.dirty.some(Boolean))return {surface:heights,ground,levels};
    for(const r of terrainDirtyRects(hit.dirty,lattice.columns,lattice.rows,4,maxSamples)){
      const part=streamTerrainFieldBlock(lattice,r,sea,stream);
      for(let y=0;y<r.height;y++){const start=y*r.width,end=(y+1)*r.width,offset=(r.y+y)*lattice.columns+r.x;
        heights.set(part.surface!.subarray(start,end),offset);ground?.set(part.heights.subarray(start,end),offset);levels?.set(part.levels!.subarray(start,end),offset);
      }
      yield* pause();
    }
    // Publish only after every dirty block succeeded. A failed source read leaves
    // the old grid dirty, and previously returned frames remain immutable.
    hit.heights.set(heights);if(ground)hit.ground!.set(ground);if(levels)hit.levels!.set(levels);hit.dirty.fill(0);
    return {surface:heights,ground,levels};
  }
  pixels(key:string,box:LandscapeBox,create:()=>Uint8Array){
    const hit=this.cachedPixels(key);if(hit)return hit;
    const pixels=create();this.rememberPixels(key,box,pixels);return pixels;
  }
  cachedPixels(key:string){
    const hit=this.tiles.get('pixels:'+key);return hit?.kind==='pixels'?hit.pixels:undefined;
  }
  rememberPixels(key:string,box:LandscapeBox,pixels:Uint8Array){
    key='pixels:'+key;this.tiles.put(key,box,{kind:'pixels',pixels},key.length*2+pixels.byteLength);
  }
}
