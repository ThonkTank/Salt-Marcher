/*
 * EventBus.ts – leichter Pub/Sub-Bus für Salt Marcher (Feature 6)
 * - Typsicher über ein generisches EventMap
 * - ausgiebige Debug-Logs (Namespace "Bus")
 */
import { createLogger } from "./logger";

export type Unsub = () => void;

// Zentrale Event-Payloads für P0
export interface EventMap {
  "clock:advanced": { prevISO: string; nextISO: string; deltaMin: number; traceId?: string };
  "clock:hourlyTick": { tickISO: string; tickIndex: number; traceId?: string };
  "route:computed": { totalMin: number; segments: any[]; seed?: string; traceId?: string };
  "route:applied": { totalMin: number; nextISO: string; traceId?: string };
}

type Listener<P> = (payload: P) => void;

export class EventBus<E extends Record<string, any>> {
  private listeners: Map<keyof E, Set<Function>> = new Map();
  private log = createLogger("Bus");

  on<K extends keyof E>(event: K, fn: Listener<E[K]>): Unsub {
    const set = this.listeners.get(event) ?? new Set();
    set.add(fn as any);
    this.listeners.set(event, set);
    this.log.debug("on", { event: String(event), listeners: set.size });
    return () => this.off(event, fn as any);
  }

  once<K extends keyof E>(event: K, fn: Listener<E[K]>): Unsub {
    const wrap = (p: E[K]) => {
      try { (fn as any)(p); } finally { this.off(event, wrap as any); }
    };
    return this.on(event, wrap as any);
  }

  off<K extends keyof E>(event: K, fn: Listener<E[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(fn as any);
    this.log.debug("off", { event: String(event), listeners: set.size });
    if (set.size === 0) this.listeners.delete(event);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.listeners.get(event);
    const count = set?.size ?? 0;
    this.log.debug("emit", { event: String(event), keys: Object.keys(payload ?? {}), listeners: count, payload });
    if (!set || count === 0) return;
    for (const fn of Array.from(set)) {
      try { (fn as any)(payload); }
      catch (err) { this.log.warn("emit.listenerError", { event: String(event), err }); }
    }
  }

  count<K extends keyof E>(event?: K): number {
    if (!event) return Array.from(this.listeners.values()).reduce((a,s)=>a+s.size, 0);
    return this.listeners.get(event)?.size ?? 0;
  }
}
