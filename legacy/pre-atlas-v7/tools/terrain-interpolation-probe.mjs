// Experimental reconstruction only. Not imported by the product or storage writers.
export const linear=(a,b,c,d,t)=>b+(c-b)*t;
export const catmull=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
const tangent=(a,b)=>a*b<=0?0:2*a*b/(a+b);
export function monotone(a,b,c,d,t){
 if(b===c)return b;
 const delta=c-b,m0=tangent(b-a,delta),m1=tangent(delta,d-c);
 return b+t*(m0+t*(3*delta-2*m0-m1+t*(m0+m1-2*delta)));
}
export function reconstruct(nodes,x,y,fill,kernel=monotone,offset=0,stride=4){
 const at=i=>{const v=nodes[offset+i];return Number.isNaN(v)?fill:v;};
 if(kernel===monotone){const b=at(stride+1);if(b===at(stride+2)&&b===at(2*stride+1)&&b===at(2*stride+2))return b;}
 const row=i=>kernel(at(i*stride),at(i*stride+1),at(i*stride+2),at(i*stride+3),x);
 return kernel(row(0),row(1),row(2),row(3),y);
}
/** Every experiment changes both the sampled geometry and its terrain colour.
 * The production class remains unchanged outside this isolated process. */
export function installInterpolation(TerrainSampler,kernel){
 const original=TerrainSampler.prototype.sample,cache=new WeakMap();
 TerrainSampler.prototype.sample=function(p){
  const result=original.call(this,p);let base=-100,addition=0;
  for(const level of this.levels){
   const {pixel,tiles,additive}=level,xx=p.x/pixel,yy=p.y/pixel,gx=Math.floor(xx),gy=Math.floor(yy);
   let cell=cache.get(level);
   if(!cell||cell.gx!==gx||cell.gy!==gy){
    const nodes=new Float64Array(16);
    for(let y=0;y<4;y++)for(let x=0;x<4;x++){
     const nx=gx+x-1,ny=gy+y-1,tx=Math.floor(nx/64),ty=Math.floor(ny/64);
     nodes[y*4+x]=tiles.get(tx)?.get(ty)?.values[(ny-ty*64)*64+nx-tx*64]??NaN;
    }
    cache.set(level,cell={gx,gy,nodes});
   }
   const value=reconstruct(cell.nodes,xx-gx,yy-gy,additive?0:base,kernel);
   if(additive)addition+=value;else base=value;
  }
  const ground=base+addition;return {...result,heightM:this.directHeight?ground:this.routes.at(p,ground).height};
 };
 return()=>{TerrainSampler.prototype.sample=original;};
}
