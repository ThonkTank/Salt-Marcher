import { describe, it, expect } from "vitest";
import {
  Atlas,
  Cell,
  emptyAtlas,
  draw,
  erase,
  assign,
  renameRoom,
  rectangle,
  key,
  components,
  line,
  addLevel,
  moveLevel,
  renameLevel,
  deleteLevel,
  validate,
} from "./model";
import { editorReducer, initialEditor } from "./editor";
import { walls } from "./walls";
import valid from "../tests/fixtures/v3-valid.json";
import reference from "../tests/fixtures/v3-invalid-reference.json";
import duplicate from "../tests/fixtures/v3-duplicate-id.json";
import badCell from "../tests/fixtures/v3-invalid-cell.json";
function sample(cells: Cell[] = rectangle("0,0", "4,0")) {
  const a = emptyAtlas();
  return draw(a, a.levels[0].id, cells);
}
const editDraw = (a: Atlas, c: Cell[]) => draw(a, a.levels[0].id, c);
const editErase = (a: Atlas, c: Cell[]) => erase(a, a.levels[0].id, c);
describe("room operations", () => {
  it("draws identical rectangles in all directions and negative coordinates", () => {
    const expected = rectangle("-2,-1", "1,2");
    for (const [a, b] of [
      ["1,2", "-2,-1"],
      ["-2,2", "1,-1"],
      ["1,-1", "-2,2"],
    ] as const)
      expect(rectangle(a, b)).toEqual(expected);
    expect(expected).toHaveLength(16);
  });
  it("keeps adjacent rooms separate and merges whole identities, preserving the oldest", () => {
    let a = sample(rectangle("0,0", "2,2"));
    const first = a.levels[0].rooms[0];
    a = editDraw(a, rectangle("3,0", "5,2"));
    expect(a.levels[0].rooms).toHaveLength(2);
    a = editDraw(a, rectangle("2,1", "3,1"));
    expect(a.levels[0].rooms).toEqual([first]);
    expect(new Set(Object.values(a.levels[0].cells))).toEqual(
      new Set([first.id]),
    );
    expect(Object.keys(a.levels[0].cells)).toHaveLength(18);
  });
  it("merges three identities", () => {
    let a = sample(["0,0"]);
    const id = a.levels[0].rooms[0].id;
    a = editDraw(a, ["2,0"]);
    a = editDraw(a, ["4,0"]);
    a = editDraw(a, rectangle("0,0", "4,0"));
    expect(a.levels[0].rooms.map((r) => r.id)).toEqual([id]);
  });
  it("cuts a hole without splitting", () => {
    const a = editErase(sample(rectangle("0,0", "2,2")), ["1,1"]);
    expect(a.levels[0].rooms).toHaveLength(1);
    expect(Object.keys(a.levels[0].cells)).toHaveLength(8);
  });
  it("keeps the largest split piece and resolves ties top-left", () => {
    const s = sample(),
      id = s.levels[0].rooms[0].id;
    let a = editErase(s, ["1,0"]);
    expect(a.levels[0].cells["4,0"]).toBe(id);
    expect(a.levels[0].cells["0,0"]).not.toBe(id);
    a = editErase(s, ["2,0"]);
    expect(a.levels[0].cells["0,0"]).toBe(id);
    expect(a.levels[0].cells["4,0"]).not.toBe(id);
  });
  it("does not connect diagonals", () =>
    expect(components(["0,0", "1,1"])).toHaveLength(2));
  it("removes empty rooms", () => {
    const a = editErase(sample(["0,0"]), ["0,0"]);
    expect(a.levels[0].rooms).toEqual([]);
    expect(a.levels[0].cells).toEqual({});
  });
  it("preserves intentionally disconnected identities until a component splits", () => {
    let a = sample(),
      l = a.levels[0],
      id = l.rooms[0].id;
    a = editDraw(a, rectangle("10,0", "12,0"));
    a = assign(a, l.id, rectangle("10,0", "12,0"), id);
    a = editErase(a, ["10,0"]);
    expect(a.levels[0].cells["11,0"]).toBe(id);
    expect(a.levels[0].rooms).toHaveLength(1);
    a = editErase(a, ["2,0"]);
    expect(a.levels[0].cells["11,0"]).toBe(id);
    expect(a.levels[0].cells["4,0"]).not.toBe(id);
    expect(a.levels[0].rooms).toHaveLength(2);
  });
  it("assigns only occupied cells and supports names", () => {
    let a = sample(rectangle("0,0", "2,0"));
    a = assign(
      a,
      a.levels[0].id,
      rectangle("2,0", "4,0"),
      undefined,
      "Bibliothek",
    );
    expect(Object.keys(a.levels[0].cells)).toHaveLength(3);
    expect(a.levels[0].rooms.at(-1)!.name).toBe("Bibliothek");
  });
  it("interpolates fast eraser movements and limits gestures", () => {
    expect(line("0,0", "3,0")).toEqual(["0,0", "1,0", "2,0", "3,0"]);
    expect(line("3,0", "0,0")).toHaveLength(4);
    expect(() => rectangle("0,0", "1000,1000")).toThrow();
    expect(() => line("0,0", "1000000,0")).toThrow();
    expect(() => editDraw(sample(), ["1000001,0"])).toThrow();
  });
  it("never mutates source documents", () => {
    const a = sample(),
      snapshot = structuredClone(a),
      l = a.levels[0];
    editErase(a, ["1,0"]);
    assign(a, l.id, ["0,0"], undefined, "X");
    renameRoom(a, l.id, l.rooms[0].id, "Y");
    expect(a).toEqual(snapshot);
  });
  it("returns original references for ineffective actions", () => {
    const a = sample(),
      l = a.levels[0],
      r = l.rooms[0];
    expect(editDraw(a, ["0,0"])).toBe(a);
    expect(editErase(a, ["10,10"])).toBe(a);
    expect(assign(a, l.id, ["0,0"], r.id)).toBe(a);
    expect(assign(a, l.id, ["20,20"])).toBe(a);
    expect(renameRoom(a, l.id, r.id, r.name)).toBe(a);
    expect(renameLevel(a, l.id, l.name)).toBe(a);
    expect(moveLevel(a, l.id, 1)).toBe(a);
  });
});
describe("floors and history", () => {
  it("edits floors independently and preserves untouched references", () => {
    let a = sample();
    const lower = a.levels[0];
    a = addLevel(a, lower.id);
    const upper = a.levels[1];
    a = draw(a, upper.id, ["0,0"]);
    expect(a.levels[0]).toBe(lower);
    expect(a.levels[1].cells["0,0"]).not.toBe(lower.cells["0,0"]);
    expect(() => assign(a, upper.id, ["0,0"], lower.rooms[0].id)).toThrow();
    const edited = renameRoom(a, upper.id, a.levels[1].rooms[0].id, "Turm");
    expect(edited.levels[1].cells).toBe(a.levels[1].cells);
    expect(edited.levels[0]).toBe(lower);
  });
  it("inserts above active, reorders, renames and deletes floors", () => {
    let a = emptyAtlas(),
      base = a.levels[0];
    a = addLevel(a, base.id);
    const top = a.levels[1];
    a = addLevel(a, base.id);
    expect(a.levels[2]).toBe(top);
    const middle = a.levels[1];
    a = moveLevel(a, middle.id, 1);
    expect(a.levels[2]).toBe(middle);
    a = renameLevel(a, middle.id, "Turm");
    expect(a.levels[2].name).toBe("Turm");
    a = deleteLevel(a, middle.id);
    a = deleteLevel(a, top.id);
    expect(() => deleteLevel(a, base.id)).toThrow();
  });
  it("undoes names, identity changes and floor deletion with stable snapshots", () => {
    let s = initialEditor(),
      id = s.activeLevel;
    s = editorReducer(s, {
      type: "commit",
      document: draw(s.document, id, rectangle("0,0", "4,0")),
    });
    const saved = s.document;
    s = editorReducer(s, {
      type: "commit",
      document: renameRoom(
        s.document,
        id,
        s.document.levels[0].rooms[0].id,
        "Eingang",
      ),
    });
    s = editorReducer(s, {
      type: "commit",
      document: erase(s.document, id, ["2,0"]),
    });
    const end = s.document;
    s = editorReducer(editorReducer(s, { type: "undo" }), { type: "undo" });
    expect(s.document).toBe(saved);
    s = editorReducer(editorReducer(s, { type: "redo" }), { type: "redo" });
    expect(s.document).toBe(end);
    s = editorReducer(s, { type: "undo" });
    s = editorReducer(s, {
      type: "commit",
      document: draw(s.document, id, ["8,0"]),
    });
    expect(s.future).toEqual([]);
  });
  it("keeps navigation outside history and no-op actions outside undo", () => {
    let s = initialEditor(sample()),
      original = s.document;
    const view = { x: 20, y: 30, zoom: 2 };
    s = editorReducer(s, { type: "view", view });
    s = editorReducer(s, { type: "ghost", enabled: true });
    s = editorReducer(s, { type: "select", cells: ["0,0"] });
    s = editorReducer(s, {
      type: "commit",
      document: editDraw(s.document, ["0,0"]),
    });
    expect(s.document).toBe(original);
    expect(s.past).toEqual([]);
    s = editorReducer(s, {
      type: "commit",
      document: editDraw(s.document, ["8,0"]),
    });
    s = editorReducer(s, { type: "undo" });
    expect(s.document).toBe(original);
    expect(s.view).toBe(view);
    expect(s.ghost).toBe(true);
  });
  it("handles active floor removed by undo/delete and restores deleted floors", () => {
    let s = initialEditor(),
      a = addLevel(s.document, s.activeLevel),
      newId = a.levels[1].id;
    s = editorReducer(s, { type: "commit", document: a, activeLevel: newId });
    s = editorReducer(s, { type: "undo" });
    expect(s.activeLevel).toBe(s.document.levels[0].id);
    s = editorReducer(s, { type: "redo" });
    s = editorReducer(s, { type: "level", id: newId });
    s = editorReducer(s, {
      type: "commit",
      document: deleteLevel(s.document, newId),
    });
    expect(s.activeLevel).toBe(s.document.levels[0].id);
    s = editorReducer(s, { type: "undo" });
    expect(s.document).toBe(a);
  });
  it("caps undo at 100 completed actions", () => {
    let s = initialEditor();
    for (let n = 0; n < 110; n++)
      s = editorReducer(s, {
        type: "commit",
        document: draw(s.document, s.activeLevel, [key(n * 2, 0)]),
      });
    expect(s.past).toHaveLength(100);
  });
  it("handles 10,000 cells without copying unedited floors", () => {
    let a = emptyAtlas();
    for (let i = 0; i < 3; i++) {
      if (i) a = addLevel(a, a.levels.at(-1)!.id);
      a = draw(a, a.levels.at(-1)!.id, rectangle("0,0", "49,65"));
    }
    a = draw(a, a.levels[2].id, rectangle("0,65", "49,67"));
    expect(a.levels.reduce((n, l) => n + Object.keys(l.cells).length, 0)).toBe(
      10000,
    );
    const b = erase(a, a.levels[1].id, ["0,0"]);
    expect(b.levels[0]).toBe(a.levels[0]);
    expect(b.levels[2]).toBe(a.levels[2]);
    expect(b.levels[1]).not.toBe(a.levels[1]);
  });
});
describe("file contract and 2D boundaries", () => {
  it("shares valid and invalid fixtures with Rust", () => {
    expect(() => validate(valid)).not.toThrow();
    for (const a of [reference, duplicate, badCell])
      expect(() => validate(a)).toThrow();
    expect(() => validate(JSON.parse(JSON.stringify(valid)))).not.toThrow();
  });
  it("rejects legacy versions, unknown fields and invalid limits", () => {
    for (const version of [1, 2, 4])
      expect(() => validate({ version })).toThrow(/V3/);
    expect(() => validate({ ...valid, view: {} })).toThrow();
    expect(() => validate({ ...valid, levels: [] })).toThrow();
    expect(() =>
      validate({ ...valid, levels: Array(101).fill(valid.levels[0]) }),
    ).toThrow();
    const a = structuredClone(valid);
    a.levels[0].name = "x".repeat(121);
    expect(() => validate(a)).toThrow();
  });
  it("emits each boundary once and keeps identity boundaries", () => {
    expect(walls({ "0,0": "a", "1,0": "a" })).toHaveLength(6);
    const w = walls({ "0,0": "a", "1,0": "b" });
    expect(w).toHaveLength(7);
    expect(
      w.filter((e) => e.x === 1 && e.y === 0 && !e.horizontal),
    ).toHaveLength(1);
  });
});

it("selects the first occupied floor on load, with an empty-map fallback", () => {
  let a = emptyAtlas();
  a = addLevel(a, a.levels[0].id);
  expect(initialEditor(a).activeLevel).toBe(a.levels[0].id);
  a = draw(a, a.levels[1].id, ["10000,-10000"]);
  const state = editorReducer(initialEditor(), { type: "load", document: a });
  expect(state.activeLevel).toBe(a.levels[1].id);
  expect(state.document).toBe(a);
  expect(state.past).toEqual([]);
});

it("allocates the first unused names once across many splits", () => {
  let a = sample(rectangle("0,0", "8,0"));
  const l = a.levels[0];
  a = renameRoom(a, l.id, l.rooms[0].id, "Raum 2");
  a = erase(a, l.id, ["1,0", "3,0", "5,0", "7,0"]);
  expect(a.levels[0].rooms.map((r) => r.name)).toEqual([
    "Raum 2",
    "Raum 1",
    "Raum 3",
    "Raum 4",
    "Raum 5",
  ]);
  expect(a.levels[0].cells["0,0"]).toBe(l.rooms[0].id);
  validate(a);
});

it("handles thousands of small rooms without quadratic naming or erase scans", () => {
  let nameReads = 0;
  const rooms = Array.from({ length: 4000 }, (_, i) => ({
    id: `r${i}`,
    get name() {
      nameReads++;
      return `Raum ${i + 1}`;
    },
  }));
  const cells = Object.fromEntries(rooms.map((r, i) => [`${i * 2},0`, r.id]));
  const a: Atlas = {
    version: 3,
    gridFeet: 5,
    levels: [{ id: "ground", name: "EG", rooms, cells }],
  };
  const start = performance.now();
  const b = draw(a, "ground", ["8000,0"]);
  expect(b.levels[0].rooms.at(-1)!.name).toBe("Raum 4001");
  expect(nameReads).toBeLessThanOrEqual(4000);
  const drawMs = performance.now() - start;
  const eraseStart = performance.now();
  const c = erase(a, "ground", Object.keys(cells) as Cell[]);
  const eraseMs = performance.now() - eraseStart;
  expect(c.levels[0].rooms).toEqual([]);
  expect(c.levels[0].cells).toEqual({});
  expect(a.levels[0].rooms).toHaveLength(4000);
  // A generous interaction budget, not a hardware-specific frame-rate target.
  expect(eraseMs).toBeLessThan(1000);
  console.log(
    `4,000 rooms: draw ${Math.round(drawMs)} ms; erase ${Math.round(eraseMs)} ms`,
  );
});

it("splits many distinct rooms in one erase operation without changing their surviving identities", () => {
  const rooms = Array.from({ length: 1000 }, (_, i) => ({
    id: `r${i}`,
    name: `Raum ${i + 1}`,
  }));
  const cells: Record<Cell, string> = {};
  const cut: Cell[] = [];
  rooms.forEach((r, i) => {
    for (let x = 0; x < 3; x++) cells[key(i * 4 + x, 0)] = r.id;
    cut.push(key(i * 4 + 1, 0));
  });
  const a: Atlas = {
    version: 3,
    gridFeet: 5,
    levels: [{ id: "floor", name: "EG", rooms, cells }],
  };
  const b = erase(a, "floor", cut),
    l = b.levels[0];
  expect(l.rooms).toHaveLength(2000);
  expect(new Set(l.rooms.map((r) => r.name)).size).toBe(2000);
  rooms.forEach((r, i) => {
    expect(l.cells[key(i * 4, 0)]).toBe(r.id);
    expect(l.cells[key(i * 4 + 1, 0)]).toBeUndefined();
    expect(l.cells[key(i * 4 + 2, 0)]).not.toBe(r.id);
  });
  const reversed = erase(a, "floor", [...cut].reverse()).levels[0];
  expect(reversed.rooms[1000].id).toBe(reversed.cells[key(999 * 4 + 2, 0)]);
  expect(l.rooms[1000].name).toBe("Raum 1001");
  validate(b);
});
