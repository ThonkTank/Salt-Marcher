import { Graphics, Mesh, MeshGeometry, type Texture } from "pixi.js";
import { type Point } from "./model";
import { pathPoints } from "./geometry";
import { buildPathTextureBand } from "./features/material/path-texture-band";
import { isNativePathAssetId } from "./features/material/native-path-catalog";
import type { Visual } from "./renderer";

function samplePolyline(
  points: readonly Point[],
  closed: boolean,
  spacing: number,
): Point[] {
  const result: Point[] = [];
  let carry = 0;
  const count = closed ? points.length : points.length - 1;
  for (let index = 0; index < count; index++) {
    const a = points[index]!,
      b = points[(index + 1) % points.length]!,
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy);
    for (let distance = carry; distance <= length; distance += spacing)
      result.push({
        x: a.x + (dx * distance) / (length || 1),
        y: a.y + (dy * distance) / (length || 1),
      });
    carry = (carry - length) % spacing;
    if (carry < 0) carry += spacing;
  }
  if (!closed && result.at(-1) !== points.at(-1)) result.push(points.at(-1)!);
  return result;
}
function samplePolylineWithAngle(
  points: readonly Point[],
  closed: boolean,
  spacing: number,
): { point: Point; angle: number }[] {
  const result: { point: Point; angle: number }[] = [];
  let carry = 0;
  const count = closed ? points.length : points.length - 1;
  for (let index = 0; index < count; index++) {
    const a = points[index]!,
      b = points[(index + 1) % points.length]!,
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy),
      angle = Math.atan2(dy, dx);
    for (let distance = carry; distance <= length; distance += spacing)
      result.push({
        point: {
          x: a.x + (dx * distance) / (length || 1),
          y: a.y + (dy * distance) / (length || 1),
        },
        angle,
      });
    carry = (carry - length) % spacing;
    if (carry < 0) carry += spacing;
  }
  return result;
}
export function drawPath(v: Visual, g: Graphics, texture?: Texture): void {
    const e = v.entity;
    if (e.kind !== "path") return;
    v.pathMesh?.destroy();
    v.pathGeometry?.destroy();
    v.pathMesh = undefined;
    v.pathGeometry = undefined;
    g.clear();
    const points = pathPoints(e);
    if (points.length < 2) return;
    const line = (graphics: Graphics) => {
      graphics.moveTo(points[0]!.x, points[0]!.y);
      for (let index = 1; index < points.length; index++)
        graphics.lineTo(points[index]!.x, points[index]!.y);
      if (e.closed) graphics.closePath();
    };
    if (e.style === "stones" || e.style === "hedge") {
      const spacing = Math.max(
        0.35,
        e.width * (e.style === "hedge" ? 0.42 : 0.8),
      );
      for (const point of samplePolyline(points, e.closed, spacing))
        g.circle(
          point.x,
          point.y,
          e.width * (e.style === "hedge" ? 0.46 : 0.38),
        )
          .fill(e.color)
          .stroke({ color: e.outlineColor, width: e.outlineWidth });
      return;
    }
    if (texture && e.style === "road" &&
        isNativePathAssetId(e.material?.assetId) && e.material) {
      try {
        const band = buildPathTextureBand({
          points,
          width: e.width,
          textureWidth: texture.width,
          textureHeight: texture.height,
          closed: e.closed,
          repeatLength: e.material.tileSize,
        });
        const geometry = new MeshGeometry({
          positions: new Float32Array(band.positions),
          uvs: new Float32Array(band.uvs),
          indices: new Uint32Array(band.indices),
        });
        const mesh = new Mesh({ geometry, texture });
        mesh.tint = e.material.tint;
        v.container.addChild(mesh);
        v.pathMesh = mesh;
        v.pathGeometry = geometry;
      } catch {
        line(g);
        g.stroke({ texture, color: 0xffffff, width: e.width, join: "round" });
      }
      return;
    }
    line(g);
    g.stroke({
      color: e.outlineColor,
      width: e.width + e.outlineWidth * 2,
      cap: e.start === "round" || e.end === "round" ? "round" : "square",
      join: "round",
    });
    line(g);
    g.stroke({
      ...(texture ? { texture, color: 0xffffff } : { color: e.color }),
      width: e.width,
      cap: e.start === "round" || e.end === "round" ? "round" : "square",
      join: "round",
    });
    if (e.style === "rail") {
      for (const { point, angle } of samplePolylineWithAngle(
        points,
        e.closed,
        Math.max(0.32, e.width * 0.48),
      )) {
        const nx = Math.cos(angle + Math.PI / 2) * e.width * 0.48,
          ny = Math.sin(angle + Math.PI / 2) * e.width * 0.48;
        g.moveTo(point.x - nx, point.y - ny).lineTo(point.x + nx, point.y + ny);
      }
      g.stroke({ color: 0x654b36, width: Math.max(0.06, e.width * 0.1) });
      const count = e.closed ? points.length : points.length - 1;
      for (let index = 0; index < count; index++) {
        const a = points[index]!,
          b = points[(index + 1) % points.length]!,
          dx = b.x - a.x,
          dy = b.y - a.y,
          length = Math.hypot(dx, dy) || 1,
          nx = (-dy / length) * e.width * 0.28,
          ny = (dx / length) * e.width * 0.28;
        g.moveTo(a.x + nx, a.y + ny)
          .lineTo(b.x + nx, b.y + ny)
          .moveTo(a.x - nx, a.y - ny)
          .lineTo(b.x - nx, b.y - ny);
      }
      g.stroke({
        color: 0xc7ced0,
        width: Math.max(0.07, e.width * 0.1),
        cap: "round",
        join: "round",
      });
    } else if (e.style === "rope")
      for (const point of samplePolyline(
        points,
        e.closed,
        Math.max(0.2, e.width * 0.35),
      ))
        g.circle(point.x, point.y, Math.max(0.04, e.width * 0.08)).fill(
          e.outlineColor,
        );
    if (!e.closed && e.end === "taper") {
      const a = points.at(-2)!,
        b = points.at(-1)!;
      g.moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({
          color: e.color,
          width: Math.max(0.08, e.width * 0.35),
          cap: "round",
        });
    }
  }
export function drawRoof(v: Visual, g: Graphics, texture?: Texture): void {
    const e = v.entity;
    if (e.kind !== "roof") return;
    g.clear()
      .poly(
        e.points.flatMap((point) => [point.x, point.y]),
        true,
      )
      .fill(texture ? { texture, color: 0xffffff } : { color: e.color })
      .stroke({ color: e.outlineColor, width: 0.18, join: "round" });
    if (e.roofType === "flat") return;
    if (e.ridge.length >= 2) {
      g.moveTo(e.ridge[0]!.x, e.ridge[0]!.y);
      for (let index = 1; index < e.ridge.length; index++)
        g.lineTo(e.ridge[index]!.x, e.ridge[index]!.y);
      g.stroke({ color: e.outlineColor, width: 0.1, cap: "round" });
      if (e.roofType === "hip")
        for (const corner of e.points) {
          const target = e.ridge.reduce((nearest, point) =>
            Math.hypot(point.x - corner.x, point.y - corner.y) <
            Math.hypot(nearest.x - corner.x, nearest.y - corner.y)
              ? point
              : nearest,
          );
          g.moveTo(corner.x, corner.y).lineTo(target.x, target.y);
        }
      g.stroke({ color: e.outlineColor, width: 0.06, alpha: 0.75 });
    }
  }
