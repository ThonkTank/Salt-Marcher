import type { Detail } from "./model";

// Local cell units only: no DOM, paths, camera, transforms or presentation state.
// Every buffer contains groups of four numbers (rect x/y/width/height or segment x/y/X/Y).
export type CellPreparation = {
  readonly fills: ReadonlyArray<{
    readonly room: string;
    readonly rectangles: Float64Array;
  }>;
  readonly walls: Float64Array;
  readonly grid: Float64Array;
};
export type InteriorPreparation = {
  readonly main: CellPreparation;
  readonly ghost: CellPreparation;
};
export function prepareCells(
  items: Detail["cells"],
  bounds: Detail["bounds"],
): CellPreparation {
  const index = new Map(items.map((cell) => [`${cell.x},${cell.y}`, cell]));
  const fills = new Map<string, number[]>();
  const walls: number[] = [],
    grid: number[] = [];
  const rows = new Map<string, { room: string; y: number; xs: number[] }>();
  const horizontal = new Map<number, Set<number>>(),
    vertical = new Map<number, Set<number>>();
  const add = (map: Map<number, Set<number>>, key: number, value: number) => {
    let values = map.get(key);
    if (!values) {
      values = new Set();
      map.set(key, values);
    }
    values.add(value);
  };
  for (const cell of items) {
    if (
      cell.x < bounds[0] ||
      cell.y < bounds[1] ||
      cell.x > bounds[2] ||
      cell.y > bounds[3]
    )
      continue;
    const rowKey = JSON.stringify([cell.roomId, cell.y]);
    let row = rows.get(rowKey);
    if (!row) {
      row = { room: cell.roomId, y: cell.y, xs: [] };
      rows.set(rowKey, row);
    }
    row.xs.push(cell.x);
    add(horizontal, cell.y, cell.x);
    add(horizontal, cell.y + 1, cell.x);
    add(vertical, cell.x, cell.y);
    add(vertical, cell.x + 1, cell.y);
    for (const [dx, dy, ax, ay, bx, by] of [
      [-1, 0, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 1],
      [0, -1, 0, 0, 1, 0],
      [0, 1, 0, 1, 1, 1],
    ]) {
      if (index.get(`${cell.x + dx},${cell.y + dy}`)?.roomId !== cell.roomId) {
        walls.push(cell.x + ax, cell.y + ay, cell.x + bx, cell.y + by);
      }
    }
  }
  const runs = (
    values: number[],
    draw: (start: number, end: number) => void,
  ) => {
    values.sort((a, b) => a - b);
    let start = values[0],
      end = start + 1;
    for (const value of values.slice(1)) {
      if (value <= end) end = Math.max(end, value + 1);
      else {
        draw(start, end);
        start = value;
        end = value + 1;
      }
    }
    if (values.length) draw(start, end);
  };
  for (const row of rows.values()) {
    let fill = fills.get(row.room);
    if (!fill) {
      fill = [];
      fills.set(row.room, fill);
    }
    const path = fill;
    runs(row.xs, (start, end) => path.push(start, row.y, end - start, 1));
  }
  for (const [y, xs] of horizontal)
    runs([...xs], (start, end) => {
      grid.push(start, y, end, y);
    });
  for (const [x, ys] of vertical)
    runs([...ys], (start, end) => {
      grid.push(x, start, x, end);
    });
  return {
    fills: [...fills].map(([room, rectangles]) => ({
      room,
      rectangles: new Float64Array(rectangles),
    })),
    walls: new Float64Array(walls),
    grid: new Float64Array(grid),
  };
}

export function prepareInterior(
  detail: Pick<Detail, "cells" | "lower" | "bounds">,
): InteriorPreparation {
  return {
    main: prepareCells(detail.cells, detail.bounds),
    ghost: prepareCells(detail.lower, detail.bounds),
  };
}
