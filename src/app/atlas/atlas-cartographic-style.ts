/** Logical display scale, independent of device pixels and output tiling. */
export const FOREST_DETAIL_MPP = 2;
export const FOREST_SURFACE_MPP = 8;
export const CARTOGRAPHIC_PERIOD = 65536;
export function cartographicPhase(value: number) {
  return (
    ((((value + CARTOGRAPHIC_PERIOD / 2) % CARTOGRAPHIC_PERIOD) + CARTOGRAPHIC_PERIOD) %
      CARTOGRAPHIC_PERIOD) -
    CARTOGRAPHIC_PERIOD / 2
  );
}
export function forestSurfaceWeight(mpp: number) {
  const t = Math.max(
    0,
    Math.min(1, (mpp - FOREST_DETAIL_MPP) / (FOREST_SURFACE_MPP - FOREST_DETAIL_MPP)),
  );
  return t * t * (3 - 2 * t);
}

/** Decorative ink only: coverage owns borders and holes. Nested fixed world
 * pitches crossfade instead of stretching texture coordinates during zoom. */
export const CARTOGRAPHIC_GLSL = `
uniform sampler2D atlasPlantInk;
uniform sampler2D atlasMarkInk;
float atlasForestSurface(float mpp){return smoothstep(${FOREST_DETAIL_MPP.toFixed(1)},${FOREST_SURFACE_MPP.toFixed(1)},mpp);}
vec4 atlasPattern(sampler2D plate,vec2 world,float mpp){
 float level=clamp(log2(max(32.0,mpp*12.0)/32.0),0.0,7.0);
 float pitch=32.0*exp2(floor(level))*8.0;
 return mix(texture(plate,world/pitch),texture(plate,world/(pitch*2.0)),smoothstep(0.0,1.0,fract(level)));
}
float atlasPatternFade(float mpp){return 1.0-smoothstep(128.0,512.0,mpp);}
float atlasForestInk(vec2 world,float mpp){
 if(mpp>=512.0)return 0.0;
 return -0.24*atlasPattern(atlasPlantInk,world,mpp).r*atlasPatternFade(mpp);
}
float atlasCoverInk(vec2 world,float mpp,vec4 cover,float forest,float debris){
 if(mpp>=512.0)return 0.0;
 vec4 ink=atlasPattern(atlasPlantInk,world,mpp);
 float generic=forest*(1.0-smoothstep(0.0,0.01,cover.r+cover.g));
 float trees=dot(ink.rg,cover.rg)+generic*ink.r;
 float undergrowth=ink.b*cover.b*0.22+ink.a*cover.a*0.5;
 float stone=atlasPattern(atlasMarkInk,world,mpp).r*debris*0.7;
 return ((trees+stone)*atlasForestSurface(mpp)+undergrowth*smoothstep(0.5,2.0,mpp))*atlasPatternFade(mpp);
}
// Physical crop rows use the same world axes as the area generator. Once
// individual furrows are subpixel, retain a quiet, coarser parallel field mark.
float atlasFurrowBand(float y,float pitch){
 float phase=abs(fract(y/pitch)-0.5);
 return 1.0-smoothstep(0.035,0.035+max(fwidth(y/pitch),0.01),phase);
}
float atlasBiomeInk(vec2 world,float mpp,vec2 biome){
 float level=clamp(log2(max(32.0,mpp*12.0)/32.0),0.0,7.0);
 float pitch=32.0*exp2(floor(level));
 float coarse=mix(atlasFurrowBand(world.y,pitch),atlasFurrowBand(world.y,pitch*2.0),smoothstep(0.0,1.0,fract(level)));
 float furrow=coarse*smoothstep(0.5,2.0,mpp);
 float reed=atlasPattern(atlasPlantInk,world,mpp).b;
 return (reed*biome.r*0.65+furrow*biome.g*0.65)*smoothstep(0.2,1.5,mpp)*atlasPatternFade(mpp);
}
float atlasSlopeInk(vec2 world,float mpp,vec2 slope){
 float sum=abs(slope.x)+abs(slope.y);
 if(sum<0.015||mpp>=2048.0)return 0.0;
 float x=atlasPattern(atlasMarkInk,world,mpp).g;
 float y=atlasPattern(atlasMarkInk,vec2(world.y,-world.x),mpp).g;
 return mix(x,y,abs(slope.y)/max(sum,0.001))*smoothstep(0.015,0.4,sum)*(1.0-smoothstep(512.0,2048.0,mpp));
}
`;
