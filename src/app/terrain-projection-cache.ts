import {TerrainCache,terrainBoxesOverlap} from './terrain-cache';
import {streamTerrainField,streamTerrainFieldRows,streamTerrainFieldBlock,type TerrainField,type TerrainLattice,type TerrainStream} from './terrain-field-stream';
import type {LandscapeBox} from './atlas-landscape';
import {terrainDirtyRects} from './terrain-dirty-rects';
type Surface={kind:'surface';lattice:TerrainLattice;heights:Float32Array;dirty:Uint8Array};
type Tile=Surface|{kind:'field';field:TerrainField}|{kind:'pixels';pixels:Uint8Array};
/** 16 MiB of the consumer's 64 MiB derived-cache budget.
 * Other shares: landscape PNGs 8, response bases 8, Main's replies 16 canonical surface blocks 8 and scale pyramid 8 (64 MiB total).
 * Active frames, GPU allocations and temporary sampling fields are working memory, measured separately.
 */
export class TerrainProjectionCache {
  readonly tiles:TerrainCache<Tile>;
  constructor(limit=16*1024*1024){this.tiles=new TerrainCache<Tile>(limit);}
  invalidate(boxes:LandscapeBox[],reset=false){
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
    this.tiles.put(key,box,{kind:'field',field},key.length*2+field.heights.byteLength+field.water.byteLength+(field.surface?.byteLength??0));
    return field;
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
  seedGrid(lattice:TerrainLattice,sea:number,heights:Float32Array){
    if(heights.length!==lattice.columns*lattice.rows)throw Error('Geländerastergröße prüfen.');
    const key=JSON.stringify(['surface',lattice,sea]),dirty=new Uint8Array(Math.ceil(lattice.columns/4)*Math.ceil(lattice.rows/4));
    const box={x:lattice.x-lattice.dx/2,y:lattice.y-lattice.dy/2,width:lattice.columns*lattice.dx,height:lattice.rows*lattice.dy};
    // A single contiguous raster avoids thousands of key lookups and row copies.
    // Own the arrays: a returned frame or trusted worker seed must never alias it.
    this.tiles.put(key,box,{kind:'surface',lattice:{...lattice},heights:heights.slice(),dirty},key.length*2+heights.byteLength+dirty.byteLength+128);
  }
  grid(lattice:TerrainLattice,sea:number,stream:TerrainStream){
    const key=JSON.stringify(['surface',lattice,sea]),hit=this.tiles.get(key);
    // Cold/reset views stream each source through a few bands, not hundreds of
    // tiny queries/decodes. Subsequent local edits rebuild only dirty blocks.
    if(hit?.kind!=='surface'||hit.dirty.reduce((sum,v)=>sum+v,0)>hit.dirty.length/2){
      const full=streamTerrainField(lattice,sea,stream).surface!;this.seedGrid(lattice,sea,full);return full;
    }
    const heights=hit.heights.slice();
    if(!hit.dirty.some(Boolean))return heights;
    for(const r of terrainDirtyRects(hit.dirty,lattice.columns,lattice.rows,4)){
      const part=streamTerrainFieldBlock(lattice,r,sea,stream).surface!;
      for(let y=0;y<r.height;y++)heights.set(part.subarray(y*r.width,(y+1)*r.width),(r.y+y)*lattice.columns+r.x);
    }
    // Publish only after every dirty block succeeded. A failed source read leaves
    // the old grid dirty, and previously returned frames remain immutable.
    hit.heights.set(heights);hit.dirty.fill(0);
    return heights;
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
