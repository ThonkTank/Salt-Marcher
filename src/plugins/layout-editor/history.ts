// src/plugins/layout-editor/history.ts
import { LayoutEditorSnapshot } from "./types";
import { cloneLayoutElement, snapshotsAreEqual } from "./utils";

export class LayoutHistory {
    private snapshots: LayoutEditorSnapshot[] = [];
    private index = -1;
    private restoring = false;

    constructor(
        private readonly capture: () => LayoutEditorSnapshot,
        private readonly restore: (snapshot: LayoutEditorSnapshot) => void,
    ) {}

    get isRestoring() {
        return this.restoring;
    }

    reset(initial?: LayoutEditorSnapshot) {
        this.snapshots = initial ? [cloneSnapshot(initial)] : [];
        this.index = this.snapshots.length - 1;
    }

    push(snapshot?: LayoutEditorSnapshot) {
        if (this.restoring) return;
        const next = snapshot ? cloneSnapshot(snapshot) : cloneSnapshot(this.capture());
        const last = this.snapshots[this.index];
        if (last && snapshotsAreEqual(last, next)) {
            return;
        }
        if (this.index < this.snapshots.length - 1) {
            this.snapshots.splice(this.index + 1);
        }
        this.snapshots.push(next);
        this.index = this.snapshots.length - 1;
    }

    undo() {
        if (this.index <= 0) return;
        const target = this.snapshots[this.index - 1];
        if (!target) return;
        this.index -= 1;
        this.restoreSnapshot(target);
    }

    redo() {
        if (this.index >= this.snapshots.length - 1) return;
        const target = this.snapshots[this.index + 1];
        if (!target) return;
        this.index += 1;
        this.restoreSnapshot(target);
    }

    private restoreSnapshot(snapshot: LayoutEditorSnapshot) {
        this.restoring = true;
        try {
            this.restore(cloneSnapshot(snapshot));
        } finally {
            this.restoring = false;
        }
    }
}

function cloneSnapshot(snapshot: LayoutEditorSnapshot): LayoutEditorSnapshot {
    return {
        canvasWidth: snapshot.canvasWidth,
        canvasHeight: snapshot.canvasHeight,
        selectedElementId: snapshot.selectedElementId,
        elements: snapshot.elements.map(cloneLayoutElement),
    };
}
