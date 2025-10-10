// src/apps/almanac/mode/cartographer-gateway.ts
// Gateway, der Almanac-Hooks und Travel-Panel-Updates an den Cartographer weiterleitet.

import { getEventAnchorTimestamp, type CalendarEvent, type CalendarTimestamp, type PhenomenonOccurrence } from "../domain";
import type { HookDispatchGateway, HookDispatchContext } from "../data/calendar-state-gateway";

type TravelScope = "global" | "travel";

const GLOBAL_TRAVEL_KEY = "__global__";

export type CartographerHookEvent = {
    readonly eventId: string;
    readonly calendarId: string;
    readonly occurrence: CalendarTimestamp;
    readonly title?: string;
};

export type CartographerPhenomenonHook = {
    readonly phenomenonId: string;
    readonly occurrence: CalendarTimestamp;
    readonly effects?: ReadonlyArray<unknown>;
};

export type CartographerHookPayload = {
    readonly scope: TravelScope;
    readonly travelId: string | null;
    readonly reason: "advance" | "jump" | "init";
    readonly events: ReadonlyArray<CartographerHookEvent>;
    readonly phenomena: ReadonlyArray<CartographerPhenomenonHook>;
};

export type TravelPanelLogEntry = {
    readonly kind: "event" | "phenomenon";
    readonly id: string;
    readonly title: string;
    readonly occurrenceLabel: string;
    readonly skipped?: boolean;
};

export type TravelPanelSnapshot = {
    readonly travelId: string | null;
    readonly timestampLabel?: string;
    readonly message?: string;
    readonly reason: "advance" | "jump" | "init";
    readonly lastAdvanceStep?: { readonly amount: number; readonly unit: "minute" | "hour" | "day" };
    readonly logEntries: ReadonlyArray<TravelPanelLogEntry>;
};

export type TravelPanelUpdateInput = {
    readonly travelId?: string | null;
    readonly currentTimestamp?: CalendarTimestamp | null;
    readonly triggeredEvents?: ReadonlyArray<CalendarEvent>;
    readonly triggeredPhenomena?: ReadonlyArray<PhenomenonOccurrence>;
    readonly skippedEvents?: ReadonlyArray<CalendarEvent>;
    readonly skippedPhenomena?: ReadonlyArray<PhenomenonOccurrence>;
    readonly message?: string;
    readonly lastAdvanceStep?: { readonly amount: number; readonly unit: "minute" | "hour" | "day" };
    readonly reason?: "advance" | "jump" | "init";
};

type Unsubscribe = () => void;

type HookListener = (payload: CartographerHookPayload) => void | Promise<void>;
type PanelListener = (snapshot: TravelPanelSnapshot) => void | Promise<void>;
type LifecycleListener = (travelId: string) => void | Promise<void>;

function normaliseTravelKey(travelId: string | null | undefined): string {
    return travelId ?? GLOBAL_TRAVEL_KEY;
}

function formatTimestampLabel(ts: CalendarTimestamp | null | undefined): string | undefined {
    if (!ts) return undefined;
    const base = `${ts.year}-${ts.monthId}-${String(ts.day).padStart(2, "0")}`;
    if (typeof ts.hour === "number" && typeof ts.minute === "number") {
        const hh = String(ts.hour).padStart(2, "0");
        const mm = String(ts.minute).padStart(2, "0");
        return `${base} ${hh}:${mm}`;
    }
    return base;
}

function mapEvents(
    events: ReadonlyArray<CalendarEvent> | undefined,
    skipped = false,
): ReadonlyArray<TravelPanelLogEntry> {
    if (!events || events.length === 0) {
        return [];
    }
    return events.map((event) => {
        const occurrence = getEventAnchorTimestamp(event) ?? event.date;
        return {
            kind: "event" as const,
            id: event.id,
            title: event.title,
            occurrenceLabel: formatTimestampLabel(occurrence) ?? "—",
            skipped,
        } satisfies TravelPanelLogEntry;
    });
}

function mapPhenomena(
    phenomena: ReadonlyArray<PhenomenonOccurrence> | undefined,
    skipped = false,
): ReadonlyArray<TravelPanelLogEntry> {
    if (!phenomena || phenomena.length === 0) {
        return [];
    }
    return phenomena.map((occurrence) => ({
        kind: "phenomenon" as const,
        id: occurrence.phenomenonId,
        title: occurrence.title ?? occurrence.phenomenonId,
        occurrenceLabel: formatTimestampLabel(occurrence.timestamp) ?? "—",
        skipped,
    } satisfies TravelPanelLogEntry));
}

export class CartographerHookGateway implements HookDispatchGateway {
    private readonly hookListeners = new Set<HookListener>();
    private readonly panelListeners = new Map<string, Set<PanelListener>>();
    private readonly lifecycleStart = new Set<LifecycleListener>();
    private readonly lifecycleEnd = new Set<LifecycleListener>();
    private readonly latestSnapshots = new Map<string, TravelPanelSnapshot>();

    onHookDispatched(listener: HookListener): Unsubscribe {
        this.hookListeners.add(listener);
        return () => this.hookListeners.delete(listener);
    }

    onTravelStart(listener: LifecycleListener): Unsubscribe {
        this.lifecycleStart.add(listener);
        return () => this.lifecycleStart.delete(listener);
    }

    onTravelEnd(listener: LifecycleListener): Unsubscribe {
        this.lifecycleEnd.add(listener);
        return () => this.lifecycleEnd.delete(listener);
    }

    onPanelUpdate(travelId: string | null, listener: PanelListener): Unsubscribe {
        const key = normaliseTravelKey(travelId);
        if (!this.panelListeners.has(key)) {
            this.panelListeners.set(key, new Set());
        }
        const listeners = this.panelListeners.get(key)!;
        listeners.add(listener);
        const snapshot = this.latestSnapshots.get(key);
        if (snapshot) {
            void listener(snapshot);
        }
        return () => {
            const set = this.panelListeners.get(key);
            set?.delete(listener);
            if (set && set.size === 0) {
                this.panelListeners.delete(key);
            }
        };
    }

    emitTravelStart(travelId: string): void {
        const key = normaliseTravelKey(travelId);
        for (const listener of this.lifecycleStart) {
            void listener(key === GLOBAL_TRAVEL_KEY ? null : travelId);
        }
    }

    emitTravelEnd(travelId: string): void {
        const key = normaliseTravelKey(travelId);
        for (const listener of this.lifecycleEnd) {
            void listener(key === GLOBAL_TRAVEL_KEY ? null : travelId);
        }
    }

    getPanelSnapshot(travelId: string | null): TravelPanelSnapshot | null {
        const key = normaliseTravelKey(travelId);
        return this.latestSnapshots.get(key) ?? null;
    }

    reset(): void {
        this.latestSnapshots.clear();
        this.panelListeners.clear();
        this.hookListeners.clear();
        this.lifecycleStart.clear();
        this.lifecycleEnd.clear();
    }

    async dispatchHooks(
        events: ReadonlyArray<CalendarEvent>,
        phenomena: ReadonlyArray<PhenomenonOccurrence>,
        context: HookDispatchContext,
    ): Promise<void> {
        if (this.hookListeners.size === 0) {
            return;
        }
        const payload: CartographerHookPayload = {
            scope: context.scope,
            travelId: context.travelId ?? null,
            reason: context.reason ?? "advance",
            events: events.map((event) => ({
                eventId: event.id,
                calendarId: event.calendarId,
                occurrence: getEventAnchorTimestamp(event) ?? event.date,
                title: event.title,
            } satisfies CartographerHookEvent)),
            phenomena: phenomena.map((occurrence) => ({
                phenomenonId: occurrence.phenomenonId,
                occurrence: occurrence.timestamp,
                effects: occurrence.effects,
            } satisfies CartographerPhenomenonHook)),
        };
        for (const listener of this.hookListeners) {
            await listener(payload);
        }
    }

    async notifyTravelPanel(update: TravelPanelUpdateInput): Promise<void> {
        const key = normaliseTravelKey(update.travelId);
        const snapshot: TravelPanelSnapshot = {
            travelId: key === GLOBAL_TRAVEL_KEY ? null : update.travelId ?? null,
            timestampLabel: formatTimestampLabel(update.currentTimestamp),
            message: update.message,
            reason: update.reason ?? "advance",
            lastAdvanceStep: update.lastAdvanceStep,
            logEntries: [
                ...mapEvents(update.triggeredEvents, false),
                ...mapPhenomena(update.triggeredPhenomena, false),
                ...mapEvents(update.skippedEvents, true),
                ...mapPhenomena(update.skippedPhenomena, true),
            ],
        };
        this.latestSnapshots.set(key, snapshot);
        const listeners = this.panelListeners.get(key);
        if (!listeners || listeners.size === 0) {
            return;
        }
        for (const listener of listeners) {
            await listener(snapshot);
        }
    }
}

export const cartographerHookGateway = new CartographerHookGateway();

