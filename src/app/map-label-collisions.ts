export interface MapLabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Numeric screen cells avoid allocating key strings and closures per trial
 * placement. Rectangles must already be clipped to the nonnegative viewport. */
export class MapLabelCollisions {
  private cells = new Map<number, MapLabelRect[]>();
  private columns: number;
  constructor(width: number) {
    this.columns = Math.ceil(width / 64) + 1;
  }
  overlaps(r: MapLabelRect) {
    const right = r.x + r.w,
      bottom = r.y + r.h;
    for (let y = Math.floor(r.y / 64); y <= Math.floor(bottom / 64); y++)
      for (let x = Math.floor(r.x / 64); x <= Math.floor(right / 64); x++) {
        const cell = this.cells.get(y * this.columns + x);
        if (!cell) continue;
        for (const b of cell)
          if (r.x < b.x + b.w && right > b.x && r.y < b.y + b.h && bottom > b.y) return true;
      }
    return false;
  }
  add(r: MapLabelRect) {
    for (let y = Math.floor(r.y / 64); y <= Math.floor((r.y + r.h) / 64); y++)
      for (let x = Math.floor(r.x / 64); x <= Math.floor((r.x + r.w) / 64); x++) {
        const key = y * this.columns + x,
          cell = this.cells.get(key);
        if (cell) cell.push(r);
        else this.cells.set(key, [r]);
      }
  }
}
