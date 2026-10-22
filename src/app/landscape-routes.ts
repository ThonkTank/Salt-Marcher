import type { LandscapeHost, LandscapeTool as Tool } from './landscape-workbench-types';
import { openTerrainRoute } from './terrain-route-ui';
import type { AtlasAction } from "./campaign-atlas-contracts";
import type { Point } from "./contracts";
import { type LandscapeRecord } from "./atlas-landscape";
interface LandscapeRoutesHost {
    readonly tool: Tool;
    readonly hasDraft: (includeRoute?: boolean) => boolean;
    readonly say: (message: string) => void;
    selected: LandscapeRecord | null;
    readonly selectionRecords: Map<string, LandscapeRecord>;
    readonly inspectorRoot: HTMLElement;
    readonly effects: Pick<LandscapeHost, 'box' | 'current' | 'navigate' | 'navigation' | 'planning' | 'redraw' | 'refresh'>;
    readonly token: string;
    readonly panel: HTMLElement;
    readonly canvas: HTMLCanvasElement;
    readonly point: (event: MouseEvent) => Point;
    readonly hit: (event: MouseEvent, keys: string[]) => {
        data: Record<string, string>;
    } | null;
    readonly spacePan: boolean;
    readonly commit: (action: AtlasAction) => Promise<unknown>;
}
/** Owns the route planning session and its temporary preview. */
export class LandscapeRoutes {
    constructor(private host: LandscapeRoutesHost) { }
    close() {
        // Invalidate before close: callbacks from an old session cannot clear a successor.
        this.routeGeneration++;
        const session = this.routeSession;
        this.routeSession = undefined;
        this.routeOpening = false;
        this.routeRecords = undefined;
        this.routeAnchors = [];
        session?.close();
    }
    routeSession: Awaited<ReturnType<typeof openTerrainRoute>> | undefined;
    routeOpening = false;
    routeGeneration = 0;
    routeRecords: LandscapeRecord[] | undefined;
    routeAnchors: Point[] = [];
    get routeGesture() { return !!this.routeSession?.gesturing(); }
    routeHistory(kind: 'undo' | 'redo') { if (!this.routeSession)
        return false; this.routeSession.history(kind); return true; }
    planTerrainRoute(kind: 'road' | 'river') { return this.openRoute(undefined, kind); }
    async openRoute(record?: LandscapeRecord, kind: 'road' | 'river' = record?.kind === 'river' || this.host.tool === 'river' ? 'river' : 'road') {
        if (this.host.hasDraft()) {
            this.host.say('Zuerst abschließen oder verwerfen.');
            return;
        }
        this.close();
        this.host.selected = null;
        this.host.selectionRecords.clear();
        this.host.inspectorRoot.replaceChildren();
        this.host.effects.planning?.();
        this.routeOpening = true;
        const generation = ++this.routeGeneration;
        try {
            const session = openTerrainRoute({ token: this.host.token, box: () => this.host.effects.box(), record, kind,
                panel: this.host.panel, canvas: this.host.canvas, point: e => this.host.point(e), hit: (e, keys) => this.host.hit(e, keys),
                navigation: e => this.host.effects.navigation?.(e) ?? (e.button !== 0 || e.altKey || this.host.spacePan), current: () => this.host.effects.current?.() ?? true,
                navigate: b => this.host.effects.navigate?.(b), write: a => this.host.commit(a), changed: () => this.host.effects.refresh?.() ?? Promise.resolve(),
                preview: (records, anchors) => { if (generation !== this.routeGeneration)
                    return; this.routeRecords = records; this.routeAnchors = anchors.map(p => ({ ...p })); this.host.effects.redraw(); },
                closed: () => { if (generation !== this.routeGeneration)
                    return; this.routeSession = undefined; this.routeRecords = undefined; this.routeAnchors = []; this.host.effects.redraw(); },
            });
            if (generation !== this.routeGeneration)
                session.close();
            else
                this.routeSession = session;
            await session.ready;
        }
        finally {
            if (generation === this.routeGeneration)
                this.routeOpening = false;
        }
    }
}
