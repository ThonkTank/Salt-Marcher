import type { TerrainAcknowledgement } from "./generated/TerrainAcknowledgement";
import { terrainCacheFor } from "./presentationCache";
import type { AtlasClient } from "./client";
import type { CheckedPreview } from "./editorWorkflow";
import type { WorkflowGate } from "./editorWorkflow";
import type { PlannedAction } from "./editorWorkflow";
import type { Intent, Preview, Status, ValidPreview, Version } from "./model";
import { PreviewScheduler } from "./previewScheduler";
import { sameVersion } from "./documentVersion";
import { WireError } from "../wireError";

type DocumentSnapshot = Readonly<{
  status: Status | null;
  committed: Preview | null;
  error: string;
  pending: number;
  exclusive: boolean;
  uncertain: boolean;
  recoveryEpoch: number;
}>;
export type SessionLease = symbol;
export type SessionUI = {
  confirm: (unavailable: boolean) => Promise<"save" | "discard" | "cancel">;
};
export type DocumentKind = "save" | "saveAs" | "open" | "new" | "close";
type TerrainIntent = Extract<Intent, { type: "terrainStroke" }>;
type TerrainStroke = {
  lease: SessionLease;
  id: string;
  sessionId: string;
  view: TerrainIntent["view"];
  points: TerrainIntent["brush"]["points"];
  sequence: number;
  frame: number | null;
  phase: "ready" | "sending" | "closing" | "failed" | "ended";
  inputTime: number;
};
type TerrainState =
  | { kind: "idle" }
  | { kind: "active"; stroke: TerrainStroke }
  | { kind: "failed"; lease: SessionLease };

type Mount = { ui: SessionUI; ready: boolean };
type Reservation = { done: Promise<void>; release: () => void };

/** The document protocol survives every UI lease, including zero subscribers. */
export class DocumentQueue {
  private snapshot: DocumentSnapshot = Object.freeze({
    status: null,
    committed: null,
    error: "",
    pending: 0,
    exclusive: false,
    uncertain: false,
    recoveryEpoch: 0,
  });
  private readonly listeners = new Set<() => void>();
  private readonly mounts = new Map<SessionLease, Mount>();
  private tail: Promise<unknown> = Promise.resolve();
  private reservation: Reservation | null = null;
  private writeGeneration = 0;
  private statusFlight: Promise<Status> | null = null;
  private latestPreview: { lease: SessionLease } | null = null;
  private readonly scheduler = new PreviewScheduler<CheckedPreview>();

  constructor(private readonly client: AtlasClient) {}

  getSnapshot = (): DocumentSnapshot => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<DocumentSnapshot>) {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch });
    for (const listener of this.listeners) listener();
  }
  private invalidatePreviews() {
    this.latestPreview = null;
    this.scheduler.cancelWaiting();
  }
  private publish(status: Status, committed = this.snapshot.committed) {
    const previous = this.snapshot.status;
    if (previous && !sameVersion(previous, status)) this.invalidatePreviews();
    terrainCacheFor(this.client).advance(this.client, status);
    this.update({
      status,
      committed:
        previous && previous.sessionId !== status.sessionId ? null : committed,
    });
  }
  attach(ui: SessionUI): SessionLease {
    const lease = Symbol();
    this.mounts.set(lease, { ui, ready: false });
    return lease;
  }
  detach(lease: SessionLease) {
    if (
      (this.terrain.kind === "active" && this.terrain.stroke.lease === lease) ||
      (this.terrain.kind === "failed" && this.terrain.lease === lease)
    )
      this.finishTerrain();
    this.clearPreview(lease);
    this.mounts.delete(lease);
  }
  isReady(lease: SessionLease) {
    return this.mounts.get(lease)?.ready === true;
  }
  getGate(lease: SessionLease): WorkflowGate {
    return {
      version: this.isReady(lease) ? this.snapshot.status : null,
      pending: this.snapshot.pending,
      exclusive: this.snapshot.exclusive,
      uncertain: this.snapshot.uncertain,
    };
  }
  async ready(lease: SessionLease): Promise<void> {
    while (this.mounts.has(lease) && !this.isReady(lease)) {
      const tail = this.tail;
      if (!(await this.readStatus(lease, false))) return;
      // Publication can queue another write before this promise consumer runs.
      const mount = this.mounts.get(lease);
      if (!mount) return;
      if (this.reservation || this.tail !== tail) continue;
      if (this.snapshot.uncertain) return;
      mount.ready = true;
    }
  }
  async reconcile(lease: SessionLease): Promise<void> {
    if (!this.isReady(lease)) await this.ready(lease);
    else await this.readStatus(lease, false);
  }
  /** Inside a write/file boundary, waiting on tail/reservation would await self. */
  private async readStatus(
    lease: SessionLease | null,
    insideBoundary: boolean,
  ): Promise<boolean> {
    for (;;) {
      if (lease && !this.mounts.has(lease)) return false;
      let tail = this.tail;
      if (!insideBoundary) {
        const reservation = this.reservation;
        if (reservation) await reservation.done;
        tail = this.tail;
        await tail;
        if (lease && !this.mounts.has(lease)) return false;
        if (this.reservation || this.tail !== tail) continue;
      }
      const before = this.snapshot.status;
      const flight = this.client.request("status", {});
      this.statusFlight = flight;
      const result = await flight.then(
        (status) => ({ status }),
        (error: unknown) => ({ error }),
      );
      if (lease && !this.mounts.has(lease)) return false;
      if (!insideBoundary && (this.reservation || this.tail !== tail)) continue;
      if (flight !== this.statusFlight || before !== this.snapshot.status) {
        // A mounting lease needs a stable post-drain observation. Let a newer
        // observation settle before retrying so simultaneous mounts converge.
        if (lease && !this.isReady(lease)) {
          await this.statusFlight?.catch(() => {});
          continue;
        }
        return false;
      }
      if ("status" in result) {
        this.publish(result.status);
        this.update({ uncertain: false });
        return true;
      }
      this.invalidatePreviews();
      this.update({ uncertain: true, error: String(result.error) });
      return false;
    }
  }
  private async recover(error: unknown): Promise<void> {
    this.writeGeneration++;
    this.invalidatePreviews();
    this.update({
      error: String(error),
      uncertain: true,
      recoveryEpoch: this.snapshot.recoveryEpoch + 1,
    });
    await this.readStatus(null, true);
  }
  private run<T>(
    lease: SessionLease,
    send: (status: Status) => Promise<T>,
    accept: (result: T) => void,
    rejectInvalid = false,
  ): Promise<T | null> {
    const status = this.snapshot.status;
    if (
      !this.isReady(lease) ||
      this.reservation ||
      this.snapshot.uncertain ||
      !status
    )
      return Promise.resolve(null);
    const generation = this.writeGeneration,
      session = status.sessionId;
    this.invalidatePreviews();
    const result = this.tail
      .then(async () => {
        const current = this.snapshot.status;
        // Accepted work belongs to the document, never the initiating mount.
        if (
          generation !== this.writeGeneration ||
          this.snapshot.uncertain ||
          current?.sessionId !== session
        )
          return null;
        try {
          const value = await send(current);
          accept(value);
          // A cancelled queued terrain section returns null without erasing
          // the failure that stopped its stroke.
          if (value !== null) this.setError("");
          return value;
        } catch (error) {
          if (
            rejectInvalid &&
            (error as { category?: string }).category === "invalidInput"
          )
            throw error;
          this.setError(String(error));
          if ((error as { category?: string }).category !== "invalidInput")
            await this.recover(error);
          return null;
        }
      })
      .finally(() => {
        this.update({ pending: this.snapshot.pending - 1 });
      });
    this.tail = result.catch(() => {});
    // Publish admission only after the FIFO link exists: subscribers may enqueue.
    this.update({ pending: this.snapshot.pending + 1 });
    return result;
  }
  private terrain: TerrainState = { kind: "idle" };
  beginTerrain(lease: SessionLease, intent: TerrainIntent) {
    if (this.terrain.kind !== "idle") return;
    const status = this.snapshot.status;
    if (
      !status ||
      !this.isReady(lease) ||
      this.reservation ||
      this.snapshot.uncertain
    )
      return;
    const stroke: TerrainStroke = {
      lease,
      id: crypto.randomUUID(),
      sessionId: status.sessionId,
      view: intent.view,
      points: [],
      sequence: 0,
      frame: null,
      phase: "sending",
      inputTime: performance.now(),
    };
    this.terrain = { kind: "active", stroke };
    // The immutable start settings are copied once, never with the accumulated path.
    const brush = structuredClone(intent.brush);
    const view = intent.view ?? null;
    const inputTime = stroke.inputTime;
    void this.run(
      lease,
      (version) =>
        this.client.request("beginTerrainStroke", {
          version,
          strokeId: stroke.id,
          brush,
          view,
        }),
      (result) => this.acceptTerrain(result, inputTime),
    ).then((result) => this.terrainSectionFinished(stroke, !!result));
  }
  appendTerrain(
    lease: SessionLease,
    points: TerrainIntent["brush"]["points"],
    view: TerrainIntent["view"],
  ) {
    if (this.terrain.kind !== "active") return;
    const stroke = this.terrain.stroke;
    if (stroke.lease !== lease) return;
    if (!stroke.points.length) stroke.inputTime = performance.now();
    for (const point of points) stroke.points.push([...point]);
    stroke.view = view;
    if (stroke.frame === null)
      stroke.frame = requestAnimationFrame(() => {
        stroke.frame = null;
        if (stroke.phase === "ready") this.flushTerrain(stroke);
      });
  }
  private terrainSectionFinished(stroke: TerrainStroke, succeeded: boolean) {
    if (!succeeded) {
      stroke.phase = "failed";
      stroke.points = [];
      if (stroke.frame !== null) cancelAnimationFrame(stroke.frame);
      stroke.frame = null;
      if (this.terrain.kind === "active" && this.terrain.stroke === stroke)
        this.terrain = { kind: "failed", lease: stroke.lease };
    } else if (stroke.phase === "sending") {
      stroke.phase = "ready";
      this.flushTerrain(stroke);
    }
  }
  private flushTerrain(stroke: TerrainStroke) {
    if (stroke.frame !== null) cancelAnimationFrame(stroke.frame);
    stroke.frame = null;
    if (!stroke.points.length) return;
    const points = stroke.points;
    stroke.points = [];
    const inputTime = stroke.inputTime;
    const view = stroke.view ?? null;
    if (stroke.phase !== "closing") stroke.phase = "sending";
    // Reserve the entire accepted batch in the FIFO, including its bounded
    // packets. File/history boundaries cannot overtake a buffered tail.
    void this.run(
      stroke.lease,
      async () => {
        if (stroke.phase === "failed") return null;
        for (let offset = 0; offset < points.length; offset += 32) {
          const result = await this.client.request("appendTerrainStroke", {
            sessionId: stroke.sessionId,
            strokeId: stroke.id,
            sequence: ++stroke.sequence,
            points: points.slice(offset, offset + 32),
            view,
          });
          this.acceptTerrain(result, inputTime);
        }
        return true;
      },
      () => {},
    ).then((result) => this.terrainSectionFinished(stroke, !!result));
  }

  private acceptTerrain(result: TerrainAcknowledgement, inputTime: number) {
    const cache = terrainCacheFor(this.client);
    cache.advance(this.client, result.status);
    if (result.surface) cache.seed(this.client, result.surface);
    performance.clearMeasures("atlas.terrain.confirmed");
    performance.measure("atlas.terrain.confirmed", {
      start: inputTime,
      detail: {
        revision: result.status.revision,
        sessionId: result.status.sessionId,
      },
    });
    this.publish(result.status, null);
  }
  finishTerrain = () => {
    const state = this.terrain;
    this.terrain = { kind: "idle" };
    if (state.kind !== "active") return;
    const stroke = state.stroke;
    stroke.phase = "closing";
    // Link the buffered tail and end into the document FIFO before a boundary
    // reserves it or the initiating lease detaches. Only one request is sent at a time.
    this.flushTerrain(stroke);
    void this.run(
      stroke.lease,
      () =>
        stroke.phase === "failed"
          ? Promise.resolve(null)
          : this.client.request("endTerrainStroke", {
              sessionId: stroke.sessionId,
              strokeId: stroke.id,
            }),
      (status) => {
        if (status) {
          stroke.phase = "ended";
          this.publish(status);
        }
      },
    );
  };
  commit(
    lease: SessionLease,
    intent: Intent,
    exact?: Version,
  ): Promise<ValidPreview | null> {
    this.finishTerrain();
    const snapshot = structuredClone(intent),
      version = exact ? { ...exact } : undefined;
    return this.run(
      lease,
      (status) => {
        if (version && !sameVersion(status, version))
          throw new WireError(
            "invalidInput",
            "Vorschau veraltet. Bitte erneut erzeugen.",
          );
        return this.client.request("commit", {
          version: version ?? status,
          intent: snapshot,
        });
      },
      (result) => {
        const cache = terrainCacheFor(this.client);
        cache.advance(this.client, result.status);
        if (result.terrain?.surface)
          cache.seed(this.client, {
            ...result.terrain.surface,
            status: result.status,
          });
        this.publish(result.status);
        this.update({ committed: result });
      },
      !!version,
    );
  }
  commitExact(
    lease: SessionLease,
    action: PlannedAction,
    version: Version,
    mayDispatch: () => boolean,
  ): Promise<ValidPreview | null> {
    const current = this.snapshot.status;
    if (
      this.snapshot.pending ||
      !current ||
      !sameVersion(current, version) ||
      !mayDispatch()
    )
      return Promise.resolve(null);
    return this.commit(lease, action.intent, version);
  }

  history(lease: SessionLease, redo: boolean): Promise<Status | null> {
    this.finishTerrain();
    return this.run(
      lease,
      (status) => this.client.request("history", { version: status, redo }),
      (status) => this.publish(status),
    );
  }
  clearPreview(lease: SessionLease) {
    // An old cleanup must not remove another mount's newest waiting request.
    if (this.latestPreview?.lease === lease) {
      this.latestPreview = null;
      this.scheduler.cancelWaiting();
    }
  }
  inspect(
    lease: SessionLease,
    action: PlannedAction,
    exact?: Version,
  ): Promise<CheckedPreview | null> {
    this.clearPreview(lease);
    const mount = this.mounts.get(lease),
      status = this.snapshot.status;
    if (
      !mount ||
      !this.isReady(lease) ||
      !status ||
      this.snapshot.uncertain ||
      this.reservation ||
      this.snapshot.pending ||
      (exact && !sameVersion(status, exact))
    )
      return Promise.resolve(null);
    const identity = { lease };
    this.latestPreview = identity;
    const version = { sessionId: status.sessionId, revision: status.revision };
    const intent = structuredClone(action.intent),
      actionId = action.operationId;
    const valid = () =>
      this.mounts.get(lease) === mount &&
      this.latestPreview === identity &&
      !this.snapshot.uncertain &&
      !this.reservation &&
      this.snapshot.pending === 0 &&
      !!this.snapshot.status &&
      sameVersion(this.snapshot.status, version);
    return this.scheduler.schedule(valid, async () => {
      try {
        const result = await this.client.request("preview", {
          version,
          intent,
        });
        if (valid()) return { ...result, actionId };
      } catch (error) {
        if (valid()) this.setError(String(error));
      }
      return null;
    });
  }
  async document(
    lease: SessionLease,
    kind: DocumentKind,
  ): Promise<"ignored" | "finished"> {
    this.finishTerrain();
    const generation = this.writeGeneration;
    const available = () =>
      generation === this.writeGeneration &&
      (this.isReady(lease) ||
        (kind === "close" &&
          this.mounts.has(lease) &&
          this.snapshot.uncertain));
    if (
      !available() ||
      this.reservation ||
      (this.snapshot.uncertain && kind !== "close")
    )
      return "ignored";
    let release!: () => void;
    const reservation: Reservation = {
      done: new Promise<void>((resolve) => {
        release = resolve;
      }),
      release: () => release(),
    };
    this.reservation = reservation;
    this.invalidatePreviews();
    this.update({ exclusive: true });
    const owns = (status: Status | null) =>
      available() &&
      this.reservation === reservation &&
      this.snapshot.status === status;
    try {
      await this.tail;
      if (!available()) return "finished";
      let status = this.snapshot.status;
      const ui = this.mounts.get(lease)!.ui;
      if (!status || this.snapshot.uncertain) {
        if (kind === "close") {
          const choice = await ui.confirm(true);
          if (owns(status) && choice === "discard") await this.client.close();
        }
        return "finished";
      }
      if (
        (kind === "new" || kind === "open" || kind === "close") &&
        status.dirty
      ) {
        const choice = await ui.confirm(false);
        if (!owns(status) || choice === "cancel") return "finished";
        if (choice === "save") {
          const saved = await this.client.save(status);
          // Already dispatched I/O publishes even after the initiating UI leaves.
          if (this.snapshot.status !== status) return "finished";
          if (!saved) return "finished";
          this.publish(saved);
          status = saved;
          if (!owns(status)) return "finished";
        }
      }
      if (!owns(status)) return "finished";
      if (kind === "close") {
        await this.client.close();
        return "finished";
      }
      const result =
        kind === "new"
          ? await this.client.request("new", {})
          : kind === "open"
            ? await this.client.open(status)
            : await this.client.save(status, kind === "saveAs");
      if (this.snapshot.status !== status) return "finished";
      if (result) this.publish(result);
      this.setError("");
    } catch (error) {
      await this.recover(error);
    } finally {
      if (this.reservation === reservation) {
        this.reservation = null;
        this.update({ exclusive: false });
      }
      reservation.release();
    }
    return "finished";
  }
  acknowledge(version: Version) {
    const committed = this.snapshot.committed;
    if (
      committed?.status?.sessionId === version.sessionId &&
      committed.status.revision <= version.revision
    )
      this.update({ committed: null });
  }
  setError(message: string) {
    this.update({ error: message });
  }
}

const documents = new WeakMap<AtlasClient, DocumentQueue>();
export function documentQueueFor(client: AtlasClient): DocumentQueue {
  let queue = documents.get(client);
  if (!queue) {
    queue = new DocumentQueue(client);
    documents.set(client, queue);
  }
  return queue;
}
