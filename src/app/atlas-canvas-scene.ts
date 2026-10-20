import type { Polygon } from "./contracts";
import { AtlasPaint, type PaintStyle } from "./atlas-paint";
export { AtlasPaint, atlasPaint } from "./atlas-paint";
function polygonPath(polygons: Polygon[]) {
  const path = new Path2D();
  for (const polygon of polygons) {
    for (const ring of [polygon.outer, ...polygon.holes]) {
      if (!ring.length) continue;
      path.moveTo(ring[0]!.x, ring[0]!.y);
      for (let i = 1; i < ring.length; i++) path.lineTo(ring[i]!.x, ring[i]!.y);
      path.closePath();
    }
  }
  return path;
}
export interface PaintHit {
  data: Record<string, string>;
}
export type AtlasPaintCommand = {
  node: AtlasPaint;
  matrix: DOMMatrix;
  path?: Path2D;
  hitPath?: Path2D;
  style: PaintStyle;
  alpha: number;
  pointer: boolean;
  hud: boolean;
  title: string;
  ancestry: PaintHit[];
  cuts?: { path: Path2D; alpha: number }[];
};
function pathFor(n: AtlasPaint) {
  const g = n.geometry;
  if (n.kind === "polygons") return polygonPath(g.polygons ?? []);
  if (n.kind === "path") return new Path2D(g.path ?? "");
  const p = new Path2D(),
    x = g.x ?? 0,
    y = g.y ?? 0;
  switch (n.kind) {
    case "rect":
      if (g.radiusX) p.roundRect(x, y, g.width ?? 0, g.height ?? 0, g.radiusX);
      else p.rect(x, y, g.width ?? 0, g.height ?? 0);
      break;
    case "circle":
      p.arc(x, y, Math.max(0, g.radius ?? 0), 0, 2 * Math.PI);
      break;
    case "ellipse":
      p.ellipse(
        x,
        y,
        Math.max(0, g.radiusX ?? 0),
        Math.max(0, g.radiusY ?? 0),
        0,
        0,
        2 * Math.PI,
      );
      break;
    case "line":
      p.moveTo(x, y);
      p.lineTo(g.x2 ?? 0, g.y2 ?? 0);
      break;
    case "polygon":
    case "polyline":
      if (g.points?.length) {
        p.moveTo(g.points[0]!.x, g.points[0]!.y);
        for (const a of g.points.slice(1)) p.lineTo(a.x, a.y);
        if (n.kind === "polygon") p.closePath();
      }
      break;
    default:
      return undefined;
  }
  return p;
}
export type AtlasPathCache = WeakMap<AtlasPaint, {path?:Path2D;cuts?:AtlasPaintCommand["cuts"]}>;
export class AtlasCanvasScene {
  pathBuilds=0;
  pathReuses=0;
  private maskSurface: HTMLCanvasElement | null = null;
  readonly commands: AtlasPaintCommand[] = [];
  readonly images = new Set<string>();
  readonly requiredImages = new Set<string>();
  readonly landscapeImages = new Set<string>();
  constructor(readonly root: AtlasPaint, cache:AtlasPathCache=new WeakMap()) {
    const visit = (
      node: AtlasPaint,
      matrix: DOMMatrix,
      style: PaintStyle,
      alpha: number,
      pointer: boolean,
      hud: boolean,
      title: string,
      ancestry: PaintHit[],
      retained: boolean,
    ) => {
      const g = node.geometry;
      retained=retained||!!g.retainGeometry;
      if (g.hidden) return;
      matrix = g.matrix ? matrix.multiply(new DOMMatrix(g.matrix)) : matrix;
      style = { ...style, ...node.style };
      alpha *= g.opacity ?? 1;
      pointer = pointer && g.pointer !== false;
      hud = hud || !!g.hud;
      title = node.title || title;
      ancestry = [node, ...ancestry];
      if (node.kind !== "group") {
        let compiled=retained?cache.get(node):undefined;
        if(compiled){if(compiled.path)this.pathReuses++;}
        else{
          compiled={path:pathFor(node),cuts:g.maskCuts?.map(c=>({path:polygonPath(c.polygons),alpha:c.alpha}))};
          if(compiled.path)this.pathBuilds++;
          if(retained)cache.set(node,compiled);
        }
        this.commands.push({
          node,
          matrix,
          ...compiled,
          style,
          alpha,
          pointer,
          hud,
          title,
          ancestry,

        });
        if (node.kind === "image" && g.source) {this.images.add(g.source);if(node.data.landscapeRaster==='true')this.landscapeImages.add(g.source);if(!g.optionalImage)this.requiredImages.add(g.source);}
      }
      for (const child of node.children)
        visit(child, matrix, style, alpha, pointer, hud, title, ancestry, retained);
    };
    visit(
      root,
      new DOMMatrix(),
      { fill: "black", stroke: null, lineWidth: 1 },
      1,
      true,
      false,
      "",
      [],
      false,
    );
  }
  dispose() {
    if (this.maskSurface) this.maskSurface.width = this.maskSurface.height = 0;
    this.maskSurface = null;
  }
  draw(
    ctx: CanvasRenderingContext2D,
    view: DOMMatrix,
    images: Map<string, CanvasImageSource>,
    hudOffset: { x: number; y: number },
    accept: (command:AtlasPaintCommand)=>boolean = ()=>true,
  ) {
    for (const c of this.commands) {
      if(!accept(c))continue;
      const n = c.node,
        g = n.geometry,
        s = c.style;
      const matrix = (
        c.hud
          ? DOMMatrix.fromMatrix(view).translate(hudOffset.x, hudOffset.y)
          : view
      ).multiply(c.matrix);
      ctx.save();
      try {
        ctx.setTransform(matrix);
        ctx.globalAlpha = c.alpha;
        ctx.fillStyle = s.fill ?? "transparent";
        ctx.strokeStyle = s.stroke ?? "transparent";
        this.strokeStyle(ctx, c);
        if (c.cuts) {
          const layer = (this.maskSurface ??= document.createElement("canvas"));
          if (layer.width !== ctx.canvas.width) layer.width = ctx.canvas.width;
          if (layer.height !== ctx.canvas.height)
            layer.height = ctx.canvas.height;
          const fog = layer.getContext("2d")!;
          fog.resetTransform();
          fog.clearRect(0, 0, layer.width, layer.height);
          fog.globalCompositeOperation = "source-over";
          fog.globalAlpha = 1;
          fog.setTransform(matrix);
          fog.fillStyle = s.fill ?? "transparent";
          fog.fill(c.path!, s.fillRule ?? "nonzero");
          fog.globalCompositeOperation = "destination-out";
          for (const cut of c.cuts) {
            fog.globalAlpha = cut.alpha;
            fog.fill(cut.path, "evenodd");
          }
          ctx.resetTransform();
          ctx.drawImage(layer, 0, 0);
        } else if (c.path) {
          if (s.fill) {
            ctx.globalAlpha = c.alpha * (s.fillOpacity ?? 1);
            ctx.fill(c.path, s.fillRule ?? "nonzero");
          }
          if (s.stroke) {
            ctx.globalAlpha = c.alpha * (s.strokeOpacity ?? 1);
            ctx.stroke(c.path);
          }
        } else if (n.kind === "text") {
          ctx.font = `${s.fontWeight ?? "normal"} ${s.fontSize ?? 16}px ${s.fontFamily ?? "sans-serif"}`;
          ctx.textAlign = s.textAlign ?? "left";
          ctx.textBaseline = s.textBaseline ?? "alphabetic";
          const x = g.x ?? 0,
            y = g.y ?? 0;
          if (c.pointer && !c.hitPath) {
            const m = ctx.measureText(n.text),
              p = new Path2D();
            p.rect(
              x - m.actualBoundingBoxLeft,
              y - m.actualBoundingBoxAscent,
              m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
              m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
            );
            c.hitPath = p;
          }
          if (s.stroke) {
            ctx.globalAlpha = c.alpha * (s.strokeOpacity ?? 1);
            ctx.strokeText(n.text, x, y);
          }
          if (s.fill) {
            ctx.globalAlpha = c.alpha * (s.fillOpacity ?? 1);
            ctx.fillText(n.text, x, y);
          }
        } else if (n.kind === "image") {
          const image = images.get(g.source ?? "");
          if (!image) {
            if(!g.optionalImage)throw Error("Kartenbild fehlt.");
            const x=g.x??0,y=g.y??0,w=g.width??0,h=g.height??0,p=new Path2D();p.rect(x,y,w,h);p.moveTo(x,y);p.lineTo(x+w,y+h);p.moveTo(x+w,y);p.lineTo(x,y+h);ctx.strokeStyle='#75604e';ctx.lineWidth=Math.max(w,h)/200;ctx.stroke(p);continue;
          }
          ctx.drawImage(image, g.x ?? 0, g.y ?? 0, g.width ?? 0, g.height ?? 0);
        }
      } finally {
        ctx.restore();
      }
    }
  }
  hit(
    ctx: CanvasRenderingContext2D,
    p: { x: number; y: number },
    keys: string[],
  ): PaintHit | null {
    const c = this.commandAt(ctx, p, (c) =>
      c.ancestry.some((n) => keys.some((k) => n.data[k] !== undefined)),
    );
    return (
      c?.ancestry.find((n) => keys.some((k) => n.data[k] !== undefined)) ?? null
    );
  }
  tooltip(ctx: CanvasRenderingContext2D, p: { x: number; y: number }) {
    return this.commandAt(ctx, p, () => true)?.title ?? "";
  }
  private strokeStyle(ctx: CanvasRenderingContext2D, c: AtlasPaintCommand) {
    const s = c.style;
    ctx.lineWidth = s.lineWidth ?? 1;
    ctx.lineCap = s.lineCap ?? "butt";
    ctx.lineJoin = s.lineJoin ?? "miter";
    ctx.setLineDash(s.lineDash ?? []);
    ctx.lineDashOffset = s.lineDashOffset ?? 0;
  }
  private commandAt(
    ctx: CanvasRenderingContext2D,
    p: { x: number; y: number },
    accept: (c: AtlasPaintCommand) => boolean,
  ) {
    ctx.save();
    ctx.resetTransform();
    try {
      for (let i = this.commands.length - 1; i >= 0; i--) {
        const c = this.commands[i]!,
          path = c.hitPath ?? c.path;
        if (!c.pointer || !path || !accept(c)) continue;
        const at = new DOMPoint(p.x, p.y).matrixTransform(c.matrix.inverse());
        this.strokeStyle(ctx, c);
        if (
          (c.style.fill &&
            ctx.isPointInPath(
              path,
              at.x,
              at.y,
              c.style.fillRule ?? "nonzero",
            )) ||
          (c.style.stroke && ctx.isPointInStroke(path, at.x, at.y))
        )
          return c;
      }
      return null;
    } finally {
      ctx.restore();
    }
  }
}
