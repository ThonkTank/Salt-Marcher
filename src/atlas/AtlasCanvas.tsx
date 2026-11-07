import { mapLabelFont } from "./mapTypography";
import { CanvasPaintTracker, type CanvasPaintState } from "./canvasPaintState";
import { useDevicePixelRatio } from "./useDevicePixelRatio";
import { SurfacePointReader } from "./surfacePointReader";
import type { AtlasClient } from "./client";
import type { Status } from "./model";
import { ExteriorGeometryCache } from "./exteriorGeometryCache";
import { scheduleCanvasFrame } from "./canvasFrame";
import { WORLD_LIMIT, type LodDecision } from "./lod";
import { waterAt } from "./waterView";
import { paintRivers } from "./riverView";
import type { RiverNode } from "./generated/RiverNode";
import {
  paintRegions,
  regionNameCandidates,
  paintRegionNames,
} from "./regionView";
import type { RegionSummary } from "./generated/RegionSummary";
import { GroundPainter } from "./groundView";
import {
  colors,
  polygon,
  roadLine,
  shape,
  drawIssue,
  parcelGrid,
  interior,
} from "./canvasPaint";
import { TerrainPainter } from "./terrainView";
import { paintCity } from "./cityPaint";
import type { prepareCanvasScene } from "./canvasScene";
import { layoutMapLabels, paintLabels } from "./mapLabels";
import type { Guide } from "./interaction";
import type { DraftGeometry } from "./roadDraft";
import { InteriorGeometryCache } from "./interiorGeometryCache";
import { buildInteriorPaths, type InteriorGeometry } from "./interiorPaths";
import {
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  useEffect,
  useRef,
  type RefObject,
  type PointerEventHandler,
  type WheelEventHandler,
} from "react";
import {
  toWorld,
  type Bounds,
  type Parcel,
  openingPoint,
  type Camera,
  type House,
  type Preview,
  type PreviewIssue,
  type WorldPoint,
} from "./model";
import type { Presentation } from "./usePresentation";
type Props = {
  onPaintState?: (state: CanvasPaintState | null) => void;
  presentationFresh?: boolean;
  writesPending?: boolean;
  client?: AtlasClient;
  documentStatus?: Status | null;
  scene: ReturnType<typeof prepareCanvasScene>;
  selectedRiver?: string;
  riverHandles?: RiverNode[];
  riverPreview?: boolean;
  regionSummaries?: RegionSummary[];
  regionMarkerRanks?: string[];
  selectedRegion?: string;
  terrainContours?: boolean;
  brushCursor?: { point: WorldPoint; radius: number; height?: boolean } | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  camera: Camera;
  lod: LodDecision;
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
  const pointReader = useMemo(
    () => (p.client ? new SurfacePointReader(p.client) : null),
    [p.client],
  );
  const pointHeight = useSyncExternalStore(
    pointReader?.subscribe ?? (() => () => {}),
    pointReader?.getSnapshot ?? (() => null),
  );
  const heightPoint =
    p.brushCursor?.height === false ? null : p.brushCursor?.point;
  const heightVersion = p.documentStatus ?? p.presentation?.scene.status;
  useEffect(() => {
    pointReader?.update(heightVersion, heightPoint);
  }, [
    pointReader,
    heightVersion?.sessionId,
    heightVersion?.revision,
    heightPoint?.[0],
    heightPoint?.[1],
  ]);
  useEffect(() => () => pointReader?.update(null, null), [pointReader]);

  const dpr = useDevicePixelRatio();
  const paintTracker = useMemo(
    () => new CanvasPaintTracker(p.onPaintState),
    [p.onPaintState],
  );
  const paintPresentation = useMemo(() => ({}), [p.presentation, p.scene]);
  const paintCamera = useMemo(() => ({}), [p.camera, p.size, dpr]);
  useLayoutEffect(() => {
    paintTracker.context(
      p.documentStatus ?? p.presentation?.scene.status ?? null,
      paintPresentation,
      paintCamera,
      p.presentationFresh ?? true,
      p.writesPending ?? false,
    );
  });
  useLayoutEffect(() => () => paintTracker.clear(), [paintTracker]);
  const overlay = useRef<HTMLCanvasElement>(null);
  const priorLabels = useRef(new Set<string>());
  const exteriorGeometry = useRef(new ExteriorGeometryCache());
  const geometry = useRef(new InteriorGeometryCache(buildInteriorPaths));
  const terrainPainter = useRef(new TerrainPainter());
  const groundPainter = useRef(new GroundPainter());
  useLayoutEffect(() => {
    const cache = exteriorGeometry.current;
    cache.setSession(p.presentation?.scene.status.sessionId ?? null);
    cache.retain(
      (function* () {
        for (const layer of p.scene.layers) yield* layer.objects;
        if (p.scene.selectedObject) yield p.scene.selectedObject;
        if (p.preview)
          yield* p.preview.valid
            ? p.preview.objects
            : p.preview.proposedObjects;
      })(),
    );
  }, [p.scene, p.preview, p.presentation?.scene.status.sessionId]);
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
    const painted = paintTracker.request("base");
    return scheduleCanvasFrame(() => {
      if (!p.canvasRef.current) return;
      const paintStarted = performance.now();
      const paintCanvas = p.canvasRef.current;
      const paintDpr = window.devicePixelRatio || 1;
      const c = setup(paintCanvas, paintDpr);
      const scene = p.scene;
      const detail = p.presentation?.detail;
      let paths: InteriorGeometry | undefined;
      if (!detail) geometry.current.clear();
      else {
        paths = geometry.current.get(detail);
      }
      const {
        terrain,
        terrainPreview,
        ground,
        landscape,
        foundationTops,
        waters,
        regions,
      } = scene;
      if (terrain)
        terrainPainter.current.paint(
          c,
          terrain,
          p.camera.scale,
          !ground && !landscape && (p.terrainContours ?? true),
          terrainPreview,
        );
      if (ground) groundPainter.current.paint(c, ground, terrain);
      if (landscape)
        groundPainter.current.paintLandscape(
          c,
          landscape,
          terrain,
          p.camera.scale,
        );
      if ((ground || landscape) && terrain && (p.terrainContours ?? true))
        terrainPainter.current.paintContours(
          c,
          terrain,
          p.camera.scale,
          terrainPreview,
        );
      paintRegions(c, regions, p.camera.scale, true, p.selectedRegion ?? "");
      if (landscape)
        groundPainter.current.paintLandscapeSymbols(
          c,
          landscape,
          terrain,
          p.camera.scale,
        );
      const rivers = () =>
        paintRivers(
          c,
          scene.rivers,
          p.camera.scale,
          p.selectedRiver,
          p.riverPreview,
          waters,
        );
      if (p.presentation?.overview)
        paintCity(
          c,
          p.presentation.overview,
          scene.cityFeatures,
          p.camera.scale,
          p.lod.policy,
          scene.selectedRoad,
          () => {
            if (terrain)
              terrainPainter.current.paint(
                c,
                terrain,
                p.camera.scale,
                false,
                terrainPreview,
                true,
              );
            rivers();
          },
        );
      for (const { kind, objects } of scene.layers) {
        if (kind === "parcel" && terrain)
          terrainPainter.current.paint(
            c,
            terrain,
            p.camera.scale,
            false,
            terrainPreview,
            true,
          );
        if (kind === "parcel" && !p.presentation?.overview) rivers();
        for (const o of objects) {
          if (
            o.kind === "house" &&
            p.presentation?.detail?.buildingId === o.id
          ) {
            c.save();
            c.globalAlpha = 0.18;
            shape(c, o, p.camera.scale, exteriorGeometry.current);
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
          } else {
            if (o.kind === "house") {
              const outline = exteriorGeometry.current.get(o);
              c.strokeStyle =
                (waterAt(waters, [o.transform.x, o.transform.y]) ?? -Infinity) >
                (foundationTops.get(o.id) ?? Infinity)
                  ? "#72b8cf"
                  : "#8c8575";
              c.lineWidth = 4 / p.camera.scale;
              if (outline) c.stroke(outline);
            }
            c.save();
            if (o.kind === "area" && terrain && o.material !== "water")
              c.globalAlpha = 0.55;
            shape(c, o, p.camera.scale, exteriorGeometry.current);
            c.restore();
          }
        }
      }
      paintRegions(c, regions, p.camera.scale, false, p.selectedRegion ?? "");
      const viewport: Bounds = [
        -p.camera.x / p.camera.scale,
        -p.camera.y / p.camera.scale,
        (p.size.width - p.camera.x) / p.camera.scale,
        (p.size.height - p.camera.y) / p.camera.scale,
      ];
      for (const parcel of scene.grids)
        parcelGrid(c, parcel, viewport, p.camera.scale);
      const { selectedObject } = scene;
      if (selectedObject) {
        c.save();
        c.globalAlpha = 0.2;
        shape(
          c,
          selectedObject,
          p.camera.scale,
          exteriorGeometry.current,
          "#ffe397",
        );
        c.restore();
      }
      if (p.presentation) {
        c.save();
        c.setTransform(paintDpr, 0, 0, paintDpr, 0, 0);
        c.font = mapLabelFont();
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
        const regionCandidates = regionNameCandidates(
          c,
          regions,
          p.regionSummaries ?? [],
          p.camera,
          p.size.width,
          p.size.height,
          p.regionMarkerRanks,
        );
        c.font = mapLabelFont();
        const { labels, regions: regionText } = layoutMapLabels(
          scene.features,
          p.camera,
          p.lod.policy,
          p.size.width,
          p.size.height,
          p.selected,
          (text) => c.measureText(text).width,
          priorLabels.current,
          obstacles,
          regionCandidates,
        );
        priorLabels.current = new Set(labels.map((label) => label.key));
        paintLabels(c, labels);
        paintRegionNames(c, regionText);
        c.restore();
      }
      // Edge tiles extend beyond the finite authoring world. Do not present
      // their padding (or the canvas background) as paintable terrain.
      if (
        p.camera.scale * WORLD_LIMIT <
        Math.max(p.size.width, p.size.height)
      ) {
        c.save();
        c.setTransform(paintDpr, 0, 0, paintDpr, 0, 0);
        const edge = WORLD_LIMIT * p.camera.scale;
        c.beginPath();
        c.rect(0, 0, p.size.width, p.size.height);
        c.rect(p.camera.x - edge, p.camera.y - edge, edge * 2, edge * 2);
        c.fillStyle = "#242527";
        c.fill("evenodd");
        c.strokeStyle = "#65706a";
        c.lineWidth = 1;
        c.strokeRect(p.camera.x - edge, p.camera.y - edge, edge * 2, edge * 2);
        c.restore();
      }
      painted();
      performance.clearMeasures("atlas.canvas.paint");
      performance.measure("atlas.canvas.paint", {
        start: paintStarted,
        detail: {
          revision:
            p.scene.terrain?.status.revision ??
            p.presentation?.scene.status.revision,
          sessionId: p.presentation?.scene.status.sessionId,
        },
      });
    });
  }, [
    paintTracker,
    paintPresentation,
    p.documentStatus,
    p.presentationFresh,
    p.scene,
    p.lod,
    p.selectedRiver,
    p.riverPreview,
    p.regionSummaries,
    p.regionMarkerRanks,
    p.selectedRegion,
    dpr,
    p.camera,
    p.size,
    p.presentation,
    p.selected,
    p.room,
    p.connection,
    p.parcelOverlay,
    p.draft,
    p.terrainContours,
  ]);
  useLayoutEffect(() => {
    const painted = paintTracker.request("overlay");
    return scheduleCanvasFrame(() => {
      if (!overlay.current) return;
      const c = setup(overlay.current),
        scale = p.camera.scale;
      const overview = !!p.presentation?.overview;
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
            exteriorGeometry.current,
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
            (o): o is House =>
              o.kind === "house" && o.id === removed.buildingId,
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
          if (preview?.valid) {
            c.setLineDash([4 / scale, 4 / scale]);
            roadLine(c, { ...p.draft, width: 1 / scale });
          } else
            roadLine(c, {
              ...p.draft,
              width: Math.max(p.draft.width, 2 / scale),
            });
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
      if (p.parcelOverlay && !overview) {
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
        p.draft ??
        p.presentation?.scene.objects.find((o) => o.id === p.selected);
      if (selected?.kind === "road") {
        for (const n of selected.nodes) {
          for (const handle of p.automaticCurve || overview
            ? []
            : [n.incoming, n.outgoing])
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
      } else if (!overview && selected?.kind === "area") {
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
        !overview &&
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
      for (const n of p.riverHandles ?? []) {
        c.beginPath();
        c.arc(...n.point, 5 / scale, 0, Math.PI * 2);
        c.fillStyle = "#fff1cc";
        c.fill();
        c.strokeStyle = "#675d48";
        c.lineWidth = 1 / scale;
        c.stroke();
      }
      if (p.brushCursor) {
        const { point, radius } = p.brushCursor;
        c.beginPath();
        c.arc(point[0], point[1], radius, 0, Math.PI * 2);
        c.strokeStyle = "#fff5cf";
        c.lineWidth = 2 / scale;
        c.stroke();
        const heightKey =
          heightVersion && heightPoint
            ? JSON.stringify([
                heightVersion.sessionId,
                heightVersion.revision,
                heightPoint,
              ])
            : "";
        const z = pointHeight?.key === heightKey ? pointHeight.height : null;
        if (z !== null) {
          c.save();
          c.translate(point[0] + radius + 8 / scale, point[1]);
          c.scale(1 / scale, 1 / scale);
          c.font = "13px system-ui";
          c.lineWidth = 3;
          c.strokeStyle = "#30382e";
          c.fillStyle = "#fff5cf";
          const label = `${z.toFixed(1)} Fuß`;
          c.strokeText(label, 0, 0);
          c.fillText(label, 0, 0);
          c.restore();
        }
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
      painted();
    });
  }, [
    paintTracker,
    paintPresentation,
    p.documentStatus,
    p.presentationFresh,
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
    p.riverHandles,
    p.brushCursor,
    pointHeight,
    heightVersion,
  ]);
  return (
    <>
      <canvas
        ref={p.canvasRef}
        data-testid="atlas-canvas"
        tabIndex={0}
        aria-label="Atlaskarte"
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
