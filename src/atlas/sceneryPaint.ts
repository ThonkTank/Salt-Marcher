import type { Scenery } from "./generated/Scenery";

/** Original vector map assets. Geometry is world-sized; no runtime image downloads. */
export function paintScenery(
  c: CanvasRenderingContext2D,
  scenery: Scenery,
  scale: number,
  highlight?: string,
  signature = false,
) {
  const transform = c.getTransform();
  const pixels = Math.hypot(transform.a, transform.b);
  for (const a of scenery.assets) {
    const x = transform.a * a.point[0] + transform.c * a.point[1] + transform.e;
    const y = transform.b * a.point[0] + transform.d * a.point[1] + transform.f;
    const radius = a.size * pixels * 1.2;
    if (
      x + radius < 0 ||
      y + radius < 0 ||
      x - radius > c.canvas.width ||
      y - radius > c.canvas.height
    )
      continue;
    c.save();
    c.translate(...a.point);
    c.rotate(signature ? 0 : a.angle);
    c.scale(a.size, a.size);
    const circle = (x: number, y: number, r: number, fill: string) => {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fillStyle = highlight ?? fill;
      c.fill();
    };
    if (signature) {
      paintSignature(c, scenery.biome, a.variant, highlight);
    } else if (a.size * scale < 2) {
      circle(0, 0, 0.85, scenery.biome === "rocks" ? "#929083" : "#688348");
    } else if (scenery.biome === "forest") {
      paintTree(c, a.variant, a.size * scale, highlight);
    } else if (scenery.biome === "scrub") {
      circle(0.12, 0.16, 0.78, "#293d3038");
      const tones = ["#697b44", "#7c8c50", "#5b7547", "#87915d"];
      circle(0, 0, 0.82, tones[a.variant]);
      for (let i = 0; i < 7; i++) {
        const t = (i * Math.PI * 2) / 7;
        circle(
          Math.cos(t) * 0.56,
          Math.sin(t) * 0.56,
          0.38,
          tones[(a.variant + (i % 2)) % 4],
        );
      }
      circle(-0.18, -0.2, 0.44, "#99a86c");
      c.strokeStyle = "#c4d59960";
      c.lineWidth = 0.045;
      c.beginPath();
      c.arc(-0.18, -0.2, 0.3, 3.2, 5.3);
      c.stroke();
    } else if (scenery.biome === "meadow") {
      c.strokeStyle = ["#718b43", "#8b9d51", "#617f40", "#a0a85f"][a.variant];
      c.lineWidth = 0.09;
      c.lineCap = "round";
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 0.25,
          y = Math.sin(i * 2.4) * 0.22;
        c.beginPath();
        c.moveTo(x, y + 0.35);
        c.quadraticCurveTo(x - 0.12, y - 0.1, x - 0.3, y - 0.3);
        c.moveTo(x, y + 0.35);
        c.quadraticCurveTo(x + 0.08, y - 0.1, x + 0.23, y - 0.4);
        c.stroke();
      }
      if (a.variant % 2 === 0)
        for (const [x, y] of [
          [-0.2, -0.2],
          [0.45, 0.05],
        ]) {
          for (let i = 0; i < 5; i++)
            circle(
              x + Math.cos(i * 1.257) * 0.1,
              y + Math.sin(i * 1.257) * 0.1,
              0.075,
              a.variant === 0 ? "#eee4b5" : "#d8bbd0",
            );
          circle(x, y, 0.045, "#c9a14c");
        }
    } else {
      circle(0.1, 0.14, 0.82, "#403c3030");
      c.beginPath();
      c.moveTo(-0.8, -0.35);
      c.lineTo(-0.2, -0.85);
      c.lineTo(0.65, -0.55);
      c.lineTo(0.9, 0.15);
      c.lineTo(0.35, 0.7);
      c.lineTo(-0.65, 0.6);
      c.closePath();
      c.fillStyle =
        highlight ?? ["#9b9b8d", "#888d86", "#a5a18e", "#92928b"][a.variant];
      c.fill();
      c.strokeStyle = "#666e6266";
      c.lineWidth = 0.06;
      c.stroke();
      c.beginPath();
      c.moveTo(-0.8, -0.35);
      c.lineTo(-0.15, -0.4);
      c.lineTo(0.35, 0.05);
      c.lineTo(0.65, -0.55);
      c.stroke();
    }
    c.restore();
  }
}

/** Area signatures use small groups with a shared upright orientation. They
 * describe a kind of landscape, not a physically oversized individual asset. */
function paintSignature(
  c: CanvasRenderingContext2D,
  biome: Scenery["biome"],
  variant: number,
  highlight?: string,
) {
  c.lineWidth = 0.055;
  c.lineJoin = "round";
  c.lineCap = "round";
  c.strokeStyle = highlight ?? (biome === "rocks" ? "#686d60" : "#526b43");
  c.fillStyle =
    highlight ??
    (biome === "rocks"
      ? "#a3a28f"
      : biome === "forest"
        ? "#71885b"
        : "#8c9b68");
  // Back-to-front groups retain depth without directional highlights or shadows.
  for (const [x, y, r] of [
    [0, -0.3, 0.33],
    [-0.48, 0.25, 0.27],
    [0.45, 0.29, 0.29],
  ]) {
    const size = r * (0.94 + variant * 0.04);
    if (biome === "forest") {
      c.beginPath();
      c.moveTo(x, y + size * 0.6);
      c.lineTo(x, y + size + 0.17);
      c.stroke();
      c.beginPath();
      c.arc(x, y, size, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    } else if (biome === "scrub") {
      c.beginPath();
      c.ellipse(x, y, size, size * 0.6, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    } else if (biome === "meadow") {
      c.beginPath();
      c.moveTo(x - size, y);
      c.quadraticCurveTo(x - size * 0.3, y, x, y + size * 0.6);
      c.lineTo(x, y - size * 0.55);
      c.moveTo(x, y + size * 0.6);
      c.quadraticCurveTo(x + size * 0.3, y, x + size, y - size * 0.1);
      c.stroke();
    } else {
      c.beginPath();
      c.moveTo(x - size, y + size * 0.55);
      c.lineTo(x - size * 0.45, y - size * 0.65);
      c.lineTo(x + size * 0.3, y - size);
      c.lineTo(x + size, y + size * 0.35);
      c.closePath();
      c.fill();
      c.stroke();
    }
  }
}

// Four original pen-and-wash crowns. These bounded drawing paths are shared by
// all trees; camera movement never regenerates foliage or changes a tree's shape.
type TreeDrawing = { crown: Path2D; folds: Path2D; hatch: Path2D };
const treeDrawings: TreeDrawing[] = [];
function treeDrawing(variant: number): TreeDrawing {
  if (treeDrawings[variant]) return treeDrawings[variant];
  const crown = new Path2D(),
    folds = new Path2D(),
    hatch = new Path2D();
  const noise = (n: number) => {
    const v = Math.sin(n * 127.1 + variant * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const count = 38;
  const point = (i: number, inset = 0) => {
    const t = (i / count) * Math.PI * 2;
    const r =
      0.78 +
      0.075 * Math.sin(t * 3 + variant) +
      0.06 * Math.cos(t * 5 - variant) +
      noise(i % count) * 0.08 -
      inset;
    return [
      Math.cos(t) * r * (variant === 1 ? 0.85 : 1),
      Math.sin(t) * r * (variant === 2 ? 0.86 : 1),
    ] as const;
  };
  crown.moveTo(...point(0));
  for (let i = 0; i < count; i++) {
    const a = point(i),
      b = point((i + 1) % count);
    const t = ((i + 0.5) / count) * Math.PI * 2;
    const bulge = 0.075 + noise(i + 50) * 0.07;
    crown.quadraticCurveTo(
      (a[0] + b[0]) / 2 + Math.cos(t) * bulge,
      (a[1] + b[1]) / 2 + Math.sin(t) * bulge,
      ...b,
    );
  }
  crown.closePath();
  // Broken, asymmetric interior boughs keep the crown readable as one tree.
  for (let j = 0; j < 6; j++) {
    const t = j * 2.399 + variant * 0.4;
    const cx = Math.cos(t) * (j === 0 ? 0.06 : 0.36);
    const cy = Math.sin(t) * (j === 0 ? 0.06 : 0.36);
    const r = 0.22 + noise(j + 100) * 0.08;
    const start = t + 0.3;
    folds.moveTo(cx + Math.cos(start) * r, cy + Math.sin(start) * r);
    for (let k = 0; k < 5; k++) {
      const a = start + k * 0.48,
        b = a + 0.48;
      folds.quadraticCurveTo(
        cx + Math.cos((a + b) / 2) * (r + 0.08),
        cy + Math.sin((a + b) / 2) * (r + 0.08),
        cx + Math.cos(b) * r,
        cy + Math.sin(b) * r,
      );
    }
  }
  for (let i = 0; i < 24; i++) {
    const p = point(i, 0.055 + noise(i + 200) * 0.04);
    hatch.moveTo(...p);
    hatch.lineTo(p[0] - 0.035, p[1] - 0.065 - noise(i + 250) * 0.04);
  }
  return (treeDrawings[variant] = { crown, folds, hatch });
}
function paintTree(
  c: CanvasRenderingContext2D,
  variant: number,
  radiusPixels: number,
  highlight?: string,
) {
  const { crown, folds, hatch } = treeDrawing(variant);
  c.lineJoin = "round";
  c.lineCap = "round";
  c.save();
  c.translate(0.09, 0.12);
  c.fillStyle = "#30382c25";
  c.fill(crown);
  c.restore();
  c.fillStyle =
    highlight ?? ["#aab58a", "#b7bd96", "#9faa82", "#b0b696"][variant];
  c.fill(crown);
  c.strokeStyle = highlight ?? "#49513d";
  c.lineWidth = Math.max(0.018, Math.min(0.045, 0.7 / radiusPixels));
  c.stroke(crown);
  if (radiusPixels < 7) return;
  c.save();
  c.clip(crown);
  // A broad translucent wash unifies the crown without glossy circular spots.
  c.beginPath();
  c.moveTo(-0.9, 0.4);
  c.bezierCurveTo(-0.4, 0.72, 0.65, 0.2, 0.48, -0.8);
  c.lineTo(1, -0.8);
  c.lineTo(1, 1);
  c.lineTo(-0.9, 1);
  c.closePath();
  c.fillStyle = "#45543822";
  c.fill();
  c.strokeStyle = highlight ?? "#535d446f";
  c.lineWidth *= 0.8;
  c.stroke(folds);
  if (radiusPixels >= 24) {
    c.strokeStyle = highlight ?? "#50583f75";
    c.lineWidth *= 0.75;
    c.stroke(hatch);
  }
  c.restore();
}
