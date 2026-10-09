import { Container, Graphics, GraphicsContext } from "pixi.js";
import type { Point, Polygon } from "../../model";
import { cityInputPoint } from "./input";
import type { CityHit, CityScene, CityShape } from "./scene";

type Project = (point: Point) => Point;
const colors = {
  road: 0xd3d5cf,
  plaza: 0x98a6ad,
  roof: 0x5b7287,
  edge: 0x273c4a,
  district: 0x8cafa1,
  selected: 0xe7b24e,
};
function ring(
  context: GraphicsContext,
  points: readonly Point[],
  project: Project,
) {
  return context.poly(
    points.flatMap((point) => {
      const p = cityInputPoint(project(point));
      return [p.x, p.y];
    }),
    true,
  );
}
function outline(
  context: GraphicsContext,
  polygon: Polygon,
  project: Project,
  selected = false,
) {
  for (const points of [polygon.outer, ...polygon.holes])
    ring(context, points, project).stroke({
      color: selected ? colors.selected : colors.edge,
      width: selected ? 2 : 1,
    });
}
function area(
  context: GraphicsContext,
  shape: Exclude<CityShape, { kind: "road" }>,
  project: Project,
) {
  const color =
    shape.kind === "building"
      ? colors.roof
      : shape.kind === "plaza"
        ? colors.plaza
        : colors.district;
  const alpha =
    shape.kind === "district"
      ? 0.12
      : shape.kind === "plot"
        ? 0.2
        : shape.kind === "plaza"
          ? 0.65
          : 1;
  ring(context, shape.polygon.outer, project).fill({ color, alpha });
  // One compound cut: repeated cuts can also modify the preceding instruction in Pixi8.
  if (shape.polygon.holes.length) {
    for (const hole of shape.polygon.holes) ring(context, hole, project);
    context.cut();
  }
  outline(context, shape.polygon, project);
}
function road(
  context: GraphicsContext,
  shape: Extract<CityShape, { kind: "road" }>,
  project: Project,
) {
  const radius = shape.widthMeters / 2;
  for (let i = 1; i < shape.points.length; i++) {
    const a = shape.points[i - 1]!,
      b = shape.points[i]!;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length === 0)
      throw new Error("Straßensegment ist numerisch nicht darstellbar.");
    const x = (-dy / length) * radius,
      y = (dx / length) * radius;
    ring(
      context,
      [
        cityInputPoint({ x: a.x + x, y: a.y + y }),
        cityInputPoint({ x: b.x + x, y: b.y + y }),
        cityInputPoint({ x: b.x - x, y: b.y - y }),
        cityInputPoint({ x: a.x - x, y: a.y - y }),
      ],
      project,
    ).fill(colors.road);
  }
  for (const p of shape.points) {
    const center = cityInputPoint(project(p));
    const x = cityInputPoint(
      project(cityInputPoint({ x: p.x + radius, y: p.y })),
    );
    const y = cityInputPoint(
      project(cityInputPoint({ x: p.x, y: p.y + radius })),
    );
    const a = x.x - center.x,
      b = x.y - center.y,
      c = y.x - center.x,
      d = y.y - center.y;
    if (![a, b, c, d].every(Number.isFinite))
      throw new Error("Straßenprojektion ist numerisch nicht darstellbar.");
    context
      .save()
      .setTransform(a, b, c, d, center.x, center.y)
      .circle(0, 0, 1)
      .fill(colors.road)
      .restore();
  }
}

/** Owns drawing only; project is the caller's affine local-meter -> Atlas screen mapping. */
export class CityRenderer {
  readonly container = new Container({ label: "City" });
  private readonly base = new Graphics(new GraphicsContext());
  private readonly overlay = new Graphics(new GraphicsContext());
  private destroyed = false;
  constructor() {
    this.container.addChild(this.base, this.overlay);
  }
  draw(
    scene: CityScene,
    project: Project,
    options: {
      readonly selection?: CityHit | null;
      readonly showNodes?: boolean;
    } = {},
  ): void {
    if (this.destroyed) throw new Error("Stadtzeichnung wurde freigegeben.");
    const base = new GraphicsContext(),
      overlay = new GraphicsContext();
    try {
      if (
        options.showNodes !== undefined &&
        typeof options.showNodes !== "boolean"
      )
        throw new Error("Ungültige Knotensichtbarkeit.");
      for (const shape of scene.shapes) {
        if (shape.kind === "road") road(base, shape, project);
        else area(base, shape, project);
        const selected = options.selection;
        if (
          selected?.ownerId === scene.ownerId &&
          selected.kind === shape.kind &&
          selected.elementId === shape.elementId
        ) {
          if (shape.kind === "road") {
            // Mark the editable reference line, without false bounds or internal capsule seams.
            for (let i = 0; i < shape.points.length; i++) {
              const p = cityInputPoint(project(shape.points[i]!));
              if (i === 0) overlay.moveTo(p.x, p.y);
              else overlay.lineTo(p.x, p.y);
            }
            overlay.stroke({
              color: colors.selected,
              width: 2,
              cap: "round",
              join: "round",
            });
          } else outline(overlay, shape.polygon, project, true);
        }
      }
      if (options.showNodes)
        for (const node of scene.nodes) {
          const p = cityInputPoint(project(node.point)),
            selected = options.selection;
          const active =
            selected?.ownerId === scene.ownerId &&
            selected.kind === "node" &&
            selected.elementId === node.id;
          overlay
            .circle(p.x, p.y, 5)
            .fill(colors.road)
            .stroke({
              color: active ? colors.selected : colors.edge,
              width: active ? 2 : 1,
            });
        }
    } catch (error) {
      base.destroy();
      overlay.destroy();
      this.clear();
      throw error;
    }
    const oldBase = this.base.context,
      oldOverlay = this.overlay.context;
    this.base.context = base;
    this.overlay.context = overlay;
    oldBase.destroy();
    oldOverlay.destroy();
  }
  clear(): void {
    if (this.destroyed) return;
    this.base.context.clear();
    this.overlay.context.clear();
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.base.context.destroy();
    this.overlay.context.destroy();
    this.base.destroy({ context: false });
    this.overlay.destroy({ context: false });
    this.container.destroy();
  }
}
