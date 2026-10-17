/** Retained paint commands, not browser elements. Canonical objects stay in the source frame. */
export class AtlasPaint {
  readonly children: AtlasPaint[] = [];
  readonly dataset: Record<string, string> = {};
  parent: AtlasPaint | null = null;
  textContent = "";
  readonly attrs: Record<string, string> = {};
  constructor(
    readonly tagName: string,
    attrs: Record<string, string | number> = {},
  ) {
    for (const [key, value] of Object.entries(attrs))
      this.setAttribute(key, String(value));
  }
  setAttribute(key: string, value: string) {
    this.attrs[key] = value;
    if (key.startsWith("data-"))
      this.dataset[
        key.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
      ] = value;
  }
  getAttribute(key: string) {
    return this.attrs[key] ?? null;
  }
  append(...nodes: AtlasPaint[]) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  closest(selector: string): AtlasPaint | null {
    for (let n: AtlasPaint | null = this; n; n = n.parent)
      if (
        selector.split(",").some((s) => {
          const m = s.trim().match(/^\[data-([\w-]+)\]$/);
          return (
            !!m &&
            n!.dataset[
              m[1]!.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
            ] !== undefined
          );
        })
      )
        return n;
    return null;
  }
  /** Adapter for the existing, internally generated object glyphs. Never mounted or rasterized as SVG. */
  set innerHTML(markup: string) {
    this.children.length = 0;
    const doc = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg">' + markup + "</svg>",
      "image/svg+xml",
    );
    if (doc.querySelector("parsererror"))
      throw Error("Ungültiges Kartenzeichen.");
    for (const child of doc.documentElement.children)
      this.append(paintFromElement(child));
  }
}
export const atlasPaint = (
  tag: string,
  attrs: Record<string, string | number> = {},
  text?: string,
) => {
  const node = new AtlasPaint(tag, attrs);
  if (text) node.textContent = text;
  return node;
};
export function paintFromElement(element: Element): AtlasPaint {
  const node = new AtlasPaint(element.localName);
  for (const a of element.attributes) node.setAttribute(a.name, a.value);
  node.textContent = element.childElementCount
    ? ""
    : (element.textContent ?? "");
  for (const child of element.children) node.append(paintFromElement(child));
  return node;
}
export type PaintTarget = SVGElement | AtlasPaint;
/** Shared geometry generators can still emit vector exports without coupling the screen to SVG. */
export function paintFactory(root: PaintTarget) {
  return (
    tag: string,
    attrs: Record<string, string | number> = {},
    text?: string,
  ): any => {
    if (root instanceof AtlasPaint) return atlasPaint(tag, attrs, text);
    const node = root.ownerDocument.createElementNS(
      "http://www.w3.org/2000/svg",
      tag,
    );
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    if (text) node.textContent = text;
    return node;
  };
}

type Command = {
  node: AtlasPaint;
  matrix: DOMMatrix;
  path?: Path2D;
  fill: string;
  stroke: string;
  width: number;
  alpha: number;
  rule: CanvasFillRule;
  pointer: boolean;
  hud: boolean;
  dash: number[];
  font: string;
  anchor: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  cap: CanvasLineCap;
  join: CanvasLineJoin;
};
const number = (n: AtlasPaint, key: string, fallback = 0) =>
  Number(n.attrs[key] ?? fallback);
function transform(value: string | undefined) {
  const matrix = new DOMMatrix();
  for (const m of (value ?? "").matchAll(
    /(translate|scale|rotate|matrix)\s*\(([^)]*)\)/g,
  )) {
    const a = m[2]!
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (!a.every(Number.isFinite))
      throw Error("Ungültige Kartentransformation.");
    if (m[1] === "translate") matrix.translateSelf(a[0] ?? 0, a[1] ?? 0);
    if (m[1] === "scale") matrix.scaleSelf(a[0] ?? 1, a[1] ?? a[0] ?? 1);
    if (m[1] === "rotate") {
      matrix.translateSelf(a[1] ?? 0, a[2] ?? 0);
      matrix.rotateSelf(a[0] ?? 0);
      matrix.translateSelf(-(a[1] ?? 0), -(a[2] ?? 0));
    }
    if (m[1] === "matrix") matrix.multiplySelf(new DOMMatrix(a));
  }
  return matrix;
}
function pathFor(n: AtlasPaint) {
  const p = new Path2D();
  switch (n.tagName) {
    case "path":
      return new Path2D(n.attrs.d ?? "");
    case "rect": {
      const x = number(n, "x"),
        y = number(n, "y"),
        w = number(n, "width"),
        h = number(n, "height"),
        r = number(n, "rx");
      if (r) p.roundRect(x, y, w, h, r);
      else p.rect(x, y, w, h);
      break;
    }
    case "circle":
      p.arc(
        number(n, "cx"),
        number(n, "cy"),
        Math.max(0, number(n, "r")),
        0,
        Math.PI * 2,
      );
      break;
    case "ellipse":
      p.ellipse(
        number(n, "cx"),
        number(n, "cy"),
        Math.max(0, number(n, "rx")),
        Math.max(0, number(n, "ry")),
        0,
        0,
        Math.PI * 2,
      );
      break;
    case "line":
      p.moveTo(number(n, "x1"), number(n, "y1"));
      p.lineTo(number(n, "x2"), number(n, "y2"));
      break;
    case "polygon":
    case "polyline": {
      const points = (n.attrs.points ?? "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (points.length >= 2) {
        p.moveTo(points[0]!, points[1]!);
        for (let i = 2; i + 1 < points.length; i += 2)
          p.lineTo(points[i]!, points[i + 1]!);
        if (n.tagName === "polygon") p.closePath();
      }
      break;
    }
    default:
      return undefined;
  }
  return p;
}
export class AtlasCanvasScene {
  private masks = new Map<string, { path: Path2D; alpha: number }[]>();
  private maskSurface: HTMLCanvasElement | null = null;
  dispose() {
    if (this.maskSurface) this.maskSurface.width = this.maskSurface.height = 0;
    this.maskSurface = null;
  }
  readonly commands: Command[] = [];
  readonly images = new Set<string>();
  constructor(readonly root: AtlasPaint) {
    const collect = (n: AtlasPaint) => {
      if (n.tagName === "mask" && n.attrs.id)
        this.masks.set(
          n.attrs.id,
          n.children
            .filter((c) => c.tagName === "path")
            .map((c) => ({
              path: new Path2D(c.attrs.d ?? ""),
              alpha: c.attrs.fill === "black" ? 1 : 0.6,
            })),
        );
      for (const child of n.children) collect(child);
    };
    collect(root);
    const visit = (
      node: AtlasPaint,
      matrix: DOMMatrix,
      style: Record<string, string>,
      alpha: number,
      pointer: boolean,
      hud: boolean,
    ) => {
      if (node.attrs.visibility === "hidden" || node.attrs.display === "none")
        return;
      const inherited = { ...style };
      for (const key of [
        "fill",
        "stroke",
        "stroke-width",
        "fill-rule",
        "stroke-linecap",
        "stroke-linejoin",
        "stroke-dasharray",
        "font-size",
        "font-family",
        "font-weight",
        "text-anchor",
        "dominant-baseline",
        "paint-order",
      ])
        if (node.attrs[key] !== undefined) inherited[key] = node.attrs[key]!;
      matrix = matrix.multiply(transform(node.attrs.transform));
      alpha *= number(node, "opacity", 1);
      pointer = pointer && node.attrs["pointer-events"] !== "none";
      hud = hud || node.dataset.canvasHud!==undefined;
      if (
        node.tagName === "defs" ||
        node.tagName === "mask" ||
        node.tagName === "title"
      )
        return;
      if (!["g", "svg"].includes(node.tagName)) {
        const path = pathFor(node);
        if (!path && !["text", "image"].includes(node.tagName))
          throw Error("Nicht unterstütztes Kartenzeichen: " + node.tagName);
        const stroke = inherited.stroke ?? "none",
          fill = inherited.fill ?? "black";
        this.commands.push({
          node,
          matrix,
          path,
          fill,
          stroke,
          width: Number(inherited["stroke-width"] ?? 1),
          alpha,
          rule: inherited["fill-rule"] === "evenodd" ? "evenodd" : "nonzero",
          pointer,
          hud,
          cap: (inherited["stroke-linecap"] ?? "butt") as CanvasLineCap,
          join: (inherited["stroke-linejoin"] ?? "miter") as CanvasLineJoin,
          dash:
            inherited["stroke-dasharray"] &&
            inherited["stroke-dasharray"] !== "none"
              ? inherited["stroke-dasharray"].split(/[ ,]+/).map(Number)
              : [],
          font: `${inherited["font-weight"] ?? "normal"} ${inherited["font-size"] ?? 16}px ${inherited["font-family"] ?? "sans-serif"}`,
          anchor:
            inherited["text-anchor"] === "middle"
              ? "center"
              : inherited["text-anchor"] === "end"
                ? "right"
                : "left",
          baseline: ["central", "middle"].includes(
            inherited["dominant-baseline"] ?? "",
          )
            ? "middle"
            : "alphabetic",
        });
        if (node.tagName === "image" && node.attrs.href)
          this.images.add(node.attrs.href);
      }
      for (const child of node.children)
        visit(child, matrix, inherited, alpha, pointer, hud);
    };
    visit(root, new DOMMatrix(), {}, 1, true, false);
  }
  draw(
    ctx: CanvasRenderingContext2D,
    view: DOMMatrix,
    images: Map<string, CanvasImageSource>,
    hudOffset: { x: number; y: number },
  ) {
    for (const command of this.commands) {
      const { node: n } = command;
      let matrix = view.multiply(command.matrix);
      if (command.hud)
        matrix = DOMMatrix.fromMatrix(view)
          .translate(hudOffset.x, hudOffset.y)
          .multiply(command.matrix);
      ctx.save();
      ctx.setTransform(matrix);
      ctx.globalAlpha = command.alpha;
      ctx.fillStyle = command.fill === "none" ? "transparent" : command.fill;
      ctx.strokeStyle =
        command.stroke === "none" ? "transparent" : command.stroke;
      ctx.lineWidth = command.width;
      ctx.setLineDash(command.dash);
      ctx.lineCap = command.cap;
      ctx.lineJoin = command.join;
      const mask = n.attrs.mask?.match(/^url\(#(.+)\)$/)?.[1];
      if (mask) {
        const definition = this.masks.get(mask);
        if (!definition) throw Error("Sichtmaske fehlt.");
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
        fog.fillStyle = command.fill;
        fog.fill(command.path!, command.rule);
        fog.globalCompositeOperation = "destination-out";
        for (const cut of definition) {
          fog.globalAlpha = cut.alpha;
          fog.fill(cut.path, "evenodd");
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(layer, 0, 0);
      } else if (command.path) {
        if (command.fill !== "none") {
          ctx.globalAlpha = command.alpha * number(n, "fill-opacity", 1);
          ctx.fill(command.path, command.rule);
        }
        if (command.stroke !== "none") {
          ctx.globalAlpha = command.alpha * number(n, "stroke-opacity", 1);
          ctx.stroke(command.path);
        }
      } else if (n.tagName === "text") {
        ctx.font = command.font;
        ctx.textAlign = command.anchor;
        ctx.textBaseline = command.baseline;
        const x = number(n, "x"),
          y = number(n, "y");
        if (command.stroke !== "none") ctx.strokeText(n.textContent, x, y);
        if (command.fill !== "none") ctx.fillText(n.textContent, x, y);
      } else if (n.tagName === "image") {
        const image = images.get(n.attrs.href ?? "");
        if (!image) throw Error("Kartenbild fehlt.");
        ctx.drawImage(
          image,
          number(n, "x"),
          number(n, "y"),
          number(n, "width"),
          number(n, "height"),
        );
      }
      ctx.restore();
    }
  }
  hit(
    ctx: CanvasRenderingContext2D,
    p: { x: number; y: number },
    selector: string,
  ): AtlasPaint | null {
    ctx.save();
    ctx.resetTransform();
    try {
      for (let i = this.commands.length - 1; i >= 0; i--) {
        const c = this.commands[i]!;
        if(!c.pointer||!c.path)continue;
        const target = c.node.closest(selector);
        if(!target)continue;
        const at = new DOMPoint(p.x, p.y).matrixTransform(c.matrix.inverse());
        ctx.lineWidth = c.width;
        ctx.lineCap = c.cap;
        ctx.lineJoin = c.join;
        ctx.setLineDash(c.dash);
        if (
          (c.fill !== "none" &&
            ctx.isPointInPath(c.path, at.x, at.y, c.rule)) ||
          (c.stroke !== "none" && ctx.isPointInStroke(c.path, at.x, at.y))
        )
          return target;
      }
      return null;
    } finally {
      ctx.restore();
    }
  }
}
