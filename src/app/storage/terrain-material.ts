import {LandscapeRasterizer} from '../landscape-raster';
import {streamTerrainFieldSteps} from '../terrain-field-stream';
import type {TerrainMaterialChannel,TerrainMaterialRaster} from '../terrain-material';
import {atlasMaterialTileQuery,type AtlasMaterialTileRequest} from '../atlas-material-tile';
import type {AtlasRegionSource} from '../atlas-region-contracts';
import {readTerrainSettings,type ProjectionStream} from './terrain-color-raster';

/** Same canonical field/base/cover/pigment arithmetic as the reference raster,
 * ending before illumination, contours, coast ink and route overlays. */
export function* readTerrainMaterialSteps(db:any,source:AtlasRegionSource,request:AtlasMaterialTileRequest,stream:ProjectionStream,requested:ReadonlySet<TerrainMaterialChannel>):Generator<void,TerrainMaterialRaster>{
 const q=atlasMaterialTileQuery(request);
 if(source.revision!==request.revision)throw Error('Materialkachel inzwischen geändert.');
 let start=performance.now();function* checkpoint(){if(performance.now()-start>=8){yield;start=performance.now();}}
 const settings=readTerrainSettings(db,source.campaignId),channels:TerrainMaterialRaster={};
 for(const channel of requested)channels[channel]=new Uint8Array(q.width*q.height*(channel==='baseColor'?4:1));
 if(requested.has('water'))channels.waterTopology=new Uint16Array(q.width*q.height);
 // Fixed 64-pixel batches limit scratch buffers; their aligned sample lattices
 // and full halo produce the same pixels as an unsplit tile.
 const edge=64,colour=requested.has('baseColor'),forest=requested.has('forest');
 for(let y=0;y<q.height;y+=edge)for(let x=0;x<q.width;x+=edge){
  const width=Math.min(edge,q.width-x),height=Math.min(edge,q.height-y),box={x:q.view.box.x+x*q.displayMpp,y:q.view.box.y+y*q.displayMpp,width:width*q.displayMpp,height:height*q.displayMpp};
  const image=new LandscapeRasterizer(box,width,height,0,q.displayMpp,forest,{samples:4,areaCoverage:true,worldFeather:true}),samples=image.sampleLattice();
  image.paint(settings);
  image.setTerrainField(yield* streamTerrainFieldSteps(samples,settings.terrainSettings!.seaLevelM,stream,false,checkpoint));
  for(const r of stream('base',image.sampleBox,samples))image.paint(r);
  if(colour||forest)for(const r of stream('cover',image.sampleBox))yield* image.paintCoverSteps(r,checkpoint);
  if(colour)for(const r of stream('color',image.sampleBox))yield* image.paintColorSteps(r,checkpoint);
  const part=yield* image.materialChannelsSteps(checkpoint,requested);
  for(const channel of requested){
   const stride=channel==='baseColor'?4:1,input=part[channel]!,output=channels[channel]!;
   for(let row=0;row<height;row++)output.set(input.subarray(row*width*stride,(row+1)*width*stride),((y+row)*q.width+x)*stride);
  }
  if(channels.waterTopology)for(let row=0;row<height;row++)channels.waterTopology.set(part.waterTopology!.subarray(row*width,(row+1)*width),(y+row)*q.width+x);
  yield* checkpoint();
 }
 return channels;
}
