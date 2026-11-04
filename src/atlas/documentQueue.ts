import type { AtlasClient } from "./client";
import type { CheckedPreview } from "./editorWorkflow";
import type { WorkflowGate } from "./editorWorkflow";
import type { PlannedAction } from "./editorWorkflow";
import type { Intent, Preview, Status, ValidPreview, Version } from "./model";
import { PreviewScheduler } from "./previewScheduler";
import { sameVersion } from "./documentVersion";
import { WireError } from "../wireError";

export type DocumentSnapshot = Readonly<{
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
  private publish(status: Status) {
    const previous = this.snapshot.status;
    if (previous && !sameVersion(previous, status)) this.invalidatePreviews();
    this.update({
      status,
      ...(previous && previous.sessionId !== status.sessionId
        ? { committed: null }
        : {}),
    });
  }
  attach(ui: SessionUI): SessionLease {
    const lease = Symbol();
    this.mounts.set(lease, { ui, ready: false });
    return lease;
  }
  detach(lease: SessionLease) {
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
          this.setError("");
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
  commit(
    lease: SessionLease,
    intent: Intent,
    exact?: Version,
  ): Promise<ValidPreview | null> {
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
