import { editorBudgets } from "./budgets";
import type { Bounds } from "./model/types";

export interface ObservationEvent {
  kind: string;
  at: number;
  [key: string]: unknown;
}

export interface ObservationOptions {
  /** Sample the current pointer only when explicitly requested. */
  pointerHeight?: boolean;
  /** Omit journal entries from this read without changing the retained journal. */
  events?: boolean;
  /** Return entries starting at this zero-based journal index. */
  sinceEvent?: number;
}

export interface ObservedSubmission {
  sessionId: string;
  frame: number;
  viewGeneration: number;
  revision: number;
  exactRevision: number;
  at: number;
  uploadedBytes: number;
}

export interface ObservedRegion {
  status: "outside" | "missing" | "stale" | "current";
  sessionId: string;
  frame: number;
  viewGeneration: number;
}

interface DoseFact extends Record<string, unknown> {
  sessionId: string;
  gestureId: number;
  intervalId: number;
  revision: number;
  changed: boolean;
  bounds: Bounds | null;
  at: number;
  projectedAt: number | null;
  inputIds: number[];
}

interface CommitFact extends Record<string, unknown> {
  input: number;
  sessionId: string;
  gestureId: number;
  revision: number;
  sequence: number;
  bounds: Bounds[];
}

interface PendingReceipt {
  sessionId: string;
  revision: number;
  bounds: Bounds[];
  gestureId: number;
  intervalId?: number;
  input?: number;
  sequence?: number;
  committedAt?: number;
}

/** Observes the product. It cannot complete a render, make sources ready, or edit. */
export class Observation {
  private events: ObservationEvent[] = [];
  private pending: PendingReceipt[] = [];
  private lastSubmission: ObservedSubmission | null = null;
  private navigationInput: {
    input: number;
    sessionId: string;
    sources: boolean;
    ready: boolean;
  } | null = null;
  dropped = 0;

  constructor(readonly enabled = false) {}

  get eventCount(): number {
    return this.events.length;
  }

  /** A document switch invalidates associations, not the retained evidence. */
  reset(): void {
    this.pending = [];
    this.lastSubmission = null;
    this.navigationInput = null;
  }

  event(kind: string, details: Record<string, unknown> = {}): void {
    if (!this.enabled) return;
    if (kind === "brush-feedback-obsolete")
      this.pending = this.pending.filter(
        (entry) =>
          entry.sessionId !== details.sessionId ||
          entry.intervalId !== details.intervalId,
      );
    if (this.events.length >= editorBudgets.observationEvents) {
      this.dropped++;
      return;
    }
    this.events.push({ kind, at: performance.now(), ...details });
  }

  input(id: number, event: Event, kind: string): void {
    if (!this.enabled) return;
    // Event timestamps precede dispatch; handler-start-only timings hide queues.
    const createdAt =
      event.timeStamp > performance.timeOrigin
        ? event.timeStamp - performance.timeOrigin
        : event.timeStamp;
    if (this.events.length < editorBudgets.observationEvents)
      performance.mark(`atlas.input.${id}`);
    this.event("input", {
      id,
      inputKind: kind,
      eventType: event.type,
      createdAt,
    });
  }

  dose(details: DoseFact): void {
    if (!this.enabled) return;
    if (
      this.events.length < editorBudgets.observationEvents &&
      details.changed &&
      details.bounds &&
      Number.isFinite(details.projectedAt)
    )
      this.pending.push({
        sessionId: details.sessionId,
        gestureId: details.gestureId,
        intervalId: details.intervalId,
        revision: details.revision,
        bounds: [details.bounds],
      });
    this.event("brush-interval", details);
  }

  commit(
    details: CommitFact,
    inspect?: (bounds: Bounds, minimumRevision: number) => ObservedRegion,
  ): void {
    if (!this.enabled) return;
    const committedAt = performance.now();
    this.mark("commit", String(details.input), { ...details, at: committedAt });
    if (
      this.events.length < editorBudgets.observationEvents &&
      details.bounds.length
    ) {
      const entry: PendingReceipt = {
        sessionId: details.sessionId,
        gestureId: details.gestureId,
        input: details.input,
        revision: details.revision,
        sequence: details.sequence,
        bounds: details.bounds,
        committedAt,
      };
      // Finishing history does not change terrain. Reuse the actual last draw
      // only while every local region still certifies that same view/frame.
      if (
        !inspect ||
        !this.lastSubmission ||
        !this.publishReceipt(entry, this.lastSubmission, inspect)
      )
        this.pending.push(entry);
    }
  }

  navigation(
    input: number,
    details: { sessionId: string; camera: unknown },
  ): void {
    if (!this.enabled) return;
    this.navigationInput = {
      input,
      sessionId: details.sessionId,
      sources: false,
      ready: false,
    };
    this.mark("camera", String(input), { input, ...details });
  }

  readiness(details: {
    sessionId: string;
    revision: number;
    frame: number;
    viewGeneration: number;
    ready: boolean;
    sourcesReady: boolean;
  }): void {
    if (!this.enabled) return;
    const navigation = this.navigationInput;
    if (!navigation || navigation.sessionId !== details.sessionId) return;
    const { ready, sourcesReady, ...identity } = details;
    const fact = { input: navigation.input, ...identity };
    if (sourcesReady && !navigation.sources) {
      navigation.sources = true;
      this.mark("sources-ready", String(navigation.input), fact);
    }
    if (ready && !navigation.ready) {
      navigation.ready = true;
      this.mark("input-ready", String(navigation.input), fact);
    }
  }

  /** Read-only correlation after a real draw; outside-view is never a receipt. */
  submitted(
    submission: ObservedSubmission,
    inspect: (bounds: Bounds, minimumRevision: number) => ObservedRegion,
  ): void {
    if (!this.enabled) return;
    this.lastSubmission = { ...submission };
    this.mark(
      "submit",
      `${submission.sessionId}.${submission.frame}.${submission.viewGeneration}`,
      {
        ...submission,
      },
    );
    this.pending = this.pending.filter(
      (entry) => !this.publishReceipt(entry, submission, inspect),
    );
  }

  private publishReceipt(
    entry: PendingReceipt,
    submission: ObservedSubmission,
    inspect: (bounds: Bounds, minimumRevision: number) => ObservedRegion,
  ): boolean {
    if (
      entry.sessionId !== submission.sessionId ||
      entry.revision > submission.revision ||
      !entry.bounds.every((bounds) => {
        // Ask for the recorded fact's revision. A completed local render group
        // can prove that older fact while newer author changes remain pending;
        // only the renderer can supply that exact scene/region evidence.
        const region = inspect(bounds, entry.revision);
        return (
          region.status === "current" &&
          region.sessionId === submission.sessionId &&
          region.frame === submission.frame &&
          region.viewGeneration === submission.viewGeneration
        );
      })
    )
      return false;
    const details = {
      sessionId: entry.sessionId,
      frame: submission.frame,
      viewGeneration: submission.viewGeneration,
      revision: entry.revision,
      gestureId: entry.gestureId,
    };
    if (entry.intervalId !== undefined)
      this.mark("brush-submit", `${entry.intervalId}.${submission.frame}`, {
        ...details,
        intervalId: entry.intervalId,
      });
    else
      this.mark("edit-submit", `${entry.input}.${submission.frame}`, {
        ...details,
        input: entry.input,
        sequence: entry.sequence,
        submittedAt: submission.at,
        completedAt: Math.max(entry.committedAt!, submission.at),
        completionEvidence: "commit-current-terrain-v1",
      });
    return true;
  }

  mark(kind: string, identity: string, details: Record<string, unknown>): void {
    if (!this.enabled) return;
    if (this.events.length < editorBudgets.observationEvents)
      performance.mark(`atlas.${kind}.${identity}`);
    this.event(kind, details);
  }

  read(options: ObservationOptions = {}): ObservationEvent[] {
    if (options.events === false) return [];
    return this.events
      .slice(options.sinceEvent ?? 0)
      .map((event) => ({ ...event }));
  }
}
