import {appendAtlasRoomLabels} from './atlas-room-labels';
import type { AtlasRenderView } from "./campaign-atlas-contracts";
import type { LandscapeRecord, LandscapeBox } from "./atlas-landscape";
import {
  drawLandscape,
  drawLandscapeGrid,
  landscapeNode,
} from "./atlas-landscape-view";
import { atlasFrame, frameTransform, localToAtlas } from "./campaign-atlas-model";
import { citySvg } from "./city-model";
import { roomPath, elementSvg } from "./drawing-model";
export function atlasRegionSVG(
  data: AtlasRenderView,
  records: LandscapeRecord[],
  box: LandscapeBox,
  width: number,
  assets: Map<string, string>,
  options: {
    grid: boolean;
    level: number;
    references: boolean;
    floorId: string;
    roofs: boolean;
    scopeId?:string|null;
    labelUnitsPerPixel?:number;
    rasters?: import("./landscape-raster").LandscapeRaster[];
  },
) {
  const svg = landscapeNode("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      "font-family":"Noto Sans, sans-serif",
      viewBox: `0 0 ${box.width} ${box.height}`,
    }) as SVGSVGElement,
    mpp = box.width / width,
    labelMpp=options.labelUnitsPerPixel&&Number.isFinite(options.labelUnitsPerPixel)&&options.labelUnitsPerPixel>0?options.labelUnitsPerPixel:mpp;
  svg.append(
    landscapeNode("rect", {
      width: box.width,
      height: box.height,
      fill: "#b8c896",
    }),
  );
  drawLandscape(svg, records, box, mpp, assets, options.references,options.rasters);
  if (options.grid) drawLandscapeGrid(svg, box, options.level, mpp);
  for (const city of data.cities) {
    const binding = data.bindings.find(
      (b) => b.kind === "city" && b.ownerId === city.header.id,
    );
    if (!binding) continue;
    const f = atlasFrame(data, binding),
      g = landscapeNode("g", {
        transform: frameTransform({ ...f, x: f.x - box.x, y: f.y - box.y }),
      });
    if (city.header.width / mpp < 20) {
      g.append(
        landscapeNode("circle", {
          cx: city.header.width / 2,
          cy: city.header.height / 2,
          r: mpp * 3,
          fill: "#5b4338",
        }),
      );
    } else {
      const doc = new DOMParser().parseFromString(
        citySvg(city),
        "image/svg+xml",
      );
      for(const child of Array.from(doc.documentElement.children)){
        const unitId=child.getAttribute('data-city-unit'),interior=data.bindings.find(b=>b.kind==='dungeon'&&b.parent==='building'&&b.parentId===unitId);
        if(interior&&(!options.roofs||interior.ownerId===options.scopeId))for(const polygon of child.querySelectorAll('polygon'))polygon.setAttribute('fill','none');
        if(interior?.ownerId===options.scopeId)for(const text of child.querySelectorAll('text'))text.remove();
        if(child.tagName==='rect'){child.setAttribute('width',String(city.header.width));child.setAttribute('height',String(city.header.height));}
        for(const text of [child,...Array.from(child.querySelectorAll('text'))].filter(n=>n.tagName==='text'))text.setAttribute('font-size',String(Math.min(Number(text.getAttribute('font-size'))||6,12*labelMpp)));
        g.append(document.importNode(child,true));
      }
    }
    svg.append(g);
  }
  for (const b of data.bindings.filter((b) => b.kind === "dungeon")) {
    if (b.parent === "building" && options.roofs && b.ownerId!==options.scopeId) continue;
    const f = atlasFrame(data, b),
      g = landscapeNode("g", {
        transform: frameTransform({ ...f, x: f.x - box.x, y: f.y - box.y }),
      });
    const labels=landscapeNode('g',{'data-atlas-room-labels':b.ownerId});
    for (const room of data.workspace.rooms.filter(
      (r) => r.scopeId === b.ownerId && r.floorId === options.floorId,
    )) {
      g.append(
        landscapeNode("path", {
          d: roomPath(room.polygons),
          fill: "#ded7bd",
          stroke: "#3f5146",
          "stroke-width": Math.max(0.12, mpp * 0.7),
          "fill-rule": "evenodd",
        }),
      );
      appendAtlasRoomLabels(labels,room,labelMpp,point=>{const at=localToAtlas(point,f);return {x:at.x-box.x,y:at.y-box.y};});
    }
    for (const e of data.geometry.drawing.elements.filter(
      (e) => e.scopeId === b.ownerId && e.floorId === options.floorId && !e.archived,
    )) {
      const container = landscapeNode("g");
      container.innerHTML = elementSvg(
        e,
        data.workspace.rooms,
        data.geometry.drawing.elements,
      );
      g.append(container);
    }
    svg.append(g,labels);
  }
  return svg;
}
