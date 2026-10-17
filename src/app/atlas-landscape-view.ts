import {paintFactory,type PaintTarget} from './atlas-canvas-scene';
import type { LandscapeRecord, LandscapeBox } from "./atlas-landscape";
import { formatDistance, hexPolygon, hexSize } from "./atlas-landscape";
import { roomPath } from "./drawing-model";
import { terrainColors } from "./world-model";
const ns = "http://www.w3.org/2000/svg";
export function landscapeNode(
  tag: string,
  attrs: Record<string, string | number> = {},
  text?: string,
) {
  const n = document.createElementNS(ns, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (text) n.textContent = text;
  return n;
}
export function drawLandscape(
  root: PaintTarget,
  records: LandscapeRecord[],
  b: LandscapeBox,
  mpp: number,
  assets: Map<string, string>,
  references = true,
  raster?: import("./landscape-raster").LandscapeRaster | import("./landscape-raster").LandscapeRaster[],
  unavailableAssets?: ReadonlySet<string>,
) {
  const landscapeNode=paintFactory(root);
  let rasterDrawn=false;
  const drawRaster=()=>{
    if(!raster||rasterDrawn)return;rasterDrawn=true;
    for(const tile of Array.isArray(raster)?raster:[raster])root.append(landscapeNode('image',{href:tile.data,x:0,y:0,width:tile.width,height:tile.height,transform:`translate(${tile.box.x-b.x} ${tile.box.y-b.y}) scale(${tile.box.width/tile.width} ${tile.box.height/tile.height})`,'pointer-events':'none','data-landscape-raster':'true'}));
  };
  for (const r of [...records].sort(
    (a, b) =>
      (a.kind === "reference" ? -1 : a.kind === "patch" ? 0 : 1) -
        (b.kind === "reference" ? -1 : b.kind === "patch" ? 0 : 1) ||
      b.resolution - a.resolution ||
      (a.order ?? 0) - (b.order ?? 0),
  )) {
    if(r.kind!=="reference")drawRaster();
    const g = landscapeNode("g", { "data-landscape-id": r.id });
    root.append(g);
    if (r.kind === "reference") {
      if (references && r.visible !== false && assets.has(r.assetId!))
        g.append(
          landscapeNode("image", {
            href: assets.get(r.assetId!)!,
            x: 0,
            y: 0,
            width: r.width,
            height: (r.width * (r.imageHeight ?? 1)) / (r.imageWidth ?? 1),
            opacity: r.opacity ?? 0.4,
            transform: `translate(${r.points[0]!.x - b.x} ${r.points[0]!.y - b.y}) rotate(${((r.angle ?? 0) * 180) / Math.PI})`,
            "pointer-events": "none",
            "data-optional-reference": r.id,
          }),
        );
      else if(references&&r.visible!==false){
        const state=unavailableAssets?.has(r.assetId!)?'unavailable':'loading';
        const outline=landscapeNode('rect',{x:0,y:0,width:r.width,height:r.width*(r.imageHeight??1)/(r.imageWidth??1),transform:`translate(${r.points[0]!.x-b.x} ${r.points[0]!.y-b.y}) rotate(${((r.angle??0)*180)/Math.PI})`,fill:'none',stroke:'#75604e','stroke-width':mpp,'data-reference-state':state,'data-reference-id':r.id});
        outline.append(landscapeNode('title',{},`${r.name||'Bildvorlage'} · ${state==='loading'?'wird geladen':'nicht verfügbar'}`));g.append(outline);
      }
    } else if (r.kind === "patch") {
      if (r.values.terrain && !raster)
        g.append(
          landscapeNode("path", {
            d: roomPath(
              r.polygons.map((p) => ({
                outer: p.outer.map((v) => ({ x: v.x - b.x, y: v.y - b.y })),
                holes: p.holes.map((h) =>
                  h.map((v) => ({ x: v.x - b.x, y: v.y - b.y })),
                ),
              })),
            ),
            fill: terrainColors[r.values.terrain]!,
            "fill-rule": "evenodd",
            "pointer-events": "none",
          }),
        );
    } else if (r.kind === "road" || r.kind === "river")
      g.append(
        landscapeNode("polyline", {
          points: r.points.map((p) => `${p.x - b.x},${p.y - b.y}`).join(" "),
          fill: "none",
          stroke: r.kind === "river" ? "#629ebc" : "#a37e51",
          "stroke-width": Math.max(r.width, mpp * 2),
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
          "stroke-dasharray":
            r.kind === "road" && r.style === "path"
              ? `${mpp * 5} ${mpp * 3}`
              : "none",
        }),
      );
    else if (r.kind === "place") {
      const p = r.points[0]!;
      g.append(
        landscapeNode("circle", {
          cx: p.x - b.x,
          cy: p.y - b.y,
          r: mpp * 5,
          fill: "#5b4338",
          stroke: "#f5efdb",
          "stroke-width": mpp * 1.5,
        }),
      );
      g.append(
        landscapeNode(
          "text",
          {
            x: p.x - b.x,
            y: p.y - b.y - mpp * 10,
            "font-size": mpp * 13,
            "text-anchor": "middle",
            "paint-order": "stroke",
            stroke: "#f4efdf",
            "stroke-width": mpp * 3,
            fill: "#263e32",
          },
          r.name,
        ),
      );
    }
  }
  drawRaster();
}
export function drawLandscapeGrid(
  root: PaintTarget,
  b: LandscapeBox,
  level: number,
  mpp: number,
) {
  const landscapeNode=paintFactory(root);
  const size = hexSize(level),
    r = Math.ceil(Math.max(b.width, b.height) / size) + 2;
  if (r > 45) return;
  const cr = Math.round((b.y + b.height / 2) / ((size * Math.sqrt(3)) / 2)),
    cq = Math.round((b.x + b.width / 2) / size - cr / 2);
  for (let q = cq - r; q <= cq + r; q++)
    for (let y = cr - r; y <= cr + r; y++)
      root.append(
        landscapeNode("path", {
          d: roomPath(
            [hexPolygon(q, y, size)].map((p) => ({
              outer: p.outer.map((v) => ({ x: v.x - b.x, y: v.y - b.y })),
              holes: [],
            })),
          ),
          fill: "none",
          stroke: "#36564444",
          "stroke-width": mpp * 0.7,
          "pointer-events": "none",
          "data-landscape-grid": "true",
        }),
      );
}
export function drawScale(root: PaintTarget, b: LandscapeBox, mpp: number) {
  const landscapeNode=paintFactory(root);
  const raw = mpp * 120,
    pow = 10 ** Math.floor(Math.log10(raw)),
    n = [1, 2, 5, 10].find((n) => n * pow >= raw)!,
    len = n * pow;
  root.append(
    landscapeNode("path", {
      d: `M ${mpp * 20} ${b.height - mpp * 35} v ${mpp * 5} h ${len} v ${-mpp * 5}`,
      fill: "none",
      stroke: "#23382d",
      "stroke-width": mpp * 2,
      "pointer-events": "none",
      "data-editor-only": "true",
    }),
    landscapeNode(
      "text",
      {
        x: mpp * 20,
        y: b.height - mpp * 42,
        "font-size": mpp * 11,
        fill: "#23382d",
        "data-editor-only": "true",
      },
      formatDistance(len),
    ),
  );
}
