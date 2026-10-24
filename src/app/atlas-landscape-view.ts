import {mapRecordVisible,mapLineWidth,mapRecordOpacity} from './atlas-scale-policy';
import {drawVegetation} from './vegetation-view';
import {wrapMeasurementLines} from './atlas-measurements';
import {lengthLabel,atlasUnits,type AtlasUnits} from './atlas-units';
import {LandscapeRasterizer} from './landscape-raster';
import {orderedColors,colorParts,unionPolygons,subtractPolygons,intersectPolygons} from './landscape-brush';
import { lineParts } from "./landscape-line";
import {AtlasPaint,atlasPaint} from './atlas-paint';
import type { LandscapeRecord, LandscapeBox } from "./atlas-landscape";
import { hexPolygon, LANDSCAPE_PLACE_FONT_PX } from "./atlas-landscape";
import { gridMeters, scaleBar, hexTravelLabel } from "./atlas-navigation-scale";
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
  automaticLabels=false,
) {
  if(!raster&&records.some(r=>r.height||r.terrainSettings||r.mask||r.paint?.version===2)&&typeof document!=='undefined'){
    const w=Math.min(1024,Math.max(1,Math.ceil(b.width/mpp))),h=Math.min(1024,Math.max(1,Math.ceil(b.height/mpp))),image=new LandscapeRasterizer(b,w,h);
    for(const r of [...records].sort((a,b)=>b.resolution-a.resolution||(a.order??0)-(b.order??0)))image.paint(r);
    for(const r of orderedColors(records))image.paintColor(r);
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d')!;ctx.putImageData(new ImageData(new Uint8ClampedArray(image.finish()),w,h),0,0);
    raster=[{campaignId:'',revision:0,box:b,width:w,height:h,data:canvas.toDataURL()}];
  }
  const landscapeNode=atlasPaint;
  let rasterDrawn=false,colorsDrawn=false;
  const ordered=[...records].sort((a,b)=>b.resolution-a.resolution||(a.order??0)-(b.order??0));
  const drawColors=()=>{
    if(raster||colorsDrawn)return;colorsDrawn=true;
    let water:import('./contracts').Polygon[]=[{outer:[{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}],holes:[]}];
    for(const r of ordered)if(r.kind==='patch'&&!r.propertyOnly&&r.values.terrain)water=r.values.terrain==='water'?unionPolygons(water,r.polygons):subtractPolygons(water,r.polygons);
    for(const r of ordered)if(r.paint)for(const part of colorParts(r)){
      const polygons=r.paint.target==='water'?intersectPolygons(part.polygons,water):subtractPolygons(part.polygons,water);
      root.append(landscapeNode('polygons',{polygons:polygons.map(p=>({outer:p.outer.map(v=>({x:v.x-b.x,y:v.y-b.y})),holes:p.holes.map(r=>r.map(v=>({x:v.x-b.x,y:v.y-b.y})))})),pointer:false,opacity:part.opacity*r.paint.opacity,style:{fill:part.color,fillRule:'evenodd'}}));
    }
  };
  const drawRaster=()=>{
    if(!raster||rasterDrawn)return;rasterDrawn=true;
    for(const tile of raster)root.append(landscapeNode("image", {source: tile.data, x:tile.box.x-b.x,y:tile.box.y-b.y,width:tile.box.width,height:tile.box.height, pointer: false, data: {landscapeRaster: String(tile.content!=='objects')}}));
  };
  for (const r of [...records].sort(
    (a, b) =>
      (a.kind === "reference" ? -1 : (a.kind === "patch" || a.kind === "vegetation") ? 0 : a.line?.overSymbols ? 3 : a.line ? 1 : 2) -
        (b.kind === "reference" ? -1 : (b.kind === "patch" || b.kind === "vegetation") ? 0 : b.line?.overSymbols ? 3 : b.line ? 1 : 2) ||
      b.resolution - a.resolution ||
      (a.order ?? 0) - (b.order ?? 0),
  )) {
    if(r.kind!=="reference")drawRaster();
    if(!mapRecordVisible(r,mpp))continue;
    if(r.kind!=="reference"&&r.kind!=="patch")drawColors();
    const g = landscapeNode("group", {opacity:mapRecordOpacity(r,mpp),data: {landscapeId: String(r.id)}});
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
    } else if (r.kind === "vegetation") {
      drawVegetation(g,r,b,mpp);
    } else if (r.kind === "patch") {
      if (r.values.terrain && !r.propertyOnly && !raster)
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
      for(const p of lineParts(r))g.append(p.polygons ? landscapeNode("polygons",{polygons:p.polygons.map(poly=>({outer:poly.outer.map(v=>({x:v.x-b.x,y:v.y-b.y})),holes:[]})),opacity:p.opacity,style:{fill:p.color}}) : landscapeNode("polyline",{points:p.points.map(v=>({x:v.x-b.x,y:v.y-b.y})),opacity:p.opacity,style:{stroke:p.color,fill:null,lineWidth:mapLineWidth(p.width,mpp),lineDash:p.dash,lineDashOffset:p.dashOffset,lineJoin:"round",lineCap:"round"}}));
    } else if (r.kind === "road" || r.kind === "river")
      g.append(
        landscapeNode("polyline", {points: r.points.map(p=>({x:p.x-b.x,y:p.y-b.y})), style: {fill: null, stroke: r.kind === "river" ? "#629ebc" : "#a37e51", lineWidth: mapLineWidth(r.width,mpp), lineJoin: "round", lineCap: "round", lineDash: r.kind === "road" && r.style === "path"
              ? [mpp*5,mpp*3]
              : []}}),
      );
    else if (r.kind === "place") {
      const p = r.points[0]!;
      g.append(
        landscapeNode("circle", {x: p.x - b.x, y: p.y - b.y, radius: mpp * 5, style: {fill: "#5b4338", stroke: "#f5efdb", lineWidth: mpp * 1.5}}),
      );
      if(!automaticLabels)g.append(
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
  procedural = false,
) {
  const landscapeNode=atlasPaint;
  const size = gridMeters(level),
    r = Math.ceil(Math.max(b.width, b.height) / size) + 2;
  if (r > 45) return;
  root.mapGrid={size};
  if(procedural)return;
  const cr = Math.round((b.y + b.height / 2) / ((size * Math.sqrt(3)) / 2)),
    cq = Math.round((b.x + b.width / 2) / size - cr / 2);
  for (let q = cq - r; q <= cq + r; q++)
    for (let y = cr - r; y <= cr + r; y++)
      root.append(
        landscapeNode("polygon", {points: hexPolygon(q, y, size).outer.map(v=>({x:v.x-b.x,y:v.y-b.y})), pointer: false, style: {fill: null, stroke: "#36564444", lineWidth: mpp * 0.7}, data: {landscapeGrid: 'true',landscapeGridSize:String(size)}}),
      );
}
export function gridVisible(b:LandscapeBox,level:number|string){return Math.ceil(Math.max(b.width,b.height)/gridMeters(level))+2<=45;}
export function drawScale(root: AtlasPaint, b: LandscapeBox, mpp: number, level?:number|string,system:AtlasUnits=atlasUnits()) {
  const bar=scaleBar(mpp,b.width/mpp,system),hex=level!==undefined&&gridVisible(b,level)?gridMeters(level):null;
  const lines=[bar.label,...(hex?[`Hex: ${lengthLabel(hex,system)} · Kante zu Kante`,`Richtzeit: ${hexTravelLabel(hex)}`,`Ebene · Normaltempo · 8 Reisestunden/Tag`]:[])];
  const available=Math.max(60,b.width/mpp-24),wrapped=wrapMeasurementLines(lines.slice(1),Math.max(8,Math.floor((available-16)/6.1)));
  const width=Math.min(available,Math.max(bar.pixels+16,...[bar.label,...wrapped].map(l=>l.length*6.1+16))),height=hex?52+wrapped.length*18:48;
  const g=atlasPaint('group',{matrix:[mpp,0,0,mpp,12*mpp,b.height-(height+12)*mpp],pointer:false,hud:true,data:{editorOnly:'true',atlasScale:'true'}});
  g.append(atlasPaint('rect',{width,height,style:{fill:'#fffaf0',fillOpacity:.94},pointer:false}));
  g.append(atlasPaint('polyline',{points:[{x:8,y:28},{x:8,y:34},{x:8+bar.pixels/2,y:34},{x:8+bar.pixels/2,y:29},{x:8+bar.pixels/2,y:34},{x:8+bar.pixels,y:34},{x:8+bar.pixels,y:28}],style:{fill:null,stroke:'#23382d',lineWidth:2},pointer:false}));
  [bar.label,...wrapped].forEach((line,i)=>g.append(atlasPaint('text',{x:8,y:i===0?18:36+i*18,style:{fontSize:11,fill:'#23382d'},pointer:false},line)));
  root.append(g);
}
