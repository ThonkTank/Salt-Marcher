import { useEffect, useRef, useState } from "react";
import {
  Atlas,
  Cell,
  Level,
  draw,
  erase,
  key,
  line,
  rectangle,
  xy,
} from "./model";
import { Tool, View, isTextInput } from "./editor";
import { walls } from "./walls";
type Props = {
  document: Atlas;
  level: Level;
  below?: Level;
  tool: Tool;
  selection: Cell[];
  view: View;
  gestureVersion: number;
  focus: { serial: number; selection: boolean };
  onView: (view: View) => void;
  onCommit: (a: Atlas) => void;
  onSelect: (cells: Cell[]) => void;
  onError: (s: string) => void;
};
type Preview = { cells: Cell[]; candidate?: Atlas; error?: string };
type Gesture =
  | { kind: "pan"; x: number; y: number; view: View }
  | { kind: "build"; start: Cell; last: Cell; cells: Cell[]; result?: Preview };
export default function MapCanvas(p: Props) {
  const ref = useRef<HTMLCanvasElement>(null),
    gesture = useRef<Gesture | null>(null),
    space = useRef(false);
  const [preview, setPreview] = useState<Preview>({ cells: [] });
  const [size, setSize] = useState({ width: 800, height: 600 });
  const { view, level, tool, selection } = p,
    scale = 32 * view.zoom;
  function reset() {
    gesture.current = null;
    setPreview({ cells: [] });
  }
  useEffect(reset, [p.gestureVersion]);
  useEffect(() => {
    const observer = new ResizeObserver(([e]) =>
      setSize({ width: e.contentRect.width, height: e.contentRect.height }),
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTextInput(e.target)) return;
      if (e.code === "Space") {
        space.current = true;
        e.preventDefault();
      }
      if (e.key === "Escape") reset();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") space.current = false;
    };
    const blur = () => {
      space.current = false;
      reset();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useEffect(() => {
    if (!p.focus.serial || gesture.current) return;
    const chosen =
      p.focus.selection && selection.length
        ? selection
        : (Object.keys(level.cells) as Cell[]);
    if (!chosen.length) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const c of chosen) {
      const [x, y] = xy(c);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + 1);
      maxY = Math.max(maxY, y + 1);
    }
    const zoom = Math.max(
      0.2,
      Math.min(
        4,
        (size.width - 100) / ((maxX - minX) * 32),
        (size.height - 100) / ((maxY - minY) * 32),
      ),
    );
    p.onView({
      zoom,
      x: size.width / 2 - (minX + maxX) * 16 * zoom,
      y: size.height / 2 - (minY + maxY) * 16 * zoom,
    });
  }, [p.focus.serial]);
  useEffect(() => {
    const canvas = ref.current!,
      ctx = canvas.getContext("2d")!,
      dpr = devicePixelRatio || 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#deddd3";
    ctx.fillRect(0, 0, size.width, size.height);
    const minX = Math.floor(-view.x / scale) - 1,
      maxX = Math.ceil((size.width - view.x) / scale) + 1,
      minY = Math.floor(-view.y / scale) - 1,
      maxY = Math.ceil((size.height - view.y) / scale) + 1;
    const visible = (c: Cell) => {
      const [x, y] = xy(c);
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    };
    const fill = (c: Cell) => {
      const [x, y] = xy(c);
      ctx.fillRect(view.x + x * scale, view.y + y * scale, scale, scale);
    };
    if (p.below) {
      ctx.fillStyle = "#97aa9677";
      for (const c of Object.keys(p.below.cells) as Cell[])
        if (visible(c)) fill(c);
    }
    const shown =
      preview.candidate?.levels.find((l) => l.id === level.id) ?? level;
    const visibleCells = (Object.keys(shown.cells) as Cell[]).filter(visible);
    ctx.fillStyle = "#f8f5e9";
    for (const c of visibleCells) fill(c);
    ctx.strokeStyle = "rgba(77,83,65,.14)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let x = minX; x <= maxX; x++) {
      ctx.moveTo(view.x + x * scale, 0);
      ctx.lineTo(view.x + x * scale, size.height);
    }
    for (let y = minY; y <= maxY; y++) {
      ctx.moveTo(0, view.y + y * scale);
      ctx.lineTo(size.width, view.y + y * scale);
    }
    ctx.stroke();
    ctx.strokeStyle = "#343e35";
    ctx.lineWidth = Math.max(1.5, 2.5 * view.zoom);
    ctx.beginPath();
    for (const w of walls(shown.cells, visibleCells)) {
      ctx.moveTo(view.x + w.x * scale, view.y + w.y * scale);
      ctx.lineTo(
        view.x + (w.x + (w.horizontal ? 1 : 0)) * scale,
        view.y + (w.y + (w.horizontal ? 0 : 1)) * scale,
      );
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(64,130,115,.27)";
    for (const c of selection) if (visible(c)) fill(c);
    ctx.fillStyle =
      preview.error || tool === "erase"
        ? "rgba(173,71,57,.4)"
        : "rgba(68,126,108,.34)";
    for (const c of preview.cells) if (visible(c)) fill(c);
    if (view.zoom >= 0.55) {
      ctx.font = `600 ${Math.max(9, 11 * view.zoom)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#526353";
      const labeled = new Set<string>();
      const numbers = new Map(shown.rooms.map((r, i) => [r.id, i + 1]));
      for (const c of visibleCells) {
        const id = shown.cells[c];
        if (labeled.has(id)) continue;
        labeled.add(id);
        const [x, y] = xy(c);
        ctx.fillText(
          String(numbers.get(id)),
          view.x + (x + 0.5) * scale,
          view.y + (y + 0.5) * scale,
        );
      }
    }
  }, [level, p.below, view, preview, selection, size, tool]);
  function position(e: { clientX: number; clientY: number }) {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function cell(e: { clientX: number; clientY: number }): Cell {
    const q = position(e);
    return key(
      Math.floor((q.x - view.x) / scale),
      Math.floor((q.y - view.y) / scale),
    );
  }
  function update(c: Cell): Preview | undefined {
    const g = gesture.current;
    if (g?.kind !== "build") return;
    if (g.last === c && g.result) return g.result;
    try {
      const cells =
        tool === "erase"
          ? [...new Set([...g.cells, ...line(g.last, c)])]
          : rectangle(g.start, c);
      if (cells.length > 100000)
        throw Error("Maximal 100.000 Zellen pro Aktion.");
      g.last = c;
      g.cells = cells;
      if (
        tool === "erase" &&
        g.result &&
        !g.result.error &&
        cells.length === g.result.cells.length
      )
        return g.result;
      const candidate =
        tool === "draw"
          ? draw(p.document, level.id, cells)
          : tool === "erase"
            ? erase(p.document, level.id, cells)
            : undefined;
      const result = { cells, candidate };
      g.result = result;
      setPreview(result);
      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      g.last = c;
      g.result = { cells: [], error };
      setPreview(g.result);
      return g.result;
    }
  }
  return (
    <>
      <canvas
        ref={ref}
        aria-label="Dungeon-Zeichenfläche"
        data-testid="map-canvas"
        className={`map-canvas tool-${tool}`}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (gesture.current || (e.button !== 0 && e.button !== 1)) return;
          e.currentTarget.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          const q = position(e);
          if (e.button === 1 || space.current || tool === "pan")
            gesture.current = { kind: "pan", ...q, view };
          else {
            const c = cell(e);
            gesture.current = { kind: "build", start: c, last: c, cells: [] };
            update(c);
          }
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (g?.kind === "pan") {
            const q = position(e);
            p.onView({
              ...g.view,
              x: g.view.x + q.x - g.x,
              y: g.view.y + q.y - g.y,
            });
          } else update(cell(e));
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (g?.kind === "build") {
            const result = update(cell(e));
            if (result?.error) p.onError(result.error);
            else if (result?.candidate) p.onCommit(result.candidate);
            else if (tool === "select") {
              const id = level.cells[g.start];
              p.onSelect(
                g.start === g.last && id
                  ? (Object.keys(level.cells) as Cell[]).filter(
                      (c) => level.cells[c] === id,
                    )
                  : g.cells.filter((c) => level.cells[c]),
              );
            }
          }
          reset();
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={reset}
        tabIndex={0}
        onWheel={(e) => {
          if (gesture.current) return;
          const q = position(e),
            zoom = Math.max(
              0.2,
              Math.min(4, view.zoom * Math.exp(-e.deltaY * 0.0015)),
            ),
            ratio = zoom / view.zoom;
          p.onView({
            zoom,
            x: q.x - (q.x - view.x) * ratio,
            y: q.y - (q.y - view.y) * ratio,
          });
        }}
      />
      {(preview.cells.length > 0 || preview.error) && (
        <div
          role="status"
          className={`drawing-preview ${preview.error ? "invalid" : ""}`}
        >
          {preview.error ?? `${preview.cells.length} Rasterzellen`}
        </div>
      )}
    </>
  );
}
