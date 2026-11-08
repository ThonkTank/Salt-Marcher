import { editorBudgets } from "./budgets";

export interface ObservationEvent {
  kind: string;
  at: number;
  [key: string]: unknown;
}

export interface ObservationOptions {
  /** Omit journal entries from this read without changing the retained journal. */
  events?: boolean;
  /** Return entries starting at this zero-based journal index. */
  sinceEvent?: number;
}

/** Observes the product. It cannot complete a render, make sources ready, or edit. */
export class Observation {
  private events: ObservationEvent[] = [];
  private serial = 0;
  dropped = 0;

  get eventCount(): number {
    return this.events.length;
  }

  get lastInputId(): number {
    return this.serial;
  }

  event(kind: string, details: Record<string, unknown> = {}): void {
    if (this.events.length >= editorBudgets.observationEvents) {
      this.dropped++;
      return;
    }
    this.events.push({ kind, at: performance.now(), ...details });
  }

  input(event: Event, kind: string): number {
    const id = ++this.serial;
    // Event timestamps precede dispatch; handler-start-only timings hide queues.
    const createdAt =
      event.timeStamp > performance.timeOrigin
        ? event.timeStamp - performance.timeOrigin
        : event.timeStamp;
    performance.mark(`atlas.input.${id}`);
    this.event("input", {
      id,
      inputKind: kind,
      eventType: event.type,
      createdAt,
    });
    return id;
  }

  mark(kind: string, identity: string, details: Record<string, unknown>): void {
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
