/** Shape-preserving Hermite interpolation between b and c. Tangents vanish at
 * extrema, so plateaus and coast shelves gain no invented peaks or depressions. */
const tangent=(a:number,b:number)=>a*b<=0?0:2*a*b/(a+b);
export function interpolateHeight(a:number,b:number,c:number,d:number,t:number){
 if(b===c||t===0)return b;if(t===1)return c;
 const delta=c-b,m0=tangent(b-a,delta),m1=tangent(delta,d-c);
 return b+t*(m0+t*(3*delta-2*m0-m1+t*(m0+m1-2*delta)));
}
/** Missing absolute nodes inherit the coarser value at this point; missing
 * additive nodes use zero. The same x-then-y order serves queries and streams. */
export function heightPatch(nodes:ArrayLike<number>,x:number,y:number,fill:number,offset=0,stride=4){
 const at=(i:number)=>{const v=nodes[offset+i]!;return Number.isNaN(v)?fill:v;};
 const b=at(stride+1);if(b===at(stride+2)&&b===at(2*stride+1)&&b===at(2*stride+2))return b;
 const row=(i:number)=>interpolateHeight(at(i*stride),at(i*stride+1),at(i*stride+2),at(i*stride+3),x);
 return interpolateHeight(row(0),row(1),row(2),row(3),y);
}
/** A source node influences two neighbouring cells in each direction. */
export function heightInfluenceBounds(t:{x:number;y:number;pixel:number}){
 return{x:t.x-2*t.pixel,y:t.y-2*t.pixel,width:67*t.pixel,height:67*t.pixel};
}
