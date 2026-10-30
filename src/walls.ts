import { Cell, Level, key, xy } from "./model";
export type Wall = { x: number; y: number; horizontal: boolean };
export function walls(
  cells: Level["cells"],
  visible = Object.keys(cells) as Cell[],
): Wall[] {
  const result: Wall[] = [];
  for (const c of visible) {
    const [x, y] = xy(c),
      id = cells[c];
    if (!id) continue;
    if (cells[key(x, y - 1)] !== id) result.push({ x, y, horizontal: true });
    if (cells[key(x - 1, y)] !== id) result.push({ x, y, horizontal: false });
    if (!cells[key(x, y + 1)]) result.push({ x, y: y + 1, horizontal: true });
    if (!cells[key(x + 1, y)]) result.push({ x: x + 1, y, horizontal: false });
  }
  return result;
}
