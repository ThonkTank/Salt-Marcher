import {
  unionBounds,
  type Bounds,
  type ChangeSet,
  type EditorDocument,
  type HeightBrush,
  type HeightPatch,
  type HeightUpdate,
  type Point,
} from "../../src/editor/model";

const admissions = new WeakMap<EditorDocument, number>();
let nextGestureId = 0;

/** Model fixture only: starts the same C1 action used by the controller. */
export function beginTestBrush(doc: EditorDocument, brush: HeightBrush): void {
  doc.beginPrepaidGesture(brush, {
    sessionId: doc.sessionId,
    gestureId: ++nextGestureId,
    viewId: 1,
    preparationId: 1,
  });
  admissions.set(doc, 0);
}

/** Drain real bounded materialization. This proves no frame or presentation timing. */
function drain(doc: EditorDocument): {
  update: HeightUpdate | null;
  change: ChangeSet | null;
} {
  const patches = new Map<string, HeightPatch>();
  let bounds: Bounds | null = null;
  let change: ChangeSet | null = null;
  let slices = 0;
  while (doc.brushWork?.pendingCells || doc.finishing) {
    if (++slices > 10_000) throw new Error("C1 fixture made no progress.");
    const step = doc.advanceBrushGesture({ maxCells: 256, maxMs: 1000 });
    if (step.update) {
      bounds = bounds
        ? unionBounds(bounds, step.update.bounds)
        : step.update.bounds;
      for (const patch of step.update.patches) {
        const earlier = patches.get(patch.key);
        patches.set(patch.key, {
          key: patch.key,
          before: earlier ? earlier.before : patch.before,
          after: patch.after,
        });
      }
    }
    if (step.change) change = step.change;
  }
  return {
    update: bounds ? { bounds, patches: [...patches.values()] } : null,
    change,
  };
}

/**
 * Submit one supplied causal window, unchanged. The document rejects >50 ms;
 * this helper neither splits time nor manufactures feedback or author values.
 */
export function applyTestBrush(
  doc: EditorDocument,
  from: Point,
  to: Point,
  elapsedMs: number,
): HeightUpdate | null {
  const previous = admissions.get(doc);
  if (previous === undefined) throw new Error("Start the C1 fixture first.");
  const admissionId = previous + 1;
  doc.admitBrushBatch({
    admissionId,
    path: { from, points: [to], end: false },
    time: [{ from, to, elapsedMs }],
    pointCount: 1,
  });
  admissions.set(doc, admissionId);
  return drain(doc).update;
}

/** Seal only already accepted input; no extra endpoint or time is invented. */
export function finishTestBrush(doc: EditorDocument): ChangeSet | null {
  doc.sealBrushGesture();
  return drain(doc).change;
}

/** Explicit model-only feedback. This is not evidence of rendered presentation. */
export function acknowledgeTestBrush(doc: EditorDocument): boolean {
  const receipt = doc.freezeBrushEffect();
  return receipt !== null && doc.acknowledgeBrushEffect(receipt);
}
