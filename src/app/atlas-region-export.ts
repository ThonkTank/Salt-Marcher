import {atlasWorkplaneData} from './atlas-workplane';
import { atlasPaint as landscapeNode } from "./atlas-paint";
import { regionValue } from "./atlas-region-contracts";
import type { AtlasRenderView } from "./campaign-atlas-contracts";
import type { LandscapeRecord, LandscapeBox } from "./atlas-landscape";
import { drawLandscape, drawLandscapeGrid } from "./atlas-landscape-view";
import { atlasFrame, frameMatrix } from "./campaign-atlas-model";
import { cityObjectsPaint } from "./city-model";
import { centerInRoom } from "./dungeon-model";
import { elementPaint, roomFacePaint } from "./drawing-model";
export function atlasRegionPaint(
  data: AtlasRenderView,
  records: LandscapeRecord[],
  box: LandscapeBox,
  width: number,
  assets: Map<string, string>,
  options: {
    automaticLabels?:boolean;
    grid: boolean;
    level: number | string;
    references: boolean;
    floorId: string;
    roofs: boolean;
    rasters?: import("./landscape-raster").LandscapeRaster[];
  },
) {
  const scene = landscapeNode("group", {}),
    mpp = box.width / width;
  scene.append(
    landscapeNode("rect", {
      width: box.width,
      height: box.height,
      style: { fill: "#7fa8bd" },data:{spatialGround:"true"},
    }),
  );
  drawLandscape(
    scene,
    records,
    box,
    mpp,
    assets,
    options.references,
    options.rasters,undefined,options.automaticLabels,
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
  for (const city of data.cities) {
    const binding = data.bindings.find(
      (b) => b.kind === "city" && b.ownerId === city.header.id,
    );
    if (!binding) continue;
    const f = atlasFrame(data, binding),
      g = landscapeNode("group", {
        matrix: frameMatrix({ ...f, x: f.x - box.x, y: f.y - box.y }),
      });
    {
      const cityScene = cityObjectsPaint(city,!options.automaticLabels,mpp);
      for (const element of cityScene.children) {
        const id = element.data.cityUnit,
          interior = id && regionValue(data.region?.interiors, id);
        if (
          interior &&
          (!options.roofs || mpp <= 0.4 || interior === data.region?.scopeId)
        )
          for (const polygon of element.children.filter(
            (n) => ["polygon","polygons"].includes(n.kind),
          )) {
            polygon.style.fill = null;
            if (
              interior === data.region?.scopeId &&
              options.floorId !== "ground"
            )
              polygon.geometry.hidden = true;
          }
      }
      g.append(cityScene);
    }
    scene.append(g);
  }
  for (const b of data.bindings.filter((b) => b.kind === "dungeon")) {
    if (
      b.parent === "building" &&
      options.roofs &&
      mpp > 0.4 &&
      b.ownerId !== data.region?.scopeId
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
        data:atlasWorkplaneData({scopeId:b.ownerId,elevationM:data.geometry.floors.find(f=>f.scopeId===b.ownerId&&f.id===floor)?.elevation??0,anchor:{x:f.x,y:f.y}}),
      });
    for (const room of data.workspace.rooms.filter(
      (r) => r.scopeId === b.ownerId && r.floorId === floor,
    )) {
      g.append(roomFacePaint(room,mpp,data.geometry.drawing.styles?.find(s=>s.id===room.id)));
      if (!options.automaticLabels && room.polygons[0]?.outer[0]) {
        const p = centerInRoom(room);
        g.append(
          landscapeNode(
            "text",
            {
              x: p.x,
              y: p.y,
              style: { fontSize: Math.max(0.3, mpp * 16), textAlign:"center", textBaseline:"middle", fill: "#203648", stroke:"white", lineWidth:3*mpp, lineJoin:"round" },
            },
            [room.number, room.name].filter(Boolean).join(" · "),
          ),
        );
      }
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
