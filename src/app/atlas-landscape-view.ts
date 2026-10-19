import {LandscapeRasterizer} from './landscape-raster';
import {colorParts,unionPolygons,subtractPolygons,intersectPolygons} from './landscape-brush';
import { lineParts } from "./landscape-line";
import {AtlasPaint,atlasPaint} from './atlas-paint';
import type { LandscapeRecord, LandscapeBox } from "./atlas-landscape";
import { hexPolygon, LANDSCAPE_PLACE_FONT_PX } from "./atlas-landscape";
import { gridMeters, scaleBar } from "./atlas-navigation-scale";
import { terrainColors } from "./world-model";
export function drawLandscape(
  root: AtlasPaint,
  records: LandscapeRecord[],
  b: LandscapeBox,
  mpp: number,
  assets: Map<string, string>,
  references = true,
  raster?: import("./landscape-raster").LandscapeRaster[],
  unavailableAssets?: ReadonlySet<string>,
) {
  if(!raster&&records.some(r=>r.mask)&&typeof document!=='undefined'){
    const w=Math.min(1024,Math.max(1,Math.ceil(b.width/mpp))),h=Math.min(1024,Math.max(1,Math.ceil(b.height/mpp))),image=new LandscapeRasterizer(b,w,h);
    for(const r of [...records].sort((a,b)=>b.resolution-a.resolution||(a.order??0)-(b.order??0)))image.paint(r);
    for(const r of records)if(r.paint)image.paintColor(r);
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d')!;ctx.putImageData(new ImageData(new Uint8ClampedArray(image.finish()),w,h),0,0);
    raster=[{campaignId:'',revision:0,box:b,width:w,height:h,data:canvas.toDataURL()}];
  }
  const landscapeNode=atlasPaint;
  let rasterDrawn=false,colorsDrawn=false;
  const ordered=[...records].sort((a,b)=>b.resolution-a.resolution||(a.order??0)-(b.order??0));
  const drawColors=()=>{
    if(raster||colorsDrawn)return;colorsDrawn=true;
    let water:import('./contracts').Polygon[]=[{outer:[{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}],holes:[]}];
    for(const r of ordered)if(r.kind==='patch'&&r.values.terrain)water=r.values.terrain==='water'?unionPolygons(water,r.polygons):subtractPolygons(water,r.polygons);
    for(const r of ordered)if(r.paint)for(const part of colorParts(r)){
      const polygons=r.paint.target==='water'?intersectPolygons(part.polygons,water):subtractPolygons(part.polygons,water);
      root.append(landscapeNode('polygons',{polygons:polygons.map(p=>({outer:p.outer.map(v=>({x:v.x-b.x,y:v.y-b.y})),holes:p.holes.map(r=>r.map(v=>({x:v.x-b.x,y:v.y-b.y})))})),pointer:false,opacity:part.opacity*r.paint.opacity,style:{fill:part.color,fillRule:'evenodd'}}));
    }
  };
  const drawRaster=()=>{
    if(!raster||rasterDrawn)return;rasterDrawn=true;
    for(const tile of raster)root.append(landscapeNode("image", {source: tile.data, x:tile.box.x-b.x,y:tile.box.y-b.y,width:tile.box.width,height:tile.box.height, pointer: false, data: {landscapeRaster: String('true')}}));
  };
  for (const r of [...records].sort(
    (a, b) =>
      (a.kind === "reference" ? -1 : a.kind === "patch" ? 0 : a.line?.overSymbols ? 3 : a.line ? 1 : 2) -
        (b.kind === "reference" ? -1 : b.kind === "patch" ? 0 : b.line?.overSymbols ? 3 : b.line ? 1 : 2) ||
      b.resolution - a.resolution ||
      (a.order ?? 0) - (b.order ?? 0),
  )) {
    if(r.kind!=="reference")drawRaster();
    if(r.kind!=="reference"&&r.kind!=="patch")drawColors();
    const g = landscapeNode("group", {data: {landscapeId: String(r.id)}});
    root.append(g);
    if (r.kind === "reference") {
      if (references && r.visible !== false && assets.has(r.assetId!))
        g.append(
          landscapeNode("image", {source: assets.get(r.assetId!)!, x: 0, y: 0, width: r.width, height: (r.width * (r.imageHeight ?? 1)) / (r.imageWidth ?? 1), opacity: r.opacity ?? 0.4, matrix:[Math.cos(r.angle??0),Math.sin(r.angle??0),-Math.sin(r.angle??0),Math.cos(r.angle??0),r.points[0]!.x-b.x,r.points[0]!.y-b.y], pointer: false, optionalImage:true}),
        );
      else if(references&&r.visible!==false){
        const state=unavailableAssets?.has(r.assetId!)?'unavailable':'loading';
        const outline=landscapeNode('rect',{x:0,y:0,width:r.width,height:r.width*(r.imageHeight??1)/(r.imageWidth??1),matrix:[Math.cos(r.angle??0),Math.sin(r.angle??0),-Math.sin(r.angle??0),Math.cos(r.angle??0),r.points[0]!.x-b.x,r.points[0]!.y-b.y],style:{fill:null,stroke:'#75604e',lineWidth:mpp},data:{referenceState:state,referenceId:r.id},title:`${r.name||'Bildvorlage'} · ${state==='loading'?'wird geladen':'nicht verfügbar'}`});
        g.append(outline);
      }
    } else if (r.kind === "patch") {
      if (r.values.terrain && !raster)
        g.append(
          landscapeNode("polygons", {polygons: r.polygons.map((p) => ({
                outer: p.outer.map((v) => ({ x: v.x - b.x, y: v.y - b.y })),
                holes: p.holes.map((h) =>
                  h.map((v) => ({ x: v.x - b.x, y: v.y - b.y })),
                ),
              })),
             pointer: false, style: {fill: terrainColors[r.values.terrain]!, fillRule: "evenodd"}}),
        );
    } else if ((r.kind === "road" || r.kind === "river") && r.line) {
      for(const p of lineParts(r))g.append(p.polygons ? landscapeNode("polygons",{polygons:p.polygons.map(poly=>({outer:poly.outer.map(v=>({x:v.x-b.x,y:v.y-b.y})),holes:[]})),opacity:p.opacity,style:{fill:p.color}}) : landscapeNode("polyline",{points:p.points.map(v=>({x:v.x-b.x,y:v.y-b.y})),opacity:p.opacity,style:{stroke:p.color,fill:null,lineWidth:p.width,lineDash:p.dash,lineDashOffset:p.dashOffset,lineJoin:"round",lineCap:"round"}}));
    } else if (r.kind === "road" || r.kind === "river")
      g.append(
        landscapeNode("polyline", {points: r.points.map(p=>({x:p.x-b.x,y:p.y-b.y})), style: {fill: null, stroke: r.kind === "river" ? "#629ebc" : "#a37e51", lineWidth: Math.max(r.width, mpp * 2), lineJoin: "round", lineCap: "round", lineDash: r.kind === "road" && r.style === "path"
              ? [mpp*5,mpp*3]
              : []}}),
      );
    else if (r.kind === "place") {
      const p = r.points[0]!;
      g.append(
        landscapeNode("circle", {x: p.x - b.x, y: p.y - b.y, radius: mpp * 5, style: {fill: "#5b4338", stroke: "#f5efdb", lineWidth: mpp * 1.5}}),
      );
      g.append(
        landscapeNode("text", {x: p.x - b.x, y: p.y - b.y - mpp * 10, style: {fontSize: mpp * LANDSCAPE_PLACE_FONT_PX, textAlign: 'center', stroke: "#f4efdf", lineWidth: mpp * 3, fill: "#263e32"}}, r.name),
      );
    }
  }
  drawRaster();drawColors();
}
export function drawLandscapeGrid(
  root: AtlasPaint,
  b: LandscapeBox,
  level: number | string,
  mpp: number,
) {
  const landscapeNode=atlasPaint;
  const size = gridMeters(level),
    r = Math.ceil(Math.max(b.width, b.height) / size) + 2;
  if (r > 45) return;
  const cr = Math.round((b.y + b.height / 2) / ((size * Math.sqrt(3)) / 2)),
    cq = Math.round((b.x + b.width / 2) / size - cr / 2);
  for (let q = cq - r; q <= cq + r; q++)
    for (let y = cr - r; y <= cr + r; y++)
      root.append(
        landscapeNode("polygon", {points: hexPolygon(q, y, size).outer.map(v=>({x:v.x-b.x,y:v.y-b.y})), pointer: false, style: {fill: null, stroke: "#36564444", lineWidth: mpp * 0.7}, data: {landscapeGrid: String("true")}}),
      );
}
export function drawScale(root: AtlasPaint, b: LandscapeBox, mpp: number) {
  const landscapeNode=atlasPaint;
  const bar = scaleBar(mpp, b.width / mpp), len = bar.meters;
  root.append(
    landscapeNode("rect", {x:mpp*12,y:b.height-mpp*62,width:Math.min(b.width-mpp*24,mpp*280),height:mpp*44,style:{fill:"#fffaf0",fillOpacity:.92},pointer:false,data:{editorOnly:"true"}}),
    landscapeNode("polyline", {points:[{x:mpp*20,y:b.height-mpp*35},{x:mpp*20,y:b.height-mpp*30},{x:mpp*20+len/2,y:b.height-mpp*30},{x:mpp*20+len/2,y:b.height-mpp*35},{x:mpp*20+len/2,y:b.height-mpp*30},{x:mpp*20+len,y:b.height-mpp*30},{x:mpp*20+len,y:b.height-mpp*35}], pointer: false, style: {fill: null, stroke: "#23382d", lineWidth: mpp * 2}, data: {editorOnly: String("true")}}),
    landscapeNode("text", {matrix:[mpp,0,0,mpp,mpp*20,b.height-mpp*42], x:0,y:0, style: {fontSize:11, fill: "#23382d"}, data: {editorOnly: String("true")}}, bar.label),
  );
}
