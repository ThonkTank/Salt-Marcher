import type { LandscapeHost } from './landscape-workbench-types';
import { TerrainLiveStroke } from './terrain-live-stroke';
import { type HeightStroke } from './terrain-brush';
import type { LandscapeToolSettings } from "./landscape-tool-settings";
import { pendingAtlasWrite } from "./campaign-atlas-author";
import type { Point } from "./contracts";
import { type LandscapeRecord } from "./atlas-landscape";
interface LandscapeBrushSessionHost {
    readonly effects: Pick<LandscapeHost, 'data' | 'error' | 'previewHeight' | 'redraw' | 'terrainGesture' | 'writeTerrain'>;
    pointer: number | null;
    readonly disable: (disabled: boolean) => void;
    readonly say: (message: string) => void;
    readonly lastPoint: Point;
    points: Point[];
    readonly colorRecord: () => LandscapeRecord;
    saving: boolean;
    brushStrokes: Point[][];
    draftSeed: number;
    readonly token: string;
    heightPreviewM: number | null;
    readonly active: boolean;
    readonly hovering: boolean;
    readonly cursorHeight: () => void;
}
/** Owns live brush sampling, frame scheduling and stroke completion. */
export class LandscapeBrushSession {
    constructor(private host: LandscapeBrushSessionHost) { }
    maskStroke: HeightStroke | null = null;
    colorDraft: ReturnType<LandscapeToolSettings['color']> | null = null;
    maskStart = 0;
    maskGeneration = 0;
    liveFrame: number | undefined;
    liveWriteRequested = false;
    maskTimer: ReturnType<typeof setTimeout> | undefined;
    live: TerrainLiveStroke | null = null;
    liveColorCount = 0;
    liveId = "";
    get livePainting() { return this.live !== null; }
    startLive() {
        const data = this.host.effects.data();
        if (!data?.region)
            throw Error('Kartenausschnitt fehlt. Erneut laden.');
        this.host.effects.terrainGesture(true);
        this.liveId = crypto.randomUUID();
        this.liveColorCount = 0;
        this.liveFailureMessage = undefined;
        this.live = new TerrainLiveStroke({ id: this.liveId, expectedRevision: data.revision, sourceFence: data.region.fence }, (a, c) => this.host.effects.writeTerrain(a, c), error => {
            this.liveFailureMessage = error instanceof Error ? error.message : String(error);
            this.host.pointer = null;
            clearTimeout(this.maskTimer);
            void this.finishLive(true);
            this.host.effects.error(error);
        }, () => this.scheduleLive());
        this.host.disable(true);
        this.host.say('Pinsel arbeitet direkt. Rückgängig nimmt den ganzen Zug zurück.');
        // Sample the first real elapsed frame, just like subsequent stationary
        // samples. A near-zero pointerdown dose can commit without changing a pixel.
        // Releasing before that frame still flushes the actual elapsed input below.
        this.scheduleLive();
    }
    sampleHeight() {
        if (this.maskStroke && this.host.pointer !== null && this.maskStroke.samples.length < 20000) {
            const last = this.maskStroke.samples.at(-1)!;
            this.maskStroke.samples.push({ ...this.host.lastPoint, t: Math.min(300000, Math.max(last.t, performance.now() - this.maskStart)) });
        }
    }
    sampleLive(write = true) {
        this.sampleHeight();
        if (this.maskStroke)
            this.host.effects.previewHeight?.(this.maskStroke);
        if (!this.live || !write)
            return;
        if (this.maskStroke)
            this.live.update({ kind: 'landscape-height-stroke', stroke: this.maskStroke });
        else if (this.host.points.length !== this.liveColorCount) {
            const record = this.host.colorRecord();
            record.id = this.liveId;
            this.liveColorCount = this.host.points.length;
            this.live.update({ kind: 'landscape-color-stroke', record });
        }
    }
    liveFailureMessage: string | undefined;
    tickLive() {
        this.liveFrame = undefined;
        const write = this.liveWriteRequested;
        this.liveWriteRequested = false;
        this.sampleLive(write);
        // Stationary height feedback continues while storage is occupied. Input
        // and returning write capacity join this frame instead of drawing twice.
        if (this.maskStroke)
            this.scheduleLive(false);
    }
    scheduleLive(write = true) {
        if (!this.live || this.host.pointer === null)
            return;
        this.liveWriteRequested ||= write;
        if (this.liveFrame !== undefined)
            return;
        this.liveFrame = requestAnimationFrame(() => this.tickLive());
    }
    endLiveInput() {
        if (this.liveFrame !== undefined)
            cancelAnimationFrame(this.liveFrame);
        this.liveFrame = undefined;
        this.liveWriteRequested = false;
        if (this.maskStroke && this.host.pointer !== null)
            this.maskStroke.samples.push({ ...this.host.lastPoint, t: Math.min(300000, Math.max(this.maskStroke.samples.at(-1)!.t, performance.now() - this.maskStart)) });
        this.host.pointer = null;
        clearTimeout(this.maskTimer);
    }
    async finishLive(stop = false) {
        const live = this.live;
        if (!live || this.host.saving)
            return;
        this.endLiveInput();
        if (!stop)
            this.sampleLive();
        this.host.saving = true;
        let failed = stop;
        try {
            if (stop)
                await live.stop();
            else
                await live.finish();
        }
        catch {
            failed = true; /* The writer already surfaced the error and owns unknown-outcome recovery. */
        }
        finally {
            if (this.live === live) {
                try {
                    await this.host.effects.terrainGesture(false);
                }
                catch (error) {
                    failed = true;
                    this.liveFailureMessage = error instanceof Error ? error.message : String(error);
                    this.host.effects.error(error);
                }
                finally {
                    this.live = null;
                    this.host.saving = false;
                }
                this.clearMask();
                this.host.points = [];
                this.host.brushStrokes = [];
                this.host.draftSeed = crypto.getRandomValues(new Uint32Array(1))[0]!;
                this.host.saving = false;
                const pending = !!pendingAtlasWrite(this.host.token);
                this.host.disable(pending);
                const saved = pending ? 'Speicherstand des Pinselzugs noch ungeklärt.' : live.hasCommittedChanges ? 'Gespeicherte Änderungen bleiben; Rückgängig nimmt den Zug zurück.' : 'Keine Änderung dieses Pinselzugs gespeichert.';
                this.host.say(failed ? (this.liveFailureMessage ? this.liveFailureMessage + ' ' : '') + 'Pinsel gestoppt. ' + saved : 'Gespeichert');
                this.host.effects.redraw();
            }
        }
    }
    clearMask() { clearTimeout(this.maskTimer); this.maskGeneration++; this.host.heightPreviewM = null; this.maskStroke = null; this.colorDraft = null; if (this.host.active && this.host.hovering)
        this.host.cursorHeight(); }
}
