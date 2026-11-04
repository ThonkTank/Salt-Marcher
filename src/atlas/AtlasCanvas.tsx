import { paintCity } from "./cityPaint";
import { sceneFeatures, overviewFeatures } from "./cityView";
import { layoutLabels, paintLabels } from "./mapLabels";
import type { Guide } from "./interaction";
import type { DraftGeometry, RoadOverlayGeometry } from "./roadDraft";
import { InteriorGeometryCache } from "./interiorGeometryCache";
import {
  buildInteriorPaths,
  type CellGeometry,
  type InteriorGeometry,
} from "./interiorPaths";
import {
  useLayoutEffect,
  useEffect,
  useState,
  useRef,
  type RefObject,
  type PointerEventHandler,
  type WheelEventHandler,
} from "react";
import {
  toWorld,
  toLocal,
  type Bounds,
  type Parcel,
  openingPoint,
  type Camera,
  type Detail,
  type House,
  type MapObject,
  type Preview,
  type PreviewIssue,
  type WorldPoint,
} from "./model";
import { polygonBounds } from "./parcelEditor";
import type { Presentation } from "./usePresentation";
export const colors: Record<string, string> = {
  grass: "#9db58b",
  earth: "#c8b99b",
  stone: "#aaa9a3",
  water: "#91bcc5",
};
function polygon(c: CanvasRenderingContext2D, rings: WorldPoint[][]) {
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
function shape(
  c: CanvasRenderingContext2D,
  o: MapObject,
  scale: number,
  highlight?: string,
) {
  const finitePoint = (p: readonly number[]) =>
    p.length === 2 && p.every(Number.isFinite);
  // Invalid-preview payloads must never feed unsafe coordinates into canvas.
  if (
    o.kind === "road" &&
    (!Number.isFinite(o.width) || !o.path.every(finitePoint))
  )
    return;
  if (o.kind === "area" && !o.points.every(finitePoint)) return;
  if (o.kind === "parcel" && !o.polygon.every(finitePoint)) return;
  if (
    o.kind === "house" &&
    (![o.transform.x, o.transform.y, o.transform.angle].every(
      Number.isFinite,
    ) ||
      !o.contours.every((r) => r.every(finitePoint)))
  )
    return;
  c.save();
  if (o.kind === "road") {
    c.strokeStyle = highlight ?? colors[o.material];
    c.lineWidth = o.width;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.beginPath();
    o.path.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.stroke();
  } else if (o.kind === "area") {
    polygon(c, [o.points]);
    c.fillStyle = highlight ?? colors[o.material];
    c.fill();
  } else if (o.kind === "parcel") {
    polygon(c, [o.polygon]);
    c.strokeStyle = highlight ?? "#857950";
    c.lineWidth = 1 / scale;
    c.stroke();
  } else {
    polygon(
      c,
      o.contours.map((r) => r.map((p) => toWorld(p, o.transform))),
    );
    c.fillStyle = highlight ?? o.roof;
    c.fill("evenodd");
    c.strokeStyle = "#514c43";
    c.lineWidth = 1 / scale;
    c.stroke();
  }
  c.restore();
}
function drawIssue(
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
// Bounds restrict generation before clipping; low zoom never builds huge grids.
export function parcelGridRange(
  parcel: Parcel,
  viewport: Bounds,
  scale: number,
): Bounds | null {
  if (5 * scale < 4) return null;
  const localParcel = polygonBounds(
    parcel.polygon.map((p) => toLocal(p, parcel.frame)),
  );
  const localView = polygonBounds(
    (
      [
        [viewport[0], viewport[1]],
        [viewport[2], viewport[1]],
        [viewport[2], viewport[3]],
        [viewport[0], viewport[3]],
      ] as WorldPoint[]
    ).map((p) => toLocal(p, parcel.frame)),
  );
  if (!localParcel || !localView) return null;
  const range: Bounds = [
    Math.max(localParcel[0], localView[0]),
    Math.max(localParcel[1], localView[1]),
    Math.min(localParcel[2], localView[2]),
    Math.min(localParcel[3], localView[3]),
  ];
  return range[0] <= range[2] && range[1] <= range[3] ? range : null;
}
function parcelGrid(
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
function interior(
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
type Props = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  camera: Camera;
  size: { width: number; height: number };
  presentation: Presentation | null;
  selected: string;
  room: string;
  connection: string;
  preview: (Preview & { actionId?: number }) | null;
  draft: DraftGeometry | null;
  issue?: PreviewIssue;
  automaticCurve?: boolean;
  parcelOverlay?: {
    parcel: Parcel;
    handles: { kind: string; point: WorldPoint }[];
  } | null;
  guide: Guide | null;
  visibility: { boundaries: string[]; grids: string[] };
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerLeave?: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
  onPointerCancel: PointerEventHandler<HTMLCanvasElement>;
  onLostPointerCapture: PointerEventHandler<HTMLCanvasElement>;
  onWheel: WheelEventHandler<HTMLCanvasElement>;
  onDoubleClick: React.MouseEventHandler<HTMLCanvasElement>;
  onContextMenu?: React.MouseEventHandler<HTMLCanvasElement>;
};
export function AtlasCanvas(p: Props) {
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1);
  useEffect(() => {
    const changed = () => setDpr(window.devicePixelRatio || 1);
    const query = window.matchMedia(`(resolution: ${dpr}dppx)`);
    query.addEventListener("change", changed);
    window.addEventListener("resize", changed);
    return () => {
      query.removeEventListener("change", changed);
      window.removeEventListener("resize", changed);
    };
  }, [dpr]);
  const visibilityKey = JSON.stringify(p.visibility);
  const overlay = useRef<HTMLCanvasElement>(null);
  const priorLabels = useRef(new Set<string>());
  const geometry = useRef(new InteriorGeometryCache(buildInteriorPaths));
  const setup = (
    canvas: HTMLCanvasElement,
    dpr = window.devicePixelRatio || 1,
  ) => {
    const w = Math.round(p.size.width * dpr),
      h = Math.round(p.size.height * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const c = canvas.getContext("2d")!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    c.setTransform(
      dpr * p.camera.scale,
      0,
      0,
      dpr * p.camera.scale,
      dpr * p.camera.x,
      dpr * p.camera.y,
    );
    return c;
  };
  useLayoutEffect(() => {
    if (!p.canvasRef.current) return;
    const paintCanvas = p.canvasRef.current;
    const paintDpr = window.devicePixelRatio || 1;
    const c = setup(paintCanvas, paintDpr),
      objects = p.presentation?.scene.objects ?? [];
    const detail = p.presentation?.detail;
    let paths: InteriorGeometry | undefined;
    if (!detail) geometry.current.clear();
    else {
      paths = geometry.current.get(detail);
    }
    if (p.presentation?.overview)
      paintCity(c, p.presentation.overview, p.camera.scale);
    for (const kind of p.presentation?.overview
      ? []
      : ["area", "parcel", "road", "house"])
      for (const o of objects
        .filter(
          (o) =>
            o.kind === kind &&
            (o.kind !== "parcel" || p.visibility.boundaries.includes(o.id)),
        )
        .sort((a, b) =>
          a.kind === "area" && b.kind === "area"
            ? (a.order ?? 0) - (b.order ?? 0)
            : 0,
        )) {
        if (o.kind === "house" && p.presentation?.detail?.buildingId === o.id) {
          c.save();
          c.globalAlpha = 0.18;
          shape(c, o, p.camera.scale);
          c.restore();
          interior(
            c,
            o,
            p.presentation.detail,
            p.camera.scale,
            p.room,
            p.connection,
            p.presentation.includeLower,
            paths!,
          );
        } else shape(c, o, p.camera.scale);
      }
    const viewport: Bounds = [
      -p.camera.x / p.camera.scale,
      -p.camera.y / p.camera.scale,
      (p.size.width - p.camera.x) / p.camera.scale,
      (p.size.height - p.camera.y) / p.camera.scale,
    ];
    for (const o of objects)
      if (o.kind === "parcel" && p.visibility.grids.includes(o.id))
        parcelGrid(c, o, viewport, p.camera.scale);
    const selectedObject = objects.find((o) => o.id === p.selected);
    if (
      selectedObject &&
      (selectedObject.kind !== "parcel" ||
        p.visibility.boundaries.includes(selectedObject.id))
    ) {
      c.save();
      c.globalAlpha = 0.2;
      shape(c, selectedObject, p.camera.scale, "#ffe397");
      c.restore();
    }
    if (p.presentation) {
      const features = p.presentation.overview
        ? [
            ...overviewFeatures(p.presentation.overview).filter(
              (f) => f.id !== p.selected,
            ),
            ...sceneFeatures(p.presentation.scene).filter(
              (f) => f.id === p.selected,
            ),
          ]
        : sceneFeatures(p.presentation.scene);
      c.save();
      c.setTransform(paintDpr, 0, 0, paintDpr, 0, 0);
      c.font = "13px system-ui, sans-serif";
      const excluded = p.presentation.detail?.buildingId;
      const grips = [...(p.parcelOverlay?.handles.map((h) => h.point) ?? [])];
      const selected =
        p.draft ??
        p.presentation.scene.objects.find((o) => o.id === p.selected);
      if (selected?.kind === "road")
        for (const node of selected.nodes) {
          grips.push(node.point);
          if (node.incoming) grips.push(node.incoming);
          if (node.outgoing) grips.push(node.outgoing);
        }
      const obstacles: Bounds[] = grips.map(([x, y]) => {
        const sx = p.camera.x + x * p.camera.scale,
          sy = p.camera.y + y * p.camera.scale;
        return [sx - 12, sy - 12, sx + 12, sy + 12];
      });
      const labels = layoutLabels(
        features.filter((f) => f.id !== excluded),
        p.camera,
        p.size.width,
        p.size.height,
        p.selected,
        (text) => c.measureText(text).width,
        priorLabels.current,
        obstacles,
      );
      priorLabels.current = new Set(labels.map((label) => label.key));
      paintLabels(c, labels);
      c.restore();
    }
  }, [
    dpr,
    p.camera,
    p.size,
    p.presentation,
    p.selected,
    p.room,
    p.connection,
    visibilityKey,
    p.parcelOverlay,
    p.draft,
  ]);
  useLayoutEffect(() => {
    if (!overlay.current) return;
    const c = setup(overlay.current),
      scale = p.camera.scale;
    if (p.presentation?.overview) return;
    const preview = p.preview;
    if (preview) {
      c.save();
      c.globalAlpha = 0.8;
      for (const o of preview.valid
        ? preview.objects
        : preview.proposedObjects) {
        c.setLineDash(o.kind === "parcel" ? [6 / scale, 3 / scale] : []);
        shape(
          c,
          o,
          scale,
          preview.valid
            ? o.kind === "parcel"
              ? "#294e43"
              : undefined
            : "#df765f",
        );
      }
      c.restore();
      if (!preview.valid)
        for (const issue of preview.issues) drawIssue(c, issue, scale);
      for (const removed of preview.removedConnections ?? []) {
        const h = p.presentation?.scene.objects.find(
          (o): o is House => o.kind === "house" && o.id === removed.buildingId,
        );
        if (!h) continue;
        const con = removed.connection;
        c.save();
        c.translate(h.transform.x, h.transform.y);
        c.rotate(h.transform.angle);
        c.scale(5, 5);
        c.strokeStyle = "#d13b2d";
        c.lineWidth = 5 / (scale * 5);
        c.beginPath();
        if (con.type === "opening") {
          const start = openingPoint(con, 0),
            end = openingPoint(con, 1);
          c.moveTo(start[0], start[1]);
          c.lineTo(end[0], end[1]);
        } else {
          const [dx, dy] = {
            north: [0, -1],
            east: [1, 0],
            south: [0, 1],
            west: [-1, 0],
          }[con.direction];
          c.moveTo(con.x + 0.5, con.y + 0.5);
          c.lineTo(
            con.x + 0.5 + dx * (con.length - 1),
            con.y + 0.5 + dy * (con.length - 1),
          );
        }
        c.stroke();
        c.restore();
      }
      for (const skip of preview.generationDiagnostics) {
        c.strokeStyle = skip.target === "house" ? "#b58232" : "#a34838";
        c.lineWidth = 2 / scale;
        c.beginPath();
        c.moveTo(skip.point[0] - 4 / scale, skip.point[1] - 4 / scale);
        c.lineTo(skip.point[0] + 4 / scale, skip.point[1] + 4 / scale);
        c.moveTo(skip.point[0] + 4 / scale, skip.point[1] - 4 / scale);
        c.lineTo(skip.point[0] - 4 / scale, skip.point[1] + 4 / scale);
        c.stroke();
      }
    }
    if (p.issue) drawIssue(c, p.issue, scale);
    if (p.draft) {
      c.save();
      c.globalAlpha = 0.65;
      if (p.draft.kind === "road") {
        c.strokeStyle =
          preview?.valid === false || p.issue
            ? "#df765f"
            : colors[p.draft.material];
        roadLine(c, p.draft);
      } else {
        polygon(c, [p.draft.points]);
        c.fillStyle = colors[p.draft.material];
        c.fill();
        c.strokeStyle = "#f0e0b2";
        c.lineWidth = 1 / scale;
        c.stroke();
      }
      c.restore();
    }
    if (p.parcelOverlay) {
      const { parcel, handles } = p.parcelOverlay;
      parcelGrid(
        c,
        parcel,
        [
          -p.camera.x / scale,
          -p.camera.y / scale,
          (p.size.width - p.camera.x) / scale,
          (p.size.height - p.camera.y) / scale,
        ],
        scale,
      );
      polygon(c, [parcel.polygon]);
      c.strokeStyle = "#ffe099";
      c.lineWidth = 2 / scale;
      c.stroke();
      for (const handle of handles) {
        c.fillStyle = "#ffe099";
        c.strokeStyle = "#3d3527";
        c.fillRect(
          handle.point[0] - 5 / scale,
          handle.point[1] - 5 / scale,
          10 / scale,
          10 / scale,
        );
        c.strokeRect(
          handle.point[0] - 5 / scale,
          handle.point[1] - 5 / scale,
          10 / scale,
          10 / scale,
        );
      }
    }
    const selected =
      p.draft ?? p.presentation?.scene.objects.find((o) => o.id === p.selected);
    if (selected?.kind === "road") {
      for (const n of selected.nodes) {
        for (const handle of p.automaticCurve ? [] : [n.incoming, n.outgoing])
          if (handle) {
            c.strokeStyle = "#e8d6a1";
            c.lineWidth = 1 / scale;
            c.beginPath();
            c.moveTo(n.point[0], n.point[1]);
            c.lineTo(handle[0], handle[1]);
            c.stroke();
            c.fillStyle = "#f1d28d";
            c.fillRect(
              handle[0] - 3 / scale,
              handle[1] - 3 / scale,
              6 / scale,
              6 / scale,
            );
          }
        c.fillStyle = "#fff1cc";
        c.strokeStyle = "#675d48";
        c.lineWidth = 1 / scale;
        c.beginPath();
        c.arc(n.point[0], n.point[1], 5 / scale, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      if (!p.draft && "id" in selected) {
        for (const end of [0, selected.nodes.length - 1]) {
          const n = selected.nodes[end],
            other = selected.nodes[end === 0 ? 1 : end - 1];
          const dx = n.point[0] - other.point[0],
            dy = n.point[1] - other.point[1],
            norm = Math.hypot(dx, dy) || 1;
          const x = n.point[0] + ((dx / norm) * 22) / scale,
            y = n.point[1] + ((dy / norm) * 22) / scale;
          c.fillStyle = "#fff1cc";
          c.beginPath();
          c.arc(x, y, 7 / scale, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = "#675d48";
          c.lineWidth = 1.5 / scale;
          c.beginPath();
          c.moveTo(x - 4 / scale, y);
          c.lineTo(x + 4 / scale, y);
          c.moveTo(x, y - 4 / scale);
          c.lineTo(x, y + 4 / scale);
          c.stroke();
        }
      }
    } else if (selected?.kind === "area") {
      for (const point of selected.points) {
        c.fillStyle = "#fff1cc";
        c.fillRect(
          point[0] - 4 / scale,
          point[1] - 4 / scale,
          8 / scale,
          8 / scale,
        );
      }
    } else if (
      selected?.kind === "house" &&
      p.presentation?.context.kind === "exterior" &&
      selected.placement.kind === "free"
    ) {
      const a = toWorld([0, 0], selected.transform),
        b = toWorld([0, -3], selected.transform);
      c.strokeStyle = "#f1d28d";
      c.lineWidth = 1 / scale;
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.stroke();
      c.fillStyle = "#f1d28d";
      c.beginPath();
      c.arc(b[0], b[1], 6 / scale, 0, Math.PI * 2);
      c.fill();
    }
    if (p.guide) {
      c.strokeStyle = p.guide.invalid ? "#e56754" : "#f5cf79";
      c.fillStyle = "#f5cf7930";
      c.lineWidth = 2 / scale;
      c.setLineDash([6 / scale, 4 / scale]);
      c.beginPath();
      p.guide.points.forEach((v, i) =>
        i ? c.lineTo(v[0], v[1]) : c.moveTo(v[0], v[1]),
      );
      if (p.guide.closed) {
        c.closePath();
        c.fill();
      }
      c.stroke();
      c.setLineDash([]);
    }
  }, [
    dpr,
    p.camera,
    p.size,
    p.presentation,
    p.selected,
    p.preview,
    p.parcelOverlay,
    p.automaticCurve,
    p.issue,
    p.draft,
    p.guide,
  ]);
  return (
    <>
      <canvas
        ref={p.canvasRef}
        data-testid="atlas-canvas"
        tabIndex={0}
        aria-label="Dorfkarte"
        onPointerDown={p.onPointerDown}
        onPointerMove={p.onPointerMove}
        onPointerLeave={p.onPointerLeave}
        onPointerUp={p.onPointerUp}
        onPointerCancel={p.onPointerCancel}
        onLostPointerCapture={p.onLostPointerCapture}
        onWheel={p.onWheel}
        onDoubleClick={p.onDoubleClick}
        onContextMenu={(event) => event.preventDefault()}
      />
      <canvas
        ref={overlay}
        data-testid="atlas-overlay"
        className="atlas-overlay"
        aria-hidden="true"
      />
    </>
  );
}
