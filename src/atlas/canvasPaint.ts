import { paintHouseRoof } from "./houseRoof";
import type { ExteriorGeometryCache } from "./exteriorGeometryCache";
import { paintScenery } from "./sceneryPaint";
import { parcelGridRange } from "./parcelEditor";
import type { RoadOverlayGeometry } from "./roadDraft";
import type { CellGeometry, InteriorGeometry } from "./interiorPaths";
import {
  openingPoint,
  type Bounds,
  type Parcel,
  type Detail,
  type House,
  type MapObject,
  type PreviewIssue,
  type WorldPoint,
} from "./model";

export const colors: Record<string, string> = {
  grass: "#9db58b",
  earth: "#c8b99b",
  stone: "#aaa9a3",
  water: "#91bcc5",
};
export function polygon(c: CanvasRenderingContext2D, rings: WorldPoint[][]) {
  c.beginPath();
  for (const ring of rings) {
    ring.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath();
  }
}
export function roadLine(c: CanvasRenderingContext2D, r: RoadOverlayGeometry) {
  c.beginPath();
  if (r.nodes.length) c.moveTo(r.nodes[0].point[0], r.nodes[0].point[1]);
  for (let i = 1; i < r.nodes.length; i++) {
    const a = r.nodes[i - 1],
      b = r.nodes[i];
    const outgoing = a.outgoing ?? a.point,
      incoming = b.incoming ?? b.point;
    c.bezierCurveTo(
      outgoing[0],
      outgoing[1],
      incoming[0],
      incoming[1],
      b.point[0],
      b.point[1],
    );
  }
  c.lineWidth = r.width;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.stroke();
}
export function shape(
  c: CanvasRenderingContext2D,
  o: MapObject,
  scale: number,
  geometry: ExteriorGeometryCache,
  highlight?: string,
) {
  if (o.kind === "scenery") {
    c.save();
    paintScenery(c, o, scale, highlight);
    c.restore();
    return;
  }
  const path = geometry.get(o);
  if (!path) return;
  c.save();
  if (o.kind === "road") {
    c.strokeStyle = highlight ?? colors[o.material];
    c.lineWidth = Math.max(o.width, 2 / scale);
    c.lineJoin = "round";
    c.lineCap = "round";
    c.stroke(path);
  } else if (o.kind === "area") {
    c.fillStyle = highlight ?? colors[o.material];
    c.fill(path);
  } else if (o.kind === "parcel") {
    c.strokeStyle = highlight ?? "#857950";
    c.lineWidth = 1 / scale;
    c.stroke(path);
  } else {
    c.fillStyle = highlight ?? o.roof;
    c.fill(path, "evenodd");
    if (!highlight) paintHouseRoof(c, o, path, scale);
    c.strokeStyle = "#514c43";
    c.lineWidth = 1 / scale;
    c.stroke(path);
  }
  c.restore();
}
export function drawIssue(
  c: CanvasRenderingContext2D,
  issue: PreviewIssue,
  scale: number,
) {
  const finite = (p: WorldPoint) => p.length === 2 && p.every(Number.isFinite);
  c.save();
  c.strokeStyle = "#e53329";
  c.fillStyle = "#e5332928";
  c.lineWidth = 3 / scale;
  const geometry = issue.geometry;
  const points =
    geometry?.kind === "polygon" || geometry?.kind === "path"
      ? geometry.points
      : undefined;
  if (points?.length && points.every(finite)) {
    c.beginPath();
    points.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    if (geometry?.kind === "polygon") {
      c.closePath();
      c.fill();
    }
    c.stroke();
  }
  if (geometry?.kind === "bounds" && geometry.bounds.every(Number.isFinite)) {
    const [x, y, X, Y] = geometry.bounds;
    c.strokeRect(x, y, X - x, Y - y);
  }
  if (geometry?.kind === "point" && finite(geometry.point)) {
    c.beginPath();
    c.arc(geometry.point[0], geometry.point[1], 7 / scale, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}
export function parcelGrid(
  c: CanvasRenderingContext2D,
  parcel: Parcel,
  viewport: Bounds,
  scale: number,
) {
  const b = parcelGridRange(parcel, viewport, scale);
  if (!b) return;
  c.save();
  c.beginPath();
  c.rect(
    viewport[0],
    viewport[1],
    viewport[2] - viewport[0],
    viewport[3] - viewport[1],
  );
  c.clip();
  polygon(c, [parcel.polygon]);
  c.clip();
  c.translate(parcel.frame.x, parcel.frame.y);
  c.rotate(parcel.frame.angle);
  c.scale(5, 5);
  c.beginPath();
  for (let x = Math.ceil(b[0]); x <= b[2]; x++) {
    c.moveTo(x, b[1]);
    c.lineTo(x, b[3]);
  }
  for (let y = Math.ceil(b[1]); y <= b[3]; y++) {
    c.moveTo(b[0], y);
    c.lineTo(b[2], y);
  }
  c.strokeStyle = "#6d765b55";
  c.lineWidth = 1 / (5 * scale);
  c.stroke();
  c.restore();
}
export function interior(
  c: CanvasRenderingContext2D,
  h: House,
  d: Detail,
  scale: number,
  room: string,
  connection: string,
  lower: boolean,
  geometry: InteriorGeometry,
) {
  c.save();
  c.translate(h.transform.x, h.transform.y);
  c.rotate(h.transform.angle);
  c.scale(5, 5);
  const drawCells = (paths: CellGeometry, ghost = false) => {
    for (const [roomId, path] of paths.fills) {
      c.fillStyle = ghost ? "#c4c2ac" : roomId === room ? "#e6c76a" : "#f5f1e7";
      c.fill(path);
    }
    c.strokeStyle = ghost ? "#969282" : "#635f55";
    c.lineWidth = (ghost ? 1 : 2) / (scale * 5);
    c.stroke(paths.walls);
  };
  if (lower) {
    c.globalAlpha = 0.5;
    drawCells(geometry.ghost, true);
    c.globalAlpha = 1;
  }
  drawCells(geometry.main);
  if (scale >= 1.28) {
    c.strokeStyle = "#59675425";
    c.lineWidth = 1 / (scale * 5);
    c.stroke(geometry.main.grid);
  }
  for (const con of d.connections) {
    c.strokeStyle = con.id === connection ? "#bf563b" : "#5a4f3d";
    c.lineWidth = 3 / (scale * 5);
    if (con.type === "opening" && con.floor === d.floor) {
      const start = openingPoint(con, 0),
        dx = con.axis === "horizontal" ? 1 : 0,
        dy = 1 - dx;
      c.strokeStyle = "#f5f1e7";
      c.lineWidth = 5 / (scale * 5);
      c.beginPath();
      c.moveTo(start[0] + dx * 0.12, start[1] + dy * 0.12);
      c.lineTo(start[0] + dx * 0.88, start[1] + dy * 0.88);
      c.stroke();
      if (con.kind === "door") {
        c.strokeStyle = con.id === connection ? "#bf563b" : "#75573f";
        c.lineWidth = 3 / (scale * 5);
        c.beginPath();
        c.moveTo(start[0] + dx * 0.15, start[1] + dy * 0.15);
        c.lineTo(start[0] + dx * 0.85, start[1] + dy * 0.85);
        c.stroke();
      }
    } else if (
      con.type === "stairs" &&
      (con.floor === d.floor || con.floor + 1 === d.floor)
    ) {
      const [dx, dy] = {
        north: [0, -1],
        east: [1, 0],
        south: [0, 1],
        west: [-1, 0],
      }[con.direction];
      for (let i = 0; i < con.length; i++) {
        const x = con.x + dx * i + 0.5,
          y = con.y + dy * i + 0.5;
        c.beginPath();
        c.moveTo(x - dy * 0.4, y + dx * 0.4);
        c.lineTo(x + dy * 0.4, y - dx * 0.4);
        c.stroke();
      }
      c.beginPath();
      c.moveTo(con.x + 0.5, con.y + 0.5);
      c.lineTo(
        con.x + 0.5 + dx * (con.length - 1),
        con.y + 0.5 + dy * (con.length - 1),
      );
      c.stroke();
    }
  }
  c.restore();
}
