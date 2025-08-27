/*
 * Clock.ts – persistente Kampagnenzeit + Ticks (Feature 6)
 */
import type { Plugin } from "obsidian";
import { createLogger } from "./logger";
import { EventBus, type EventMap } from "./EventBus";

function toISO(d: Date): string {
  return new Date(d.getTime() - d.getMilliseconds()).toISOString().replace(/\.\d{3}Z$/, "Z");
}
function parseISO(iso?: string | null): Date | null {
  if (!iso || typeof iso !== "string") return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t) : null;
}
function clampFloorToHour(d: Date): Date {
  const x = new Date(d);
  x.setUTCMinutes(0, 0, 0);
  return x;
}

export class Clock {
  private nowISO: string;
  private log = createLogger("Clock");

  constructor(
    private plugin: Plugin,
    private bus: EventBus<EventMap>,
    initialISO?: string
  ) {
    const start = parseISO(initialISO) ?? new Date();
    this.nowISO = toISO(start);
    this.log.info("ctor", { initialISO: this.nowISO });
  }

  async initFromStorage(startISO?: string, autoStartNow: boolean = true): Promise<void> {
    try {
      const data = await this.plugin.loadData();
      const saved = data?.clock?.nowISO as string | undefined;
      let use = parseISO(saved) ?? parseISO(startISO) ?? (autoStartNow ? new Date() : new Date("2025-01-01T00:00:00Z"));
      this.nowISO = toISO(use);
      this.log.info("initFromStorage", { saved, startISO, autoStartNow, now: this.nowISO });
    } catch (err) {
      this.log.warn("initFromStorage.failed", { err: String(err) });
    }
  }

  now(): string { return this.nowISO; }

  set(iso: string, traceId?: string): void {
    const d = parseISO(iso);
    if (!d) {
      this.log.warn("set.invalidISO", { iso });
      return;
    }
    const prevISO = this.nowISO;
    this.nowISO = toISO(d);
    this.persist().catch((err)=>this.log.error("persist.failed", { err }));
    this.bus.emit("clock:advanced", { prevISO, nextISO: this.nowISO, deltaMin: diffMin(prevISO, this.nowISO), traceId });
    this._emitHourlyTicks(prevISO, this.nowISO, traceId);
    this.log.info("set", { prevISO, nextISO: this.nowISO, traceId });
  }

  advanceBy(minutes: number, traceId?: string): { prevISO: string; nextISO: string; hoursCrossed: string[] } {
    if (!Number.isFinite(minutes) || minutes < 0) {
      this.log.warn("advanceBy.invalidDelta", { minutes });
      return { prevISO: this.nowISO, nextISO: this.nowISO, hoursCrossed: [] };
    }
    const prevISO = this.nowISO;
    const prev = parseISO(prevISO)!;
    const next = new Date(prev.getTime() + Math.round(minutes) * 60_000);
    const nextISO = toISO(next);
    this.nowISO = nextISO;
    this.persist().catch((err)=>this.log.error("persist.failed", { err }));
    this.bus.emit("clock:advanced", { prevISO, nextISO, deltaMin: Math.round(minutes), traceId });
    const hoursCrossed = this._emitHourlyTicks(prevISO, nextISO, traceId);
    this.log.info("advanceBy", { prevISO, nextISO, deltaMin: Math.round(minutes), hoursCrossed: hoursCrossed.length, traceId });
    return { prevISO, nextISO, hoursCrossed };
  }

  advanceByTravel(totalMin: number, traceId?: string): void {
    const { nextISO } = this.advanceBy(totalMin, traceId);
    this.bus.emit("route:applied", { totalMin, nextISO, traceId });
  }

  private _emitHourlyTicks(prevISO: string, nextISO: string, traceId?: string): string[] {
    const from = parseISO(prevISO)!;
    const to = parseISO(nextISO)!;
    const ticks: string[] = [];
    // Start bei nächster vollen Stunde nach "from"
    const startHour = clampFloorToHour(new Date(from.getTime() + 60 * 60 * 1000));
    for (let t = startHour; t <= to; t = new Date(t.getTime() + 60 * 60 * 1000)) {
      const tickISO = toISO(t);
      if (t > from && t <= to) {
        ticks.push(tickISO);
        this.bus.emit("clock:hourlyTick", { tickISO, tickIndex: ticks.length - 1, traceId });
        this.log.debug("hourlyTick", { tickISO, traceId });
      }
    }
    return ticks;
  }

  private async persist(): Promise<void> {
    try {
      const data = await this.plugin.loadData() || {};
      data.clock = data.clock || {};
      (data.clock as any).nowISO = this.nowISO;
      await this.plugin.saveData(data);
    } catch (err) {
      this.log.error("persist.exception", { err });
    }
  }
}

function diffMin(aISO: string, bISO: string): number {
  const a = Date.parse(aISO);
  const b = Date.parse(bISO);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN as any;
  return Math.round((b - a) / 60000);
}
