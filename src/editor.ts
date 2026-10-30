import { Atlas, Cell, emptyAtlas } from "./model";
export type Tool = "draw" | "erase" | "select" | "pan";
export type View = { x: number; y: number; zoom: number };
export type Editor = {
  document: Atlas;
  past: Atlas[];
  future: Atlas[];
  activeLevel: string;
  selection: Cell[];
  tool: Tool;
  view: View;
  ghost: boolean;
  gestureVersion: number;
};
export function initialEditor(document = emptyAtlas()): Editor {
  return {
    document,
    past: [],
    future: [],
    activeLevel: (
      document.levels.find((l) => l.rooms.length > 0) ?? document.levels[0]
    ).id,
    selection: [],
    tool: "draw",
    view: { x: 160, y: 120, zoom: 1 },
    ghost: false,
    gestureVersion: 0,
  };
}
export type Action =
  | { type: "commit"; document: Atlas; activeLevel?: string }
  | { type: "load"; document: Atlas }
  | { type: "undo" | "redo" | "cancel" }
  | { type: "level"; id: string }
  | { type: "select"; cells: Cell[] }
  | { type: "tool"; tool: Tool }
  | { type: "view"; view: View }
  | { type: "ghost"; enabled: boolean };
export function editorReducer(s: Editor, a: Action): Editor {
  switch (a.type) {
    case "load":
      return {
        ...initialEditor(a.document),
        gestureVersion: s.gestureVersion + 1,
      };
    case "commit": {
      if (s.document === a.document) return s;
      const activeLevel = a.activeLevel ?? s.activeLevel;
      const level =
        a.document.levels.find((l) => l.id === activeLevel) ??
        a.document.levels[
          Math.min(
            s.document.levels.findIndex((l) => l.id === s.activeLevel),
            a.document.levels.length - 1,
          )
        ];
      return {
        ...s,
        document: a.document,
        past: [...s.past, s.document].slice(-100),
        future: [],
        activeLevel: level.id,
        selection:
          level.id === s.activeLevel
            ? s.selection.filter((c) => level.cells[c])
            : [],
        gestureVersion: s.gestureVersion + 1,
      };
    }
    case "undo":
    case "redo": {
      const document = a.type === "undo" ? s.past.at(-1) : s.future[0];
      if (!document) return s;
      return {
        ...s,
        document,
        past:
          a.type === "undo"
            ? s.past.slice(0, -1)
            : [...s.past, s.document].slice(-100),
        future:
          a.type === "undo" ? [s.document, ...s.future] : s.future.slice(1),
        activeLevel: document.levels.some((l) => l.id === s.activeLevel)
          ? s.activeLevel
          : document.levels[0].id,
        selection: [],
        gestureVersion: s.gestureVersion + 1,
      };
    }
    case "level":
      return s.document.levels.some((l) => l.id === a.id)
        ? {
            ...s,
            activeLevel: a.id,
            selection: [],
            gestureVersion: s.gestureVersion + 1,
          }
        : s;
    case "tool":
      return { ...s, tool: a.tool, gestureVersion: s.gestureVersion + 1 };
    case "select":
      return { ...s, selection: a.cells };
    case "view":
      return { ...s, view: a.view };
    case "ghost":
      return { ...s, ghost: a.enabled };
    case "cancel":
      return { ...s, gestureVersion: s.gestureVersion + 1 };
  }
}
export const isTextInput = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  !!target.closest("input,textarea,select,[contenteditable=true]");
