export type Cell = `${number},${number}`;
export type Room = { id: string; name: string };
export type Level = {
  id: string;
  name: string;
  rooms: Room[];
  cells: Record<Cell, string>;
};
export type Atlas = { version: 3; gridFeet: 5; levels: Level[] };
export const key = (x: number, y: number): Cell => `${x},${y}`;
export const xy = (c: string) => c.split(",").map(Number) as [number, number];
export const compare = (a: Cell, b: Cell) => {
  const [ax, ay] = xy(a),
    [bx, by] = xy(b);
  return ay - by || ax - bx;
};
export const emptyAtlas = (): Atlas => ({
  version: 3,
  gridFeet: 5,
  levels: [
    { id: crypto.randomUUID(), name: "Erdgeschoss", rooms: [], cells: {} },
  ],
});
const nameOf = (name: string) => {
  const n = name.trim();
  if (!n || [...n].length > 120)
    throw Error("Namen benötigen 1 bis 120 Zeichen.");
  return n;
};
// One scan per operation, including operations which create many split rooms.
function availableNames(items: { name: string }[], prefix: string) {
  const used = new Set(items.map((item) => item.name));
  let n = 1;
  return () => {
    while (used.has(`${prefix} ${n}`)) n++;
    const name = `${prefix} ${n++}`;
    used.add(name);
    return name;
  };
}
function room(name: string): Room {
  return { id: crypto.randomUUID(), name: nameOf(name) };
}
export function getLevel(a: Atlas, id: string): Level {
  const l = a.levels.find((l) => l.id === id);
  if (!l) throw Error("Geschoss nicht gefunden.");
  return l;
}
function replace(a: Atlas, level: Level): Atlas {
  const old = getLevel(a, level.id);
  if (old === level) return a;
  return { ...a, levels: a.levels.map((l) => (l.id === level.id ? level : l)) };
}
function finish(
  a: Atlas,
  l: Level,
  cells: Level["cells"],
  rooms = l.rooms,
): Atlas {
  const used = new Set(Object.values(cells));
  const remaining = rooms.filter((r) => used.has(r.id));
  if (
    a.levels.reduce(
      (n, item) =>
        n + (item.id === l.id ? remaining.length : item.rooms.length),
      0,
    ) > 100000 ||
    a.levels.reduce(
      (n, item) =>
        n + Object.keys(item.id === l.id ? cells : item.cells).length,
      0,
    ) > 1000000
  )
    throw Error("Die Karte ist zu groß (maximal 1.000.000 Zellen).");
  return replace(a, {
    ...l,
    cells,
    rooms: remaining.length === rooms.length ? rooms : remaining,
  });
}
export function draw(a: Atlas, levelId: string, chosen: Cell[]): Atlas {
  checkCells(chosen);
  if (!chosen.length) return a;
  const l = getLevel(a, levelId),
    touched = new Set(chosen.map((c) => l.cells[c]).filter(Boolean));
  const oldest = l.rooms.find((r) => touched.has(r.id));
  if (
    oldest &&
    touched.size === 1 &&
    chosen.every((c) => l.cells[c] === oldest.id)
  )
    return a;
  const r = oldest ?? room(availableNames(l.rooms, "Raum")()),
    cells = { ...l.cells };
  if (touched.size > 1)
    for (const c of Object.keys(cells) as Cell[])
      if (touched.has(cells[c])) cells[c] = r.id;
  for (const c of chosen) cells[c] = r.id;
  return finish(a, l, cells, oldest ? l.rooms : [...l.rooms, r]);
}
export function erase(a: Atlas, levelId: string, chosen: Cell[]): Atlas {
  checkCells(chosen);
  const l = getLevel(a, levelId),
    removed = new Set(chosen),
    touched = new Set(chosen.map((c) => l.cells[c]).filter(Boolean));
  if (!touched.size) return a;
  const cells = { ...l.cells },
    rooms = [...l.rooms];
  const byRoom = new Map<string, Cell[]>();
  for (const c of Object.keys(l.cells) as Cell[]) {
    const id = l.cells[c];
    if (!touched.has(id)) continue;
    const group = byRoom.get(id);
    if (group) group.push(c);
    else byRoom.set(id, [c]);
  }
  const nextRoomName = availableNames(rooms, "Raum");
  for (const id of touched) {
    const roomCells = byRoom.get(id)!;
    if (roomCells.every((c) => removed.has(c))) continue;
    for (const before of components(roomCells)) {
      const groups = components(before.filter((c) => !removed.has(c))).sort(
        (a, b) =>
          b.length - a.length ||
          compare(
            a.reduce((x, y) => (compare(x, y) < 0 ? x : y)),
            b.reduce((x, y) => (compare(x, y) < 0 ? x : y)),
          ),
      );
      for (const group of groups.slice(1)) {
        const r = room(nextRoomName());
        rooms.push(r);
        for (const c of group) cells[c] = r.id;
      }
    }
  }
  for (const c of chosen) delete cells[c];
  return finish(a, l, cells, rooms);
}
export function assign(
  a: Atlas,
  levelId: string,
  chosen: Cell[],
  target?: string,
  name?: string,
): Atlas {
  checkCells(chosen);
  const l = getLevel(a, levelId),
    occupied = chosen.filter((c) => l.cells[c]);
  if (!occupied.length) return a;
  const existing = l.rooms.find((r) => r.id === target);
  if (target && !existing)
    throw Error("Der Zielraum muss auf diesem Geschoss liegen.");
  if (existing && occupied.every((c) => l.cells[c] === existing.id)) return a;
  const r = existing ?? room(name || availableNames(l.rooms, "Raum")()),
    cells = { ...l.cells };
  for (const c of occupied) cells[c] = r.id;
  return finish(a, l, cells, existing ? l.rooms : [...l.rooms, r]);
}
export function renameRoom(
  a: Atlas,
  levelId: string,
  roomId: string,
  value: string,
): Atlas {
  const l = getLevel(a, levelId),
    name = nameOf(value),
    r = l.rooms.find((r) => r.id === roomId);
  if (!r) throw Error("Raum nicht gefunden.");
  if (r.name === name) return a;
  return replace(a, {
    ...l,
    rooms: l.rooms.map((r) => (r.id === roomId ? { ...r, name } : r)),
  });
}
export function addLevel(a: Atlas, afterId: string): Atlas {
  if (a.levels.length >= 100) throw Error("Maximal 100 Geschosse.");
  getLevel(a, afterId);
  const levels = [...a.levels];
  levels.splice(levels.findIndex((l) => l.id === afterId) + 1, 0, {
    id: crypto.randomUUID(),
    name: availableNames(levels, "Geschoss")(),
    rooms: [],
    cells: {},
  });
  return { ...a, levels };
}
export function renameLevel(a: Atlas, id: string, value: string): Atlas {
  const l = getLevel(a, id),
    name = nameOf(value);
  return l.name === name ? a : replace(a, { ...l, name });
}
export function moveLevel(a: Atlas, id: string, direction: -1 | 1): Atlas {
  getLevel(a, id);
  const index = a.levels.findIndex((l) => l.id === id),
    next = index + direction;
  if (next < 0 || next >= a.levels.length) return a;
  const levels = [...a.levels];
  [levels[index], levels[next]] = [levels[next], levels[index]];
  return { ...a, levels };
}
export function deleteLevel(a: Atlas, id: string): Atlas {
  getLevel(a, id);
  if (a.levels.length === 1)
    throw Error("Das letzte Geschoss kann nicht gelöscht werden.");
  return { ...a, levels: a.levels.filter((l) => l.id !== id) };
}
function validCell(c: string) {
  const p = xy(c);
  return (
    p.length === 2 &&
    p.every((n) => Number.isSafeInteger(n) && Math.abs(n) <= 1000000) &&
    key(...p) === c
  );
}
function checkCells(cells: Cell[]) {
  if (cells.length > 100000 || cells.some((c) => !validCell(c)))
    throw Error("Ungültiger Bereich (maximal 100.000 Zellen pro Aktion).");
}
// The same file contract is independently enforced by Rust at the disk boundary.
export function validate(value: unknown): asserts value is Atlas {
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const fields = (v: Record<string, unknown>, names: string[]) =>
    Object.keys(v).length === names.length &&
    names.every((n) => Object.hasOwn(v, n));
  const validName = (v: unknown) =>
    typeof v === "string" && !!v.trim() && [...v].length <= 120;
  const validId = (v: unknown): v is string =>
    typeof v === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(v);
  if (!object(value) || value.version !== 3)
    throw Error(
      "Diese Dateiversion wird nicht unterstützt. Benötigt wird Atlas V3.",
    );
  const fail = () => {
    throw Error("Ungültige Atlas-Datei: Struktur, Größe oder Raumzuordnung.");
  };
  if (
    !fields(value, ["version", "gridFeet", "levels"]) ||
    value.gridFeet !== 5 ||
    !Array.isArray(value.levels) ||
    !value.levels.length ||
    value.levels.length > 100
  )
    fail();
  const ids = new Set<string>();
  let count = 0,
    roomCount = 0;
  for (const l of value.levels as unknown[]) {
    if (
      !object(l) ||
      !fields(l, ["id", "name", "rooms", "cells"]) ||
      !validId(l.id) ||
      ids.has(l.id) ||
      !validName(l.name) ||
      !Array.isArray(l.rooms) ||
      !object(l.cells)
    ) {
      fail();
      continue;
    }
    ids.add(l.id);
    const roomIds = new Set<string>();
    for (const r of l.rooms) {
      if (
        !object(r) ||
        !fields(r, ["id", "name"]) ||
        !validId(r.id) ||
        ids.has(r.id) ||
        !validName(r.name)
      ) {
        fail();
        continue;
      }
      ids.add(r.id);
      roomIds.add(r.id);
      roomCount++;
    }
    const used = new Set<string>();
    for (const [c, id] of Object.entries(l.cells)) {
      if (!validCell(c) || typeof id !== "string" || !roomIds.has(id)) fail();
      used.add(id as string);
      count++;
    }
    if (used.size !== roomIds.size) fail();
  }
  if (count > 1000000 || roomCount > 100000) fail();
}
export function rectangle(a: Cell, b: Cell): Cell[] {
  const [ax, ay] = xy(a),
    [bx, by] = xy(b);
  if ((Math.abs(ax - bx) + 1) * (Math.abs(ay - by) + 1) > 100000)
    throw Error("Maximal 100.000 Zellen pro Aktion.");
  const result: Cell[] = [];
  for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++)
    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++)
      result.push(key(x, y));
  return result;
}
export function line(a: Cell, b: Cell): Cell[] {
  let [x, y] = xy(a);
  const [ex, ey] = xy(b),
    dx = Math.abs(ex - x),
    dy = -Math.abs(ey - y),
    sx = x < ex ? 1 : -1,
    sy = y < ey ? 1 : -1;
  if (Math.max(dx, -dy) >= 100000)
    throw Error("Maximal 100.000 Zellen pro Aktion.");
  let err = dx + dy;
  const out: Cell[] = [];
  for (;;) {
    out.push(key(x, y));
    if (x === ex && y === ey) break;
    const e = 2 * err;
    if (e >= dy) {
      err += dy;
      x += sx;
    }
    if (e <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}
export function components(cells: Cell[]): Cell[][] {
  const todo = new Set(cells),
    out: Cell[][] = [];
  while (todo.size) {
    const first = todo.values().next().value!;
    todo.delete(first);
    const group = [first];
    for (let i = 0; i < group.length; i++) {
      const [x, y] = xy(group[i]);
      for (const c of [
        key(x - 1, y),
        key(x + 1, y),
        key(x, y - 1),
        key(x, y + 1),
      ])
        if (todo.delete(c)) group.push(c);
    }
    out.push(group);
  }
  return out;
}
