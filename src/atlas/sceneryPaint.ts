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
    } else if (scenery.biome === "forest" || scenery.biome === "scrub") {
      circle(0.12, 0.16, 0.78, "#293d3038");
      const tones =
        scenery.biome === "forest"
          ? ["#395b3f", "#426b48", "#4d764c", "#3e6654"]
          : ["#697b44", "#7c8c50", "#5b7547", "#87915d"];
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
      circle(
        -0.18,
        -0.2,
        0.44,
        scenery.biome === "forest" ? "#699159" : "#99a86c",
      );
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
