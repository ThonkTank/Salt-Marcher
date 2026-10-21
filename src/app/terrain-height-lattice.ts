import {decodeHeights,type HeightTile} from './terrain-height';
import type {LandscapeRecord} from './atlas-landscape';

interface Axis {nodes:Float64Array;starts:Uint32Array;fractions:Float64Array}
/** Each source node appears once even when many output pixels share a cell.
 * Coordinates remain Float64: author cells can lie beyond signed 32-bit range. */
function sourceAxis(points:Float64Array,pixel:number):Axis{
 const nodes:number[]=[],starts=new Uint32Array(points.length),fractions=new Float64Array(points.length);let start=0;
 for(let i=0;i<points.length;i++){
  const value=points[i]!/pixel,cell=Math.floor(value);fractions[i]=value-cell;
  while(start<nodes.length&&nodes[start]!<cell)start++;
  for(let offset=0;offset<2;offset++)if(start+offset===nodes.length)nodes.push(cell+offset);
  starts[i]=start;
 }
 return{nodes:Float64Array.from(nodes),starts,fractions};
}
function lowerBound(values:Float64Array,value:number){
 let left=0,right=values.length;while(left<right){const mid=(left+right)>>>1;if(values[mid]!<value)left=mid+1;else right=mid;}return left;
}
/** A bounded Cartesian set of required source nodes, independent of author count.
 * At most four nodes per output sample and per absolute/additive layer survive.
 * No complete decoded author tile is retained. */
class HeightLevel {
 private x:Axis;
 private y:Axis;
 private absolute?:Float32Array;
 private additive?:Float32Array;
 constructor(readonly pixel:number,x:Float64Array,y:Float64Array){this.x=sourceAxis(x,pixel);this.y=sourceAxis(y,pixel);}
 read(tile:HeightTile){
  const x=this.x.nodes,y=this.y.nodes,tx=tile.x/this.pixel,ty=tile.y/this.pixel;
  const left=lowerBound(x,tx),right=lowerBound(x,tx+64),top=lowerBound(y,ty),bottom=lowerBound(y,ty+64);
  if(left===right||top===bottom)return;
  const values=decodeHeights(tile),target=tile.version===2?(this.additive??=new Float32Array(x.length*y.length).fill(NaN)):(this.absolute??=new Float32Array(x.length*y.length).fill(NaN));
  for(let row=top;row<bottom;row++){
   const source=(y[row]!-ty)*64,targetRow=row*x.length;
   for(let col=left;col<right;col++){
    const value=values[source+x[col]!-tx]!;if(Number.isNaN(value))continue;
    const at=targetRow+col;if(!Number.isNaN(target[at]!))throw Error('Doppelte Höhenkachel.');target[at]=value;
   }
  }
 }
 apply(ground:Float64Array,additions:Float64Array){
  if(!this.absolute&&!this.additive)return;
  const x=this.x,y=this.y,columns=x.starts.length;
  for(let row=0;row<y.starts.length;row++)for(let col=0;col<columns;col++){
   const index=row*columns+col,base=y.starts[row]!*x.nodes.length+x.starts[col]!,fx=x.fractions[col]!,fy=y.fractions[row]!;
   let weight=0,total=0,delta=0;
   // Preserve canonical dy/dx arithmetic and zero-weight/NaN inheritance exactly.
   for(let oy=0;oy<2;oy++)for(let ox=0;ox<2;ox++){
    const w=(ox?fx:1-fx)*(oy?fy:1-fy);if(!w)continue;
    const node=base+oy*x.nodes.length+ox,a=this.absolute?.[node],b=this.additive?.[node];
    if(a!==undefined&&!Number.isNaN(a)){weight+=w;total+=a*w;}
    if(b!==undefined&&!Number.isNaN(b))delta+=b*w;
   }
   ground[index]=ground[index]!*(1-weight)+total;additions[index]=additions[index]!+delta;
  }
 }
}
/** Input tiles are unique and coarse-to-fine, as required by the readonly reader. */
export function accumulateHeightLattice(x:Float64Array,y:Float64Array,records:Iterable<LandscapeRecord>,ground:Float64Array,additions:Float64Array){
 let level:HeightLevel|undefined;
 for(const record of records){
  const tile=record.height;if(!tile)throw Error('Höhenkachel fehlt.');
  if(level&&tile.pixel>level.pixel)throw Error('Höhenkacheln müssen von grob nach fein gelesen werden.');
  if(!level||tile.pixel!==level.pixel){level?.apply(ground,additions);level=new HeightLevel(tile.pixel,x,y);}
  level.read(tile);
 }
 level?.apply(ground,additions);
}
