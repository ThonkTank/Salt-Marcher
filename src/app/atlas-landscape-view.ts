import {AtlasPaint,atlasPaint} from './atlas-paint';
import type { LandscapeRecord, LandscapeBox } from "./atlas-landscape";
import { formatDistance, hexPolygon, hexSize } from "./atlas-landscape";
import { roomPath } from "./drawing-model";
import { terrainColors } from "./world-model";
export function drawLandscape(
  root: AtlasPaint,
  records: LandscapeRecord[],
  b: LandscapeBox,
  mpp: number,
  assets: Map<string, string>,
  references = true,
  raster?: import("./landscape-raster").LandscapeRaster | import("./landscape-raster").LandscapeRaster[],
  unavailableAssets?: ReadonlySet<string>,
) {
  const landscapeNode=atlasPaint;
  let rasterDrawn=false;
  const drawRaster=()=>{
    if(!raster||rasterDrawn)return;rasterDrawn=true;
    for(const tile of Array.isArray(raster)?raster:[raster])root.append(landscapeNode("image", {source: tile.data, x:tile.box.x-b.x,y:tile.box.y-b.y,width:tile.box.width,height:tile.box.height, pointer: false, data: {landscapeRaster: String('true')}}));
  };
  for (const r of [...records].sort(
    (a, b) =>
      (a.kind === "reference" ? -1 : a.kind === "patch" ? 0 : 1) -
        (b.kind === "reference" ? -1 : b.kind === "patch" ? 0 : 1) ||
      b.resolution - a.resolution ||
      (a.order ?? 0) - (b.order ?? 0),
  )) {
    if(r.kind!=="reference")drawRaster();
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
          landscapeNode("path", {path: roomPath(
              r.polygons.map((p) => ({
                outer: p.outer.map((v) => ({ x: v.x - b.x, y: v.y - b.y })),
                holes: p.holes.map((h) =>
                  h.map((v) => ({ x: v.x - b.x, y: v.y - b.y })),
                ),
              })),
            ), pointer: false, style: {fill: terrainColors[r.values.terrain]!, fillRule: "evenodd"}}),
        );
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
        landscapeNode("text", {x: p.x - b.x, y: p.y - b.y - mpp * 10, style: {fontSize: mpp * 13, textAlign: 'center', stroke: "#f4efdf", lineWidth: mpp * 3, fill: "#263e32"}}, r.name),
      );
    }
  }
  drawRaster();
}
export function drawLandscapeGrid(
  root: AtlasPaint,
  b: LandscapeBox,
  level: number,
  mpp: number,
) {
  const landscapeNode=atlasPaint;
  const size = hexSize(level),
    r = Math.ceil(Math.max(b.width, b.height) / size) + 2;
  if (r > 45) return;
  const cr = Math.round((b.y + b.height / 2) / ((size * Math.sqrt(3)) / 2)),
    cq = Math.round((b.x + b.width / 2) / size - cr / 2);
  for (let q = cq - r; q <= cq + r; q++)
    for (let y = cr - r; y <= cr + r; y++)
      root.append(
        landscapeNode("path", {path: roomPath(
            [hexPolygon(q, y, size)].map((p) => ({
              outer: p.outer.map((v) => ({ x: v.x - b.x, y: v.y - b.y })),
              holes: [],
            })),
          ), pointer: false, style: {fill: null, stroke: "#36564444", lineWidth: mpp * 0.7}, data: {landscapeGrid: String("true")}}),
      );
}
export function drawScale(root: AtlasPaint, b: LandscapeBox, mpp: number) {
  const landscapeNode=atlasPaint;
  const raw = mpp * 120,
    pow = 10 ** Math.floor(Math.log10(raw)),
    n = [1, 2, 5, 10].find((n) => n * pow >= raw)!,
    len = n * pow;
  root.append(
    landscapeNode("path", {path: `M ${mpp * 20} ${b.height - mpp * 35} v ${mpp * 5} h ${len} v ${-mpp * 5}`, pointer: false, style: {fill: null, stroke: "#23382d", lineWidth: mpp * 2}, data: {editorOnly: String("true")}}),
    landscapeNode("text", {x: mpp * 20, y: b.height - mpp * 42, style: {fontSize: mpp * 11, fill: "#23382d"}, data: {editorOnly: String("true")}}, formatDistance(len)),
  );
}
