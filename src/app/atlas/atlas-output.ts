import { terrainCoverageBox, terrainCoverageLevel } from './terrain-coverage';
import { atlasElement as get } from './atlas-dom';
import { atlasTerrainExport } from './atlas-terrain-export';
import type { AtlasRasterPresentation } from './atlas-raster-presentation';
import { lengthLabel, atlasUnits } from './atlas-units';
import type { AtlasWorkspaceLayout } from './atlas-workspace-layout';
import type { AtlasReferenceUI } from './atlas-reference-ui';
import type { AtlasRegionQuery } from './atlas-region-contracts';
import type { LandscapeWorkbench } from './atlas-landscape-ui';
import { atlasExportScale, dungeonExportBox } from './campaign-atlas-export';
import type { CanvasBox } from '../passive-map-canvas';
import type { AtlasCanvas } from './atlas-canvas';
import type { AtlasRenderView } from './campaign-atlas-contracts';
import type { WorkspaceGeometry, Point } from '../contracts';
interface AtlasOutputHost {
  readonly reference: Pick<AtlasReferenceUI, 'active' | 'close'>;
  readonly flush: () => Promise<boolean>;
  readonly opts: {
    flush: () => Promise<boolean>;
    status: (text: string, error?: boolean) => void;
  };
  readonly root: HTMLElement;
  readonly family: string;
  readonly layout: Pick<AtlasWorkspaceLayout, 'output'>;
  readonly landscape: Pick<LandscapeWorkbench, 'setActive' | 'contours'>;
  invalidateGeometry: () => void;
  readonly render: (preview?: boolean) => void;
  readonly owner: WorkspaceGeometry | null;
  readonly error: (error: unknown) => void;
  readonly data: AtlasRenderView | null;
  readonly scopeId: string | null;
  readonly floorId: string;
  readonly canvas: HTMLCanvasElement;
  readonly camera: Pick<AtlasCanvas, 'view' | 'set'>;
  readonly geometryCurrent: () => boolean;
  readonly spatial: Pick<AtlasRasterPresentation, 'active' | 'visibility'> | undefined;
  readonly regionQuery: (buffered?: boolean) => AtlasRegionQuery;
}
/** Owns output selection and one cancellable export request. */
export class AtlasOutput {
  constructor(private host: AtlasOutputHost) {}
  cancel() {
    if (!this.outputRun) return;
    this.outputRun.cancelled = true;
    if (this.host.owner) void window.campaign.cancelAtlasRegion(this.host.owner.token, 'export');
  }
  reset() {
    this.cancel();
    this.outputRun = null;
    this.exportBox = null;
    this.exportDungeon = false;
    this.exportDrag = null;
    this.exportCorner = null;
    this.exportChoosing = false;
    this.exportOpen = false;
    this.host.root.dataset.output = 'false';
    get('atlas-output').hidden = true;
    get('atlas-output-open').setAttribute('aria-pressed', 'false');
    this.host.layout?.output(false);
    get<HTMLButtonElement>('atlas-export-png').disabled = false;
    get<HTMLButtonElement>('atlas-output-save-campaign').disabled = false;
    get('atlas-export-cancel').hidden = true;
  }
  outputRun: {
    cancelled: boolean;
  } | null = null;
  get exporting() {
    return this.outputRun !== null;
  }
  exportOpen = false;
  exportChoosing = false;
  exportBox: CanvasBox | null = null;
  exportDungeon = false;
  exportCorner: Point | null = null;
  exportDrag: {
    id: number;
    start: Point;
    last: Point;
    x: number;
    y: number;
    moved: boolean;
  } | null = null;
  cancelAreaSelection() {
    this.exportDrag = null;
    this.exportCorner = null;
    this.exportChoosing = false;
    this.exportAreaStatus();
  }
  chooseArea() {
    if (this.exporting) return;
    this.exportDungeon = false;
    this.exportChoosing = true;
    this.exportCorner = null;
    this.exportAreaStatus();
    this.host.canvas.focus();
  }
  useViewport() {
    if (this.exporting) return;
    this.exportDungeon = false;
    this.exportBox = null;
    this.cancelAreaSelection();
    this.host.render();
  }
  useDungeon() {
    if (this.exporting || !this.host.geometryCurrent()) return;
    const box = this.dungeonOutputBox();
    if (!box) return;
    this.exportBox = null;
    this.exportDungeon = true;
    this.cancelAreaSelection();
    this.frameOutput(box);
    this.host.render();
  }
  beginArea(event: PointerEvent, point: Point) {
    if (!this.exportChoosing || this.exporting) return;
    this.exportDrag = {
      id: event.pointerId,
      start: point,
      last: point,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    this.host.canvas.setPointerCapture(event.pointerId);
  }
  moveArea(event: PointerEvent, point: Point) {
    const drag = this.exportDrag;
    if (drag?.id !== event.pointerId) return false;
    drag.last = point;
    drag.moved ||= Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 4;
    this.host.render();
    return true;
  }
  endArea(event: PointerEvent, end: Point) {
    const drag = this.exportDrag;
    if (drag?.id !== event.pointerId) return false;
    this.exportDrag = null;
    const start = drag.moved ? drag.start : this.exportCorner;
    const box = start ? this.exportRectangle(start, end) : null;
    if (box && box.width > 0 && box.height > 0) {
      this.exportDungeon = false;
      this.exportBox = box;
      this.exportChoosing = false;
      this.exportCorner = null;
    } else this.exportCorner = end;
    this.exportAreaStatus();
    this.host.render();
    return true;
  }
  async setOutput(open: boolean) {
    if (this.host.reference.active) this.host.reference.close();
    if (open && (!(await this.host.flush()) || !(await this.host.opts.flush()))) return;
    if (this.exporting) return;
    this.host.root.dataset.output = String(open);
    if (open && this.exportDungeon && !['interior', 'decoration'].includes(this.host.family)) {
      this.exportDungeon = false;
      this.exportBox = null;
    }
    this.exportOpen = open;
    this.exportChoosing = false;
    this.exportDrag = null;
    this.exportCorner = null;
    get('atlas-output').hidden = !open;
    this.host.layout?.output(open);
    get('atlas-output-open').setAttribute('aria-pressed', String(open));
    this.host.landscape.setActive(!open && this.host.family === 'terrain');
    this.host.invalidateGeometry();
    this.host.render();
    if (open && this.exportDungeon) {
      const b = this.dungeonOutputBox();
      if (b) this.frameOutput(b);
    }
    this.exportAreaStatus();
    get(open ? 'atlas-export-kind' : 'atlas-output-open').focus();
  }
  async saveEditableCampaign() {
    if (this.exporting || !this.host.owner) return;
    const owner = this.host.owner,
      session = { cancelled: false };
    this.outputRun = session;
    this.exportAreaStatus();
    const current = () =>
      this.host.owner === owner && this.outputRun === session && !session.cancelled;
    try {
      if (!(await this.host.flush()) || !current() || !(await this.host.opts.flush()) || !current())
        return;
      get('atlas-output-save-status').textContent = 'Kampagne wird gesichert…';
      const response = await window.campaign.exportCampaign(owner.token);
      if (!current()) return;
      if (!response.ok) throw new Error(response.error);
      const message = response.value.cancelled
        ? 'Kampagnensicherung abgebrochen.'
        : 'Bearbeitbare Kampagne gesichert.';
      get('atlas-output-save-status').textContent = message;
      get('atlas-save-status').textContent = message;
      get('atlas-save-status').dataset.error = 'false';
      this.host.opts.status(message);
    } catch (e) {
      if (current()) {
        get('atlas-output-save-status').textContent =
          'Sicherung fehlgeschlagen: ' + (e as Error).message;
        this.host.error(e);
      }
    } finally {
      if (this.outputRun === session) {
        this.outputRun = null;
        this.exportAreaStatus();
      }
    }
  }
  dungeonOutputBox() {
    const size = Number(get<HTMLInputElement>('atlas-export-size')?.value),
      scale = get<HTMLInputElement>('atlas-export-scale')?.checked ?? false;
    return this.host.data
      ? dungeonExportBox(
          this.host.data,
          this.host.scopeId,
          this.host.floorId,
          scale,
          Number.isFinite(size) ? size : 2048,
        )
      : null;
  }
  frameOutput(b: CanvasBox) {
    const canvas = this.host.canvas.getBoundingClientRect(),
      panel = get('atlas-secondary').getBoundingClientRect();
    const width = Math.max(1, Math.min(canvas.right, panel.left) - canvas.left),
      height = Math.max(1, canvas.height);
    const mpp = Math.max(b.width / Math.max(1, width - 24), b.height / Math.max(1, height - 24));
    this.host.camera.set(
      {
        x: b.x + b.width / 2 - (width * mpp) / 2,
        y: b.y + b.height / 2 - (height * mpp) / 2,
        width: canvas.width * mpp,
        height: height * mpp,
      },
      true,
    );
  }
  outputBox() {
    return this.exportDungeon ? this.dungeonOutputBox() : (this.exportBox ?? this.host.camera.view);
  }
  exportAreaStatus() {
    const campaign = get<HTMLSelectElement>('atlas-export-kind').value === 'campaign';
    get('atlas-output-editable').hidden = !campaign || !this.host.owner;
    get('atlas-output-image').hidden = campaign;
    get<HTMLButtonElement>('atlas-output-save-campaign').disabled = this.exporting;
    get<HTMLButtonElement>('atlas-export-png').disabled = this.exporting;
    const button = get<HTMLButtonElement>('atlas-output-dungeon');
    if (button) {
      button.hidden = !this.host.scopeId || !['interior', 'decoration'].includes(this.host.family);
      button.disabled = this.exporting || !this.host.geometryCurrent() || !this.dungeonOutputBox();
      button.setAttribute('aria-pressed', String(this.exportDungeon));
    }
    const b = this.outputBox(),
      floor =
        this.host.data?.workspace.floors.find(
          (f) => f.scopeId === this.host.scopeId && f.id === this.host.floorId,
        )?.name ?? this.host.floorId;
    get('atlas-output-area').textContent = this.exportChoosing
      ? this.exportCorner
        ? 'Zweite Ecke anklicken. Escape bricht ab.'
        : 'Bereich auf der Karte ziehen oder zwei Ecken anklicken. Escape bricht ab.'
      : !b
        ? 'Dungeon-Grundriss wird geladen. Ausschnitt erneut laden.'
        : `${this.exportDungeon ? 'Dungeon-Grundriss · ' + floor : this.exportBox ? 'Gewählter Bereich' : 'Aktuelle Ansicht'} · ${lengthLabel(b.width)} × ${lengthLabel(b.height)}`;
  }
  exportRectangle(a: Point, b: Point): CanvasBox {
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x),
      height: Math.abs(a.y - b.y),
    };
  }
  async exportPNG() {
    if (!this.host.data || !this.host.owner || this.exporting) return;
    if (this.exportChoosing || this.exportDrag) {
      this.exportAreaStatus();
      return;
    }
    const owner = this.host.owner,
      session = { cancelled: false };
    this.outputRun = session;
    const current = () =>
      this.host.owner === owner && this.outputRun === session && !session.cancelled;
    const status = (text: string) => {
      if (this.outputRun !== session || this.host.owner !== owner) return;
      get('atlas-save-status').textContent = text;
      get('atlas-output-area').textContent = text;
    };
    get('atlas-export-cancel').hidden = false;
    get<HTMLButtonElement>('atlas-export-png').disabled = true;
    get<HTMLButtonElement>('atlas-output-save-campaign').disabled = true;
    status('Bild wird vorbereitet…');
    try {
      if (!(await this.host.opts.flush()) || !current()) return;
      const audience = get<HTMLSelectElement>('atlas-export-audience').value as 'gm' | 'public',
        chosenBox = this.outputBox();
      if (!chosenBox) throw new Error('Dungeon-Grundriss wird geladen. Ausschnitt erneut laden.');
      const box = { ...chosenBox },
        pose = this.host.spatial?.active ? this.host.spatial.visibility() : undefined;
      const surfaceBox = pose ? terrainCoverageBox(box, terrainCoverageLevel(pose.tilt)) : box;
      const exportQuery = {
          ...this.host.regionQuery(),
          box: { ...surfaceBox },
          perception: audience === 'public',
          terrainRaster: !pose || audience === 'public',
        },
        references = get<HTMLInputElement>('atlas-export-reference').checked,
        grid = get<HTMLInputElement>('atlas-export-grid').checked,
        level = get<HTMLSelectElement>('atlas-hex-level').value,
        units = atlasUnits(),
        scale =
          (document.getElementById('atlas-export-scale') as HTMLInputElement | null)?.checked ??
          false;
      const format = get<HTMLSelectElement>('atlas-export-format').value as 'png' | 'jpeg',
        size = Number(get<HTMLInputElement>('atlas-export-size').value);
      if (!Number.isInteger(size) || size < 256 || size > 8192)
        throw new Error('Ausgabegröße zwischen 256 und 8192 Pixel wählen.');
      const width = Math.max(1, Math.round(size * Math.min(1, box.width / box.height))),
        height = Math.max(1, Math.round(size * Math.min(1, box.height / box.width)));
      exportQuery.width = Math.min(8192, Math.round((width * surfaceBox.width) / box.width));
      exportQuery.height = Math.min(8192, Math.round((height * surfaceBox.height) / box.height));
      const fresh = await window.campaign.atlasRegion(owner.token, exportQuery, 'export');
      if (!fresh.ok) throw new Error(fresh.error);
      if (!current()) return;
      const snapshot = fresh.value;
      const view = pose ?? {
        box: surfaceBox,
        frame: box,
        columns: 65,
        rows: 65,
        focusM: 0,
        tilt: 0,
        rotation: 0,
        exaggeration: 1,
      };
      const bytes = await atlasTerrainExport(
        owner.token,
        snapshot,
        { ...view, box: surfaceBox, frame: box, projection: 'perspective' },
        {
          audience,
          width,
          height,
          format,
          references,
          grid,
          level,
          floorId: exportQuery.floorId,
          roofs: exportQuery.roofs,
          contours: this.host.landscape.contours(),
          overlay: scale
            ? atlasExportScale(box, width, height, grid ? level : undefined, units)
            : undefined,
        },
        current,
        (done, total) => status(`Atlas wird ausgegeben: ${done}/${total}`),
      );
      if (!current()) return;
      const r = await window.campaign.exportAtlasPNG(
        owner.token,
        bytes,
        audience,
        format,
        snapshot.region!.fence,
      );
      if (!current()) return;
      if (!r.ok) throw new Error(r.error);
      if (!r.value.cancelled) {
        this.host.opts.status('Atlas-' + format.toUpperCase() + ' gespeichert.');
        status('Atlas-' + format.toUpperCase() + ' gespeichert');
      }
    } catch (e) {
      if (current()) this.host.error(e);
    } finally {
      if (this.outputRun === session) {
        if (session.cancelled && this.host.owner === owner) status('Ausgabe abgebrochen');
        this.outputRun = null;
        get('atlas-export-cancel').hidden = true;
        get<HTMLButtonElement>('atlas-export-png').disabled = false;
        get<HTMLButtonElement>('atlas-output-save-campaign').disabled = false;
      }
    }
  }
}
