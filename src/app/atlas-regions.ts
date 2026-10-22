import { atlasElement as get, setAtlasText as setText } from './atlas-dom';
import type { AtlasJourney } from './atlas-journey';
import { TerrainPresentation, type TerrainIdentity } from './terrain-presentation';
import type { TerrainSpatialUI } from './terrain-spatial-ui';
import { atlasFieldValue } from './atlas-units';
import type { AtlasRegionQuery } from './atlas-region-contracts';
import { atlasGeometryOnly } from './atlas-render-view';
import type { LandscapeWorkbench } from "./atlas-landscape-ui";
import type { AtlasCanvas } from "./atlas-canvas";
import type { AtlasRenderView } from "./campaign-atlas-contracts";
import type { WorkspaceGeometry } from "./contracts";
interface AtlasRegionsHost {
    readonly spatial: Pick<TerrainSpatialUI, "needsTerrainRaster" | "openSurface"> | undefined;
    readonly camera: Pick<AtlasCanvas, "view" | "destination">;
    readonly canvas: HTMLCanvasElement;
    readonly scopeId: string | null;
    readonly floorId: string;
    readonly journey: Pick<AtlasJourney, "entranceId" | "localPreview" | "travelReadState" | "previewRequest" | "playback" | "renderTravel">;
    readonly landscape: Pick<LandscapeWorkbench, "contours" | "livePainting" | "load">;
    readonly scheduleRender: () => void;
    readonly root: HTMLElement;
    readonly owner: WorkspaceGeometry | null;
    terrainAuthor: TerrainIdentity | null;
    readonly terrainPresentation: TerrainPresentation | null;
    hitVersion: number;
    readonly hitDialog: HTMLDialogElement;
    readonly render: (preview?: boolean) => void;
    readonly error: (error: unknown) => void;
    readonly opts: {
        flush: () => Promise<boolean>;
        status: (text: string, error?: boolean) => void;
    };
}
/** Owns region reads, source publication and geometry readiness. */
export class AtlasRegions {
    constructor(private host: AtlasRegionsHost) { }
    /** Invalidate replies before releasing the old campaign's read lane. */
    cancel() {
        this.request++;
        this.openingSurface = null;
        if (this.regionTimer !== null)
            clearTimeout(this.regionTimer);
        this.regionTimer = null;
        this.loadedRegionQuery = null;
        this.regionReading = null;
        this.regionReadingQuery = null;
        if (this.host.owner)
            void window.campaign.cancelAtlasRegion(this.host.owner.token);
    }
    projection: AtlasRenderView | null = null;
    get data() { return this.projection; }
    set data(value: AtlasRenderView | null) { this.projection = value ? atlasGeometryOnly(value) : null; }
    request = 0;
    regionTimer: ReturnType<typeof setTimeout> | null = null;
    loadedRegionQuery: AtlasRegionQuery | null = null;
    regionReading: number | null = null;
    regionReadingQuery: AtlasRegionQuery | null = null;
    regionQuery(buffered = false): AtlasRegionQuery {
        const terrainRaster = this.host.spatial?.needsTerrainRaster ?? true;
        const box = buffered ? this.host.camera.destination : this.host.camera.view, width = Math.max(1, Math.min(4096, Math.round(this.host.canvas.clientWidth) || 1024)), height = Math.max(1, Math.min(4096, Math.round(this.host.canvas.clientHeight) || 768));
        return { box: buffered ? { x: box.x - box.width / 2, y: box.y - box.height / 2, width: box.width * 2, height: box.height * 2 } : box, width: width * (buffered ? 2 : 1), height: height * (buffered ? 2 : 1), scopeId: this.host.scopeId, floorId: this.host.floorId, entranceId: this.host.journey.entranceId ?? undefined, slice: get<HTMLInputElement>('atlas-slice-enabled').checked ? Number(atlasFieldValue(get<HTMLInputElement>('atlas-slice'))) : null, roofs: get<HTMLInputElement>('atlas-roofs').checked, terrainRaster, contours: terrainRaster ? this.host.landscape.contours() : 0, perception: get<HTMLInputElement>('atlas-perception').checked };
    }
    async refreshSpatialSource() {
        // A stale terrain reply must wait for the current geometry owner. Returning
        // false keeps TerrainSpatialUI's existing source-recovery latch closed until
        // that read publishes a confirmed source (or the explicit retry succeeds).
        if (this.regionReading === this.request)
            return false;
        return this.refresh();
    }
    openingSurface: {
        owner: WorkspaceGeometry;
        revision?: number;
    } | null = null;
    scheduleRegion(camera = false) {
        if (this.openingSurface && !this.data) {
            this.host.scheduleRender();
            return;
        }
        if (this.host.root.hidden || !this.host.owner)
            return;
        if (this.geometryCurrent()) {
            if (this.regionTimer) {
                clearTimeout(this.regionTimer);
                this.regionTimer = null;
            }
            const settled = this.host.root.dataset.regionState !== 'ready';
            this.host.root.dataset.regionState = 'ready';
            this.host.canvas.setAttribute('aria-busy', 'false');
            if (camera && settled)
                this.host.scheduleRender();
            return;
        }
        this.host.root.dataset.regionState = 'loading';
        this.host.canvas.setAttribute('aria-busy', 'true');
        // Keep useful buffered work during panning. A different destination scale
        // or uncovered area must reach the worker while the old read is still busy.
        if (camera) {
            const reading = this.regionReading === this.request ? this.regionReadingQuery : null, target = reading ? { ...this.regionQuery(), box: this.host.camera.destination } : null;
            if (reading && target && this.regionQueryCovers(reading, target) && Math.abs(reading.box.width / reading.width / (target.box.width / target.width) - 1) < 1e-6) {
                if (this.regionTimer) {
                    clearTimeout(this.regionTimer);
                    this.regionTimer = null;
                }
                return;
            }
            if (this.regionTimer)
                return;
        }
        if (this.regionTimer)
            clearTimeout(this.regionTimer);
        if (!camera)
            this.request++;
        this.regionTimer = setTimeout(() => { this.regionTimer = null; void this.refresh(camera); }, camera ? 120 : 60);
    }
    geometryCoversView() {
        return this.regionQueryCovers(this.loadedRegionQuery, this.regionQuery());
    }
    regionQueryCovers(old: AtlasRegionQuery | null, q: AtlasRegionQuery) {
        if (!old)
            return false;
        return old.scopeId === q.scopeId && old.floorId === q.floorId && old.slice === q.slice && old.roofs === q.roofs && old.perception === q.perception && old.terrainRaster === q.terrainRaster && old.contours === q.contours && old.box.x <= q.box.x && old.box.y <= q.box.y && old.box.x + old.box.width >= q.box.x + q.box.width && old.box.y + old.box.height >= q.box.y + q.box.height;
    }
    geometryCurrent() {
        if (this.host.terrainAuthor && this.host.terrainAuthor.revision !== this.data?.region?.revision)
            return false;
        const old = this.loadedRegionQuery, q = this.regionQuery();
        if (!old)
            return false;
        // Authoring still requires geometry at the displayed scale. During motion,
        // a matching buffered frame may be painted without authorizing stale hits.
        return this.geometryCoversView() && Math.abs(old.box.width / old.width / (q.box.width / q.width) - 1) < 1e-6;
    }
    async openTerrain(owner: WorkspaceGeometry) {
        if (this.data || !this.host.spatial || this.host.spatial.needsTerrainRaster || !window.campaign.atlasTerrainSource)
            return;
        const opening = { owner, revision: undefined as number | undefined };
        this.openingSurface = opening;
        if (this.regionTimer) {
            clearTimeout(this.regionTimer);
            this.regionTimer = null;
        }
        get('atlas-save-status').textContent = 'Gelände wird geladen…';
        try {
            const reply = await window.campaign.atlasTerrainSource(owner.token);
            if (this.openingSurface !== opening || this.host.owner !== owner || this.host.root.hidden)
                return;
            if (!reply.ok)
                return; // The complete region owns the final loading/error result.
            opening.revision = reply.value.revision;
            await this.host.spatial.openSurface(owner.token, this.host.camera.view, reply.value.revision, this.host.landscape.contours());
        }
        catch {
            // Bootstrap is optional. The complete region request reports any durable error.
        }
        finally {
            if (this.openingSurface === opening)
                this.openingSurface = null;
        }
    }
    async refresh(keepScene = false) {
        if (this.host.landscape.livePainting && this.host.terrainPresentation)
            return false;
        if (this.regionTimer) {
            clearTimeout(this.regionTimer);
            this.regionTimer = null;
        }
        const w = this.host.owner, request = ++this.request;
        if (!w)
            return;
        this.regionReading = request;
        let completed = false;
        const cameraPreview = keepScene ? this.host.journey.localPreview : null, previewFence = this.data?.region?.fence;
        const retry = this.host.journey.travelReadState === "failed";
        get("atlas-region-retry").hidden = true;
        if (!this.data)
            get("atlas-save-status").textContent = "Kartenausschnitt wird geladen…";
        this.host.hitVersion++;
        this.host.hitDialog.close();
        this.host.journey.travelReadState = "loading";
        this.loadedRegionQuery = null;
        this.host.root.dataset.regionState = 'loading';
        this.host.canvas.setAttribute('aria-busy', 'true');
        get("atlas-hint").dataset.idle = "false";
        setText("atlas-hint", this.data ? "Vorheriger Kartenstand · Ansicht wird geladen. Auswahl und Bearbeitung sind vorübergehend gesperrt." : "Ansicht wird geladen.");
        this.host.journey.previewRequest++;
        this.host.journey.localPreview = null;
        this.host.journey.playback.stop();
        if (!keepScene)
            this.host.render();
        this.host.journey.renderTravel();
        try {
            const query = this.regionQuery(true);
            this.regionReadingQuery = query;
            const r = await window.campaign.atlasRegion(w.token, query);
            if (this.host.owner !== w || request !== this.request)
                return;
            if (!r.ok)
                throw new Error(r.error);
            this.host.hitVersion++;
            this.host.hitDialog.close();
            this.data = r.value;
            this.host.terrainAuthor = null;
            this.host.canvas.dataset.atlasRegionRevision = String(r.value.region.revision);
            this.loadedRegionQuery = query;
            this.host.canvas.dataset.atlasTerrainRaster = String(query.terrainRaster !== false);
            this.host.canvas.dataset.atlasLandscapeTiles = String(r.value.region.landscape?.tiles.length ?? 0);
            void this.host.landscape.load().catch(e => this.host.error(e));
            this.host.root.dataset.regionState = 'ready';
            this.host.canvas.setAttribute('aria-busy', 'false');
            get("atlas-hint").textContent = r.value.region.coverage.mode === 'raster' ? "Dichte Kartengeometrie als Bild · Auswahl liest das genaue Objekt. Weiter hineinzoomen für Konturwerkzeuge." : "Zoome von der Landschaft bis zum Innenraum. Ziehen verschiebt die Ansicht.";
            if (r.value.region.coverage.unreadable)
                get("atlas-hint").textContent += ` ${r.value.region.coverage.unreadable} beschädigte Karteneinträge bleiben unverändert.`;
            const layer = r.value.region.landscape;
            if (layer?.state === 'error')
                get('atlas-hint').textContent += ' Landschaft nicht verfügbar. Ansicht erneut laden; übrige Karte bleibt nutzbar.';
            else if (layer?.coverage.mode === 'raster')
                get('atlas-hint').textContent += ' Dichte Landschaft als Übersicht; genaue Auswahl per Klick.' + (layer.coverage.references > layer.records.filter(r => r.kind === 'reference').length ? ' Bildvorlagen als Umrisse.' : '');
            get("atlas-hint").dataset.idle = String(get("atlas-hint").textContent === "Zoome von der Landschaft bis zum Innenraum. Ziehen verschiebt die Ansicht.");
            this.host.journey.travelReadState = "ready";
            if (get("atlas-save-status").textContent === "Kartenausschnitt wird geladen…")
                get("atlas-save-status").textContent = "Kartenausschnitt geladen";
            if (retry) {
                get("atlas-save-status").textContent = "Reisekontext aktualisiert";
                get("atlas-save-status").dataset.error = "false";
                this.host.opts.status("Reisekontext aktualisiert");
            }
            // Camera reads do not change the intended route. Restore it only after
            // confirming exactly the same source; pending/failed reads stay locked.
            if (cameraPreview && previewFence && r.value.region.fence === previewFence)
                this.host.journey.localPreview = cameraPreview;
            completed = true;
            this.host.render(keepScene);
            return true;
        }
        catch (e) {
            if (this.host.owner === w && request === this.request) {
                this.host.journey.travelReadState = "failed";
                this.host.root.dataset.regionState = 'failed';
                this.host.canvas.setAttribute('aria-busy', 'false');
                this.host.error(e);
                get("atlas-region-retry").hidden = false;
                get("atlas-hint").textContent = "Ansicht nicht verfügbar. Vorheriger Kartenstand; erneut laden.";
                this.host.journey.renderTravel();
            }
            return false;
        }
        finally {
            if (this.regionReading === request) {
                this.regionReading = null;
                this.regionReadingQuery = null;
            }
            if (completed && this.host.owner === w && request === this.request && !this.geometryCurrent())
                this.scheduleRegion(true);
        }
    }
}
