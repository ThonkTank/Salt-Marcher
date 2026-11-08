import { editorBudgets } from "./budgets";

export interface ObservationEvent {
  kind: string;
  at: number;
  [key: string]: unknown;
}

/** Observes the product. It cannot complete a render, make sources ready, or edit. */
export class Observation {
  private events: ObservationEvent[] = [];
  private serial = 0;
  dropped = 0;

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
    this.event("input", { id, inputKind: kind, createdAt });
    return id;
  }

  mark(kind: string, identity: string, details: Record<string, unknown>): void {
    performance.mark(`atlas.${kind}.${identity}`);
    this.event(kind, details);
  }

  read(): ObservationEvent[] {
    return this.events.map((event) => ({ ...event }));
  }
}
