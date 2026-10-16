import type { CampaignAtlas } from "./campaign-atlas-contracts";
import type { LandscapeRecord, LandscapeBox } from "./atlas-landscape";
import {
  drawLandscape,
  drawLandscapeGrid,
  landscapeNode,
} from "./atlas-landscape-view";
import { atlasFrame, frameTransform } from "./campaign-atlas-model";
import { citySvg } from "./city-model";
import { roomPath, elementSvg } from "./drawing-model";
export function atlasRegionSVG(
  data: CampaignAtlas,
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
    rasters?: import("./landscape-raster").LandscapeRaster[];
  },
) {
  const svg = landscapeNode("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${box.width} ${box.height}`,
    }) as SVGSVGElement,
    mpp = box.width / width;
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
      g.append(document.importNode(doc.documentElement, true));
    }
    svg.append(g);
  }
  for (const b of data.bindings.filter((b) => b.kind === "dungeon")) {
    if (b.parent === "building" && options.roofs) continue;
    const f = atlasFrame(data, b),
      g = landscapeNode("g", {
        transform: frameTransform({ ...f, x: f.x - box.x, y: f.y - box.y }),
      });
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
      if (room.polygons[0]?.outer[0]) {
        const p = room.polygons[0].outer[0];
        g.append(
          landscapeNode(
            "text",
            {
              x: p.x,
              y: p.y,
              "font-size": Math.max(0.3, mpp * 11),
              fill: "#293d34",
            },
            [room.number, room.name].filter(Boolean).join(" · "),
          ),
        );
      }
    }
    for (const e of data.geometry.drawing.elements.filter(
      (e) => e.scopeId === b.ownerId && e.floorId === options.floorId,
    )) {
      const container = landscapeNode("g");
      container.innerHTML = elementSvg(
        e,
        data.workspace.rooms,
        data.geometry.drawing.elements,
      );
      g.append(container);
    }
    svg.append(g);
  }
  return svg;
}
