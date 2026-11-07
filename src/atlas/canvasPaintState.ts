import type { Version } from "./model";

type Layer = "base" | "overlay";
export type CanvasPaintState = {
  mount: number;
  version: Version | null;
  presentationGeneration: number;
  cameraGeneration: number;
  dataReady: boolean;
  writesPending: boolean;
  base: { requested: number; painted: number };
  overlay: { requested: number; painted: number };
};
let mount = 0;
/** Observation only: never controls loading, React state or frame scheduling. */
export class CanvasPaintTracker {
  private state: CanvasPaintState = {
    mount: ++mount,
    version: null,
    presentationGeneration: 0,
    cameraGeneration: 0,
    dataReady: false,
    writesPending: false,
    base: { requested: 0, painted: -1 },
    overlay: { requested: 0, painted: -1 },
  };
  private active = false;
  private presentation: unknown;
  private camera: unknown;
  constructor(private observe?: (state: CanvasPaintState | null) => void) {}
  private publish() {
    this.observe?.({
      ...this.state,
      base: { ...this.state.base },
      overlay: { ...this.state.overlay },
    });
  }
  context(
    version: Version | null,
    presentation: unknown,
    camera: unknown,
    dataReady: boolean,
    writesPending: boolean,
  ) {
    this.active = true;
    if (
      presentation !== this.presentation ||
      camera !== this.camera ||
      version?.sessionId !== this.state.version?.sessionId ||
      version?.revision !== this.state.version?.revision
    ) {
      this.state.base.requested++;
      this.state.overlay.requested++;
    }
    if (presentation !== this.presentation) this.state.presentationGeneration++;
    if (camera !== this.camera) this.state.cameraGeneration++;
    this.presentation = presentation;
    this.camera = camera;
    this.state.version = version && {
      sessionId: version.sessionId,
      revision: version.revision,
    };
    this.state.dataReady = dataReady;
    this.state.writesPending = writesPending;
    this.publish();
  }
  request(layer: Layer) {
    const ticket = ++this.state[layer].requested;
    this.publish();
    return () => {
      if (!this.active || ticket !== this.state[layer].requested) return;
      this.state[layer].painted = ticket;
      this.publish();
    };
  }
  clear() {
    this.active = false;
    this.state.base.requested++;
    this.state.overlay.requested++;
    this.observe?.(null);
  }
}
export function canvasPainted(state: CanvasPaintState | null | undefined) {
  return (
    !!state?.version &&
    state.dataReady &&
    state.base.painted === state.base.requested &&
    state.overlay.painted === state.overlay.requested
  );
}
