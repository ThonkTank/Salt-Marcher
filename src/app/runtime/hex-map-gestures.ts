import type { AtlasMap } from './world-map-contracts';
import type { Hex, Terrain } from './world-cell-contracts';
import { pointHex } from './world-model';
import { beginHexPaint, applyHexPaintEdit, type HexPaintEdit } from './hex-paint';
import { ownedEventTarget } from '../shared/owned-event-target';
type State = {
  owner: string;
  map: AtlasMap;
  level: number;
  center: Hex;
  mode: string;
  paint: boolean;
  terrain: Terrain;
  radius: number;
};
export function installHexMapGestures(
  root: SVGSVGElement,
  options: {
    state: () => State | null;
    prepare: () => boolean;
    pan: (h: Hex) => void;
    select: (h: Hex) => void;
    render: () => void;
    commit: () => Promise<boolean>;
    changed: () => void;
    tell: (s: string, error?: boolean) => void;
    controls?: { undo: HTMLButtonElement; redo: HTMLButtonElement; status: HTMLElement };
  },
) {
  const cleanups: (() => void)[] = [];
  const events = ownedEventTarget(root, cleanups);
  let gesture: {
      id: number;
      state: State;
      inverse: DOMMatrix;
      stroke: ReturnType<typeof beginHexPaint> | null;
    } | null = null,
    suppressClick = false,
    historyMap = '',
    undo: HexPaintEdit[] = [],
    redo: HexPaintEdit[] = [];
  const undoButton =
      options.controls?.undo ??
      (root.ownerDocument.getElementById('hex-paint-undo') as HTMLButtonElement),
    redoButton =
      options.controls?.redo ??
      (root.ownerDocument.getElementById('hex-paint-redo') as HTMLButtonElement),
    status = options.controls?.status ?? root.ownerDocument.getElementById('hex-paint-status')!;
  const sync = () => {
    const state = options.state();
    if (state && state.map.id !== historyMap) {
      historyMap = state.map.id;
      undo = [];
      redo = [];
    }
    undoButton.disabled = !undo.length;
    redoButton.disabled = !redo.length;
  };
  const history = (edit: HexPaintEdit) => {
    sync();
    if (!edit.changes.length) return;
    undo.push(edit);
    redo = [];
    let cells = undo.reduce((sum, e) => sum + e.changes.length, 0);
    while (undo.length > 20 || cells > 20000) {
      cells -= undo.shift()!.changes.length;
    }
    sync();
    status.textContent =
      edit.changes.length + ' Hexes bemalt · Striche sind bis zum Kartenwechsel rücknehmbar.';
  };
  const release = (id: number) => {
    if (root.hasPointerCapture(id)) root.releasePointerCapture(id);
  };
  const settle = (commit: boolean) => {
    const g = gesture;
    if (!g) return;
    gesture = null;
    release(g.id);
    if (g.stroke) {
      const edit = g.stroke.finish();
      if (edit.changes.length) {
        history(edit);
        options.changed();
        options.render();
        if (commit) void options.commit();
        else status.textContent += ' · ungespeichert; mit Hex speichern übernehmen.';
      }
    }
  };
  const finish = () => settle(true),
    suspend = () => settle(false);
  const point = (e: PointerEvent, g: NonNullable<typeof gesture>) =>
    new DOMPoint(e.clientX, e.clientY).matrixTransform(g.inverse);
  root.style.touchAction = 'none';
  events.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.altKey) return;
    suppressClick = false;
    const s = options.state();
    if (!s || gesture || s.mode !== 'edit' || !s.paint) return;
    if (!options.prepare()) {
      suppressClick = true;
      return;
    }
    const matrix = root.getScreenCTM();
    if (!matrix) return;
    const inverse = matrix.inverse(),
      start = new DOMPoint(e.clientX, e.clientY).matrixTransform(inverse);
    gesture = {
      id: e.pointerId,
      state: s,
      inverse,
      stroke: beginHexPaint(s.map, s.level, s.terrain, s.radius),
    };
    {
      suppressClick = true;
      root.setPointerCapture(e.pointerId);
      root.focus();
      try {
        const h = pointHex(start.x / 100, start.y / 100);
        gesture.stroke!.touch(h);
        options.select(h);
        options.render();
      } catch (error) {
        finish();
        status.textContent = (error as Error).message;
        options.tell((error as Error).message, true);
      }
      e.preventDefault();
    }
  });
  events.addEventListener('pointermove', (e) => {
    const g = gesture;
    if (!g || g.id !== e.pointerId) return;
    const s = options.state();
    if (
      !s ||
      s.owner !== g.state.owner ||
      s.map.id !== g.state.map.id ||
      s.level !== g.state.level
    ) {
      gesture = null;
      release(g.id);
      return;
    }
    const p = point(e, g);
    try {
      const h = pointHex(p.x / 100, p.y / 100);
      g.stroke!.touch(h);
      options.select(h);
      options.render();
    } catch (error) {
      finish();
      status.textContent = (error as Error).message;
      options.tell((error as Error).message, true);
    }
    e.preventDefault();
  });
  events.addEventListener('pointerup', (e) => {
    if (gesture?.id === e.pointerId) finish();
  });
  events.addEventListener('pointercancel', finish);
  events.addEventListener('lostpointercapture', finish);
  events.addEventListener(
    'click',
    (e) => {
      if (suppressClick) {
        suppressClick = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  const step = async (direction: 'undo' | 'redo') => {
    finish();
    if (!(await options.commit())) return;
    sync();
    const s = options.state(),
      stack = direction === 'undo' ? undo : redo,
      edit = stack.at(-1);
    if (!s || !edit) return;
    try {
      applyHexPaintEdit(s.map, edit, direction);
      stack.pop();
      (direction === 'undo' ? redo : undo).push(edit);
      options.changed();
      options.render();
      sync();
      status.textContent =
        (direction === 'undo' ? 'Geländestrich zurückgenommen' : 'Geländestrich wiederholt') +
        ' · ' +
        edit.changes.length +
        ' Hexes.';
      await options.commit();
    } catch (error) {
      options.tell((error as Error).message, true);
    }
  };
  undoButton.onclick = () => void step('undo');
  redoButton.onclick = () => void step('redo');
  events.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.stopPropagation();
      void step(e.shiftKey ? 'redo' : 'undo');
    } else if (e.key === 'Escape') finish();
    else if (e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      const s = options.state();
      if (!s) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      suspend();
      options.pan({
        q: s.center.q + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0),
        r: s.center.r + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0),
      });
    }
  });
  sync();
  return {
    dispose() {
      suspend();
      undoButton.onclick = null;
      redoButton.onclick = null;
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
    get active() {
      return !!gesture;
    },
    finish,
    suspend,
    sync,
    reset() {
      const id = gesture?.id;
      gesture = null;
      if (id !== undefined) release(id);
      historyMap = '';
      undo = [];
      redo = [];
      status.textContent = '';
      sync();
    },
  };
}
