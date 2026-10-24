/** Logical display scale, independent of device pixels and output tiling. */
export const FOREST_DETAIL_MPP=2;
export const FOREST_SURFACE_MPP=8;
export const CARTOGRAPHIC_PERIOD=65536;
export function cartographicPhase(value:number){return ((value+CARTOGRAPHIC_PERIOD/2)%CARTOGRAPHIC_PERIOD+CARTOGRAPHIC_PERIOD)%CARTOGRAPHIC_PERIOD-CARTOGRAPHIC_PERIOD/2;}
export function forestSurfaceWeight(mpp:number){
 const t=Math.max(0,Math.min(1,(mpp-FOREST_DETAIL_MPP)/(FOREST_SURFACE_MPP-FOREST_DETAIL_MPP)));
 return t*t*(3-2*t);
}

/** Decorative ink only: coverage owns borders and holes. Nested fixed world
 * pitches crossfade instead of stretching texture coordinates during zoom. */
export const CARTOGRAPHIC_GLSL=`
float atlasForestSurface(float mpp){return smoothstep(${FOREST_DETAIL_MPP.toFixed(1)},${FOREST_SURFACE_MPP.toFixed(1)},mpp);}
vec3 atlasHash(vec2 p) {
 p=mod(p,4096.0);
 vec3 q=fract(vec3(p.xyx)*0.1031);
 q+=dot(q,q.yzx+33.33);
 return fract((q.xxy+q.yzz)*q.zyx);
}
float atlasCanopy(vec2 world,float pitch) {
 vec2 p=world/pitch,cell=floor(p),local=fract(p);
 float canopy=0.0,light=0.0;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 n=vec2(float(x),float(y));
  vec2 key=mod(cell+n,65536.0/pitch);
  vec3 random=atlasHash(key);
  vec2 centre=n+0.1+0.8*random.xy;
  vec2 d=local-centre;
  float radius=0.32+0.22*random.z;
  float crown=1.0-smoothstep(radius*0.45,radius,length(d));
  if(crown>canopy){canopy=crown;light=clamp(-(d.x+d.y)/radius,-1.0,1.0);}
 }
 return canopy*(-0.075+0.12*light);
}
float atlasForestInk(vec2 world,float mpp) {
 if(mpp>=512.0)return 0.0;
 float level=clamp(log2(max(32.0,mpp*12.0)/32.0),0.0,11.0);
 float pitch=32.0*exp2(floor(level));
 float ink=mix(atlasCanopy(world,pitch),atlasCanopy(world,pitch*2.0),smoothstep(0.0,1.0,fract(level)));
 return ink*(1.0-smoothstep(128.0,512.0,mpp));
}
`;
