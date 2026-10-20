import * as THREE from "three";
import type { AtlasPaintCommand } from "./atlas-canvas-scene";
import type { Point } from "./contracts";

/** Text is rasterized once at readable resolution and billboards in the common camera. */
export function atlasSpatialLabel(
  c: AtlasPaintCommand,
  world: (x: number, y: number) => Point,
  position: (point: Point) => THREE.Vector3,
  own: <T extends { dispose(): void }>(resource: T) => T,
) {
  const { node, style: s } = c,
    g = node.geometry,
    m = c.matrix;
  const font = s.fontSize ?? 16;
  if (!font || !node.text) return;
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d")!,
    pixelFont = 48;
  ctx.font = `${s.fontWeight ?? "normal"} ${pixelFont}px ${s.fontFamily ?? "sans-serif"}`;
  const measure = ctx.measureText(node.text),
    padding = 8;
  canvas.width = Math.min(4096, Math.ceil(measure.width + padding * 2));
  canvas.height = 80;
  ctx.font = `${s.fontWeight ?? "normal"} ${pixelFont}px ${s.fontFamily ?? "sans-serif"}`;
  ctx.textBaseline = "alphabetic";
  if (s.stroke) {
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = ((s.lineWidth ?? 1) / font) * pixelFont;
    ctx.globalAlpha = s.strokeOpacity ?? 1;
    ctx.strokeText(node.text, padding, 56);
  }
  if (s.fill) {
    ctx.fillStyle = s.fill;
    ctx.globalAlpha = s.fillOpacity ?? 1;
    ctx.fillText(node.text, padding, 56);
  }
  const texture = own(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = own(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: c.alpha,
        depthTest: true,
        depthWrite: false,
      }),
    ),
    sprite = new THREE.Sprite(mat);
  const scale = (font / pixelFont) * Math.hypot(m.a, m.b),
    width = canvas.width * scale,
    height = canvas.height * scale;
  sprite.position.copy(position(world(g.x ?? 0, g.y ?? 0)));
  sprite.scale.set(width, height, 1);
  const left =
    s.textAlign === "center"
      ? 0.5
      : s.textAlign === "right" || s.textAlign === "end"
        ? 1
        : padding / canvas.width;
  const baseline =
    s.textBaseline === "middle"
      ? 0.5
      : s.textBaseline === "top" || s.textBaseline === "hanging"
        ? 1
        : 1 - 56 / canvas.height;
  sprite.center.set(left, baseline);
  return sprite;
}
