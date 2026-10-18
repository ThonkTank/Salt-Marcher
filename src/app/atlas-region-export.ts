import {paintElement} from './atlas-paint-svg';
import {appendAtlasRoomLabels} from './atlas-room-labels';
import { atlasPaint as landscapeNode } from "./atlas-paint";
import { regionValue } from "./atlas-region-contracts";
import type { AtlasRenderView } from "./campaign-atlas-contracts";
import type { LandscapeRecord, LandscapeBox } from "./atlas-landscape";
import { drawLandscape, drawLandscapeGrid } from "./atlas-landscape-view";
import { atlasFrame, frameMatrix } from "./campaign-atlas-model";
import { cityPaint } from "./city-model";
import { roomPath, elementPaint } from "./drawing-model";
export function atlasRegionPaint(
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
  const scene = landscapeNode("group", {}),
    mpp = box.width / width,scope=options.scopeId!==undefined?options.scopeId:data.region?.scopeId,labelMpp=options.labelUnitsPerPixel??mpp;
  scene.append(
    landscapeNode("rect", {
      width: box.width,
      height: box.height,
      style: { fill: "#b8c896" },
    }),
  );
  drawLandscape(
    scene,
    records,
    box,
    mpp,
    assets,
    options.references,
    options.rasters,
  );
  if (options.grid) drawLandscapeGrid(scene, box, options.level, mpp);
  if (data.region?.raster) {
    const tile = data.region.raster;
    scene.append(
      landscapeNode("image", {
        x: tile.box.x - box.x,
        y: tile.box.y - box.y,
        width: tile.box.width,
        height: tile.box.height,
        source: tile.data,
      }),
    );
    return scene;
  }
  const interiorOf=(id:string)=>regionValue(data.region?.interiors,id)??data.bindings.find(b=>b.kind==='dungeon'&&b.parent==='building'&&b.parentId===id)?.ownerId;
  for (const city of data.cities) {
    const binding = data.bindings.find(
      (b) => b.kind === "city" && b.ownerId === city.header.id,
    );
    if (!binding) continue;
    const f = atlasFrame(data, binding),
      g = landscapeNode("group", {
        matrix: frameMatrix({ ...f, x: f.x - box.x, y: f.y - box.y }),
      });
    if (city.header.width / mpp < 20) {
      g.append(
        landscapeNode("circle", {
          x: city.header.width / 2,
          y: city.header.height / 2,
          radius: mpp * 3,
          style: { fill: "#5b4338" },
        }),
      );
    } else {
      const cityScene = cityPaint(city);
      for (const element of cityScene.children) {
        const id = element.data.cityUnit,
          interior = id && interiorOf(id);
        if (
          interior &&
          (!options.roofs || interior === scope)
        )
          for (const polygon of element.children.filter(
            (n) => n.kind === "polygon",
          )) {
            polygon.style.fill = null;
            if (
              interior === scope &&
              options.floorId !== "ground"
            )
              polygon.geometry.hidden = true;
          }
      }
      for(const element of cityScene.children){if(element.data.cityUnit&&interiorOf(element.data.cityUnit)===scope&&scope)element.children.splice(0,element.children.length,...element.children.filter(n=>n.kind!=='text'));for(const label of [element,...element.children].filter(n=>n.kind==='text'))label.style.fontSize=Math.min(label.style.fontSize??6,12*labelMpp);}
      g.append(cityScene);
    }
    scene.append(g);
  }
  for (const b of data.bindings.filter((b) => b.kind === "dungeon")) {
    if (
      b.parent === "building" &&
      options.roofs &&
      b.ownerId !== scope
    )
      continue;
    const floor = data.region
      ? b.ownerId === data.region.scopeId
        ? data.region.floorId
        : "ground"
      : options.floorId;
    const f = atlasFrame(data, b),
      g = landscapeNode("group", {
        matrix: frameMatrix({ ...f, x: f.x - box.x, y: f.y - box.y }),
      });
    const labels=landscapeNode('group',{data:{atlasRoomLabels:b.ownerId}});scene.append(labels);
    for (const room of data.workspace.rooms.filter(
      (r) => r.scopeId === b.ownerId && r.floorId === floor,
    )) {
      g.append(
        landscapeNode("path", {
          path: roomPath(room.polygons),
          style: {
            fill: "#ded7bd",
            stroke: "#3f5146",
            lineWidth: Math.max(0.12, mpp * 0.7),
            fillRule: "evenodd",
          },
        }),
      );
      appendAtlasRoomLabels(labels,room,labelMpp,p=>{const c=Math.cos(f.angle),s=Math.sin(f.angle);return{x:f.x+p.x*c-p.y*s-box.x,y:f.y+p.x*s+p.y*c-box.y};});
    }
    for (const e of data.geometry.drawing.elements.filter(
      (e) => e.scopeId === b.ownerId && e.floorId === floor,
    )) {
      g.append(
        elementPaint(e, data.workspace.rooms, data.geometry.drawing.elements),
      );
    }
    scene.append(g);
  }
  return scene;
}

/** Explicit vector adapter for historical document interfaces, never used by Canvas painting. */
export function atlasRegionSVG(...args:Parameters<typeof atlasRegionPaint>){const p=atlasRegionPaint(...args);p.geometry.size={width:args[2].width,height:args[2].height};return paintElement(p,document) as SVGSVGElement;}
