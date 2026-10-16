import {drawLandscape,landscapeNode} from "./atlas-landscape-view";
import {hexPolygon,type LandscapeRecord} from "./atlas-landscape";
import type { CampaignAtlas } from "./campaign-atlas-contracts";
import type { CanvasBox } from "./passive-map-canvas";
import type { PlayerFrame } from "./player-contracts";
import {
  atlasFrame,
  atlasHexPoint,
  localToAtlas,
} from "./campaign-atlas-model";
import { roomPath } from "./drawing-model";
import { terrainColors } from "./world-model";
const ns = "http://www.w3.org/2000/svg";
/** Public output is built from the existing public projection, never by hiding GM nodes. */
export function publicAtlasSVG(
  a: CampaignAtlas,
  box: CanvasBox,
  frame?: PlayerFrame,
  landscape:LandscapeRecord[]=[],
): SVGSVGElement {
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  svg.setAttribute("xmlns", ns);
  const add = (
    tag: string,
    attrs: Record<string, string | number>,
    text?: string,
  ) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    if (text) n.textContent = text;
    svg.append(n);
    return n;
  };
  add("rect", { width: box.width, height: box.height, fill: "#20282a" });
  if (a.geometry.position && a.perception) {
    const pose = a.geometry.position,
      b = a.bindings.find(
        (b) => b.kind === "dungeon" && b.ownerId === pose.scopeId,
      );
    if (!b) throw new Error("Raum ist nicht im Atlas verortet.");
    const f = atlasFrame(a, b),
      at = (p: { x: number; y: number }) => {
        const n = localToAtlas(p, f);
        return { x: n.x - box.x, y: n.y - box.y };
      },
      transform = `translate(${f.x - box.x} ${f.y - box.y}) rotate(${(f.angle * 180) / Math.PI})`;
    for (const [polys, fill] of [
      [a.perception.known, "#7c7e74"],
      [a.perception.visible, "#ded7bd"],
    ] as const)
      if (polys.length)
        add("path", {
          d: roomPath(polys),
          transform,
          fill,
          "fill-rule": "evenodd",
        });
    for (const label of a.perception.labels) {
      const p = at(label.point);
      add(
        "text",
        {
          ...p,
          "font-size": box.width / 100,
          "text-anchor": "middle",
          fill: "#203532",
        },
        label.text,
      );
    }
    for (const m of a.perception.markers) {
      const p = at(m.point);
      add("circle", {
        cx: p.x,
        cy: p.y,
        r: box.width / 250,
        fill: m.kind === "npc" ? "#8964a5" : "#39766a",
      });
    }
    const p = at(pose);
    add("circle", {
      cx: p.x,
      cy: p.y,
      r: box.width / 180,
      fill: "#244f87",
      stroke: "white",
      "stroke-width": box.width / 900,
    });
  } else if (frame?.mode === "map" && frame.map) {
    const map = frame.map;
    for (const cell of map.cells) {
      const p = atlasHexPoint(cell.q, cell.r, map.hexMeters),
        r = map.hexMeters / Math.sqrt(3),
        points = Array.from({ length: 6 }, (_, i) => {
          const angle = ((30 + i * 60) * Math.PI) / 180;
          return `${p.x - box.x + Math.cos(angle) * r},${p.y - box.y + Math.sin(angle) * r}`;
        }).join(" ");
      add("polygon", {
        points,
        fill:
          terrainColors[cell.terrain as keyof typeof terrainColors] ??
          "#b8c896",
        opacity: cell.visible ? 1 : 0.55,
      });
      if (cell.label)
        add(
          "text",
          {
            x: p.x - box.x,
            y: p.y - box.y,
            "font-size": map.hexMeters / 15,
            fill: "#203532",
            "text-anchor": "middle",
          },
          cell.label,
        );
    }
    const defs=landscapeNode('defs'),clip=landscapeNode('clipPath',{id:'known-landscape'});for(const c of map.cells){const p=hexPolygon(c.q,c.r,map.hexMeters);clip.append(landscapeNode('path',{d:roomPath([{outer:p.outer.map(v=>({x:v.x-box.x,y:v.y-box.y})),holes:[]}])}));}defs.append(clip);svg.append(defs);const known=landscapeNode('g',{'clip-path':'url(#known-landscape)'});drawLandscape(known,landscape.filter(r=>r.kind==='patch'||r.kind==='river'||r.kind==='road'),box,box.width/2000,new Map(),false);svg.append(known);
    const p = atlasHexPoint(map.position.q, map.position.r, map.hexMeters);
    add("circle", {
      cx: p.x - box.x,
      cy: p.y - box.y,
      r: box.width / 180,
      fill: "#244f87",
    });
  } else
    throw new Error(
      "Für den aktuellen Gruppenkontext ist keine öffentliche Kartenprojektion verfügbar.",
    );
  return svg;
}
export async function atlasPNG(
  svg: SVGSVGElement,
  width: number,
  height: number,
  format:"png"|"jpeg"="png",
): Promise<number[]> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", ns);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml",
    }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(new Error("PNG konnte nicht erzeugt werden.")),
        "image/"+format,
        .94,
      ),
    );
    return [...new Uint8Array(await blob.arrayBuffer())];
  } finally {
    URL.revokeObjectURL(url);
  }
}
