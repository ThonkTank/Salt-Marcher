import {bounds,contains,type LandscapeBox,type LandscapeRecord} from './atlas-landscape';
import {decodeHeights,DEFAULT_HEIGHT_M} from './terrain-height';
import {RouteSurface} from './terrain-route';

/** A fixed display lattice. Readers must yield unique height tiles from coarse to fine.
 * Only four node values per sample survive a tile read; no author record is retained. */
export interface TerrainLattice {x:number;y:number;dx:number;dy:number;columns:number;rows:number}
export interface TerrainField {heights:Float32Array;water:Uint8Array;surface?:Float32Array}
export type TerrainStream=(kind:'height'|'route'|'lake',box:LandscapeBox)=>Iterable<LandscapeRecord>;
/** Read a retained row band without changing the global sample coordinates or arithmetic order. */
export function streamTerrainFieldRows(lattice:TerrainLattice,first:number,count:number,seaLevelM:number,records:TerrainStream,withSurface=true):TerrainField{
  if(!Number.isInteger(first)||!Number.isInteger(count)||first<0||count<1||first+count>lattice.rows||count*lattice.columns>65536)throw Error('Geländerasterband prüfen.');
  return streamTerrainFieldBlock(lattice,{x:0,y:first,width:lattice.columns,height:count},seaLevelM,records,withSurface);
}
/** A block uses the original lattice arithmetic, including non-integral world origins. */
export function streamTerrainFieldBlock(lattice:TerrainLattice,rect:{x:number;y:number;width:number;height:number},sea:number,records:TerrainStream,surface=true):TerrainField{
  if(![rect.x,rect.y,rect.width,rect.height].every(Number.isInteger)||rect.x<0||rect.y<0||rect.width<1||rect.height<1||rect.x+rect.width>lattice.columns||rect.y+rect.height>lattice.rows||rect.width*rect.height>65536)throw Error('Geländerasterblock prüfen.');
  return terrainBand({...lattice,columns:rect.width,rows:rect.height},rect.y,sea,records,surface,rect.x);
}
export function streamTerrainField(lattice:TerrainLattice,seaLevelM:number,records:TerrainStream,withSurface=true):TerrainField{
  const steps=streamTerrainFieldSteps(lattice,seaLevelM,records,withSurface,function*(){},65536);
  for(;;){const step=steps.next();if(step.done)return step.value;}
}
/** Yield only after complete row bands: no SQL iterator survives a checkpoint. */
export function* streamTerrainFieldSteps(lattice:TerrainLattice,seaLevelM:number,records:TerrainStream,withSurface:boolean,checkpoint:()=>Generator<void>,maxSamples=16384):Generator<void,TerrainField>{
  const {x,y,dx,dy,columns,rows}=lattice,n=columns*rows;
  if(![x,y,dx,dy,seaLevelM,x+dx*(columns-1),y+dy*(rows-1)].every(Number.isFinite)||dx<=0||dy<=0||!Number.isSafeInteger(columns)||!Number.isSafeInteger(rows)||columns<1||rows<1||n>4_460_544||!Number.isSafeInteger(maxSamples)||maxSamples<columns||maxSamples>65536)throw Error('Geländeraster prüfen.');
  // A scanline band bounds scratch space independently of texture size and author count.
  const heights=new Float32Array(n),water=new Uint8Array(n),surface=withSurface?new Float32Array(n):undefined,bandRows=Math.floor(maxSamples/columns);
  for(let row=0;row<rows;row+=bandRows){
    const count=Math.min(bandRows,rows-row),band=terrainBand({...lattice,rows:count},row,seaLevelM,records,withSurface),offset=row*columns;
    heights.set(band.heights,offset);water.set(band.water,offset);if(surface)surface.set(band.surface!,offset);
    yield* checkpoint();
  }
  return{heights,water,surface};
}
function terrainBand(lattice:TerrainLattice,startRow:number,seaLevelM:number,records:TerrainStream,withSurface:boolean,startColumn=0):TerrainField{
  const {x,y,dx,dy,columns,rows}=lattice,n=columns*rows,atX=(column:number)=>x+(startColumn+column)*dx,atY=(row:number)=>y+(startRow+row)*dy;
  const query={x:atX(0)-dx/2,y:atY(0)-dy/2,width:columns*dx,height:rows*dy};
  const ground=new Float64Array(n).fill(DEFAULT_HEIGHT_M),additions=new Float64Array(n);
  const each=(box:LandscapeBox,visit:(i:number,px:number,py:number)=>void)=>{
    const left=Math.max(0,Math.ceil((box.x-x)/dx)-startColumn),right=Math.min(columns-1,Math.floor((box.x+box.width-x)/dx)-startColumn),top=Math.max(0,Math.ceil((box.y-y)/dy)-startRow),bottom=Math.min(rows-1,Math.floor((box.y+box.height-y)/dy)-startRow);
    for(let r=top;r<=bottom;r++)for(let c=left;c<=right;c++)visit(r*columns+c,atX(c),atY(r));
  };
  // Keep canonical dy/dx addition order, even when adjacent tiles arrive in a different order.
  // This also preserves zero-weight nodes and NaN inheritance at exact tile boundaries.
  {
    const nodes=new Float32Array(n*8),mask=new Uint8Array(n),dirty=new Int32Array(n);let used=0,pixel=Infinity;
    // A level shares its x/y coordinates across every sample and contributing
    // tile. Keep Float64 indices: distant worlds can exceed signed 32-bit cells.
    const cellX=new Float64Array(columns),cellY=new Float64Array(rows),fractionX=new Float64Array(columns),fractionY=new Float64Array(rows);
    const level=(size:number)=>{
      pixel=size;
      for(let c=0;c<columns;c++){const v=atX(c)/pixel;cellX[c]=Math.floor(v);fractionX[c]=v-cellX[c]!;}
      for(let r=0;r<rows;r++){const v=atY(r)/pixel;cellY[r]=Math.floor(v);fractionY[r]=v-cellY[r]!;}
    };
    const flush=()=>{
      for(let j=0;j<used;j++){
        const i=dirty[j]!,fx=fractionX[i%columns]!,fy=fractionY[Math.floor(i/columns)]!;
        let weight=0,total=0,delta=0;
        for(let oy=0;oy<2;oy++)for(let ox=0;ox<2;ox++){
          const corner=oy*2+ox,w=(ox?fx:1-fx)*(oy?fy:1-fy);
          if(w&&(mask[i]!&(1<<corner))){weight+=w;total+=nodes[i*8+corner]!*w;}
          if(w&&(mask[i]!&(1<<(corner+4))))delta+=nodes[i*8+corner+4]!*w;
        }
        ground[i]=ground[i]!*(1-weight)+total;additions[i]=additions[i]!+delta;mask[i]=0;
      }
      used=0;
    };
    for(const r of records('height',query)){
      const t=r.height!;if(!t)throw Error('Höhenkachel fehlt.');
      if(t.pixel>pixel)throw Error('Höhenkacheln müssen von grob nach fein gelesen werden.');
      if(t.pixel!==pixel){flush();level(t.pixel);}
      const data=decodeHeights(t),tx=t.x/pixel,ty=t.y/pixel;
      each({x:t.x-pixel,y:t.y-pixel,width:65*pixel,height:65*pixel},i=>{
        const gx=cellX[i%columns]!,gy=cellY[Math.floor(i/columns)]!;
        for(let oy=0;oy<2;oy++)for(let ox=0;ox<2;ox++){
          const col=gx+ox-tx,row=gy+oy-ty;if(col<0||col>=64||row<0||row>=64)continue;
          const v=data[row*64+col]!;if(Number.isNaN(v))continue;
          const corner=oy*2+ox+(t.version===2?4:0),bit=1<<corner;if(mask[i]!&bit)throw Error('Doppelte Höhenkachel.');
          if(!mask[i])dirty[used++]=i;mask[i]=mask[i]!|bit;nodes[i*8+corner]=v;
        }
      });
    }
    flush();
  }
  for(let i=0;i<n;i++)ground[i]=ground[i]!+additions[i]!;
  let weighted:Float64Array|undefined,total:Float64Array|undefined,strength:Float64Array|undefined,levels:Float64Array|undefined;
  for(const r of records('route',query)){
    if(!r.route?.nodes.length||r.route.conflict)continue;
    const surface=new RouteSurface([r]);
    each(bounds(r),(i,px,py)=>{
      const hit=surface.at({x:px,y:py},ground[i]!);
      if(hit.total){
        weighted??=new Float64Array(n);total??=new Float64Array(n);strength??=new Float64Array(n);
        weighted[i]=weighted[i]!+hit.weighted;total[i]=total[i]!+hit.total;strength[i]=Math.max(strength[i]!,hit.strength);
      }
      if(hit.water!==undefined){levels??=new Float64Array(n).fill(-Infinity);levels[i]=levels[i]===-Infinity?hit.water:Math.min(levels[i]!,hit.water);}
    });
  }
  if(total)for(let i=0;i<n;i++)if(total[i])ground[i]=ground[i]!+(weighted![i]!/total[i]!-ground[i]!)*strength![i]!;
  // RouteSurface resolves intersecting river levels by their minimum. The sea and lakes
  // are combined afterwards, using the final effective ground, as TerrainSampler does.
  for(const r of records('lake',query)){
    const level=r.waterLevelM??seaLevelM+1;
    each(bounds(r),(i,px,py)=>{if(ground[i]!<=level&&contains({x:px,y:py},r.polygons)){levels??=new Float64Array(n).fill(-Infinity);levels[i]=Math.max(levels[i]!,level);}});
  }
  const heights=new Float32Array(ground),water=new Uint8Array(n),surface=withSurface?new Float32Array(n):undefined;
  for(let i=0;i<n;i++){
    let level=levels?.[i]??-Infinity;if(ground[i]!<=seaLevelM)level=Math.max(level,seaLevelM);
    water[i]=level!==-Infinity?1:0;if(surface)surface[i]=Math.max(ground[i]!,level,seaLevelM);
  }
  return{heights,water,surface};
}
