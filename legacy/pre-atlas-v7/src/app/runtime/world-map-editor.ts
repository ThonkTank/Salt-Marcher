import type { CanvasBox } from '../atlas/atlas-camera';
import { defaultMarkerPresentation, markerSymbols } from '../atlas/atlas-marker';
import type { Preparation } from '../campaign/preparation-contracts';
import type { WorkspaceGeometry } from '../shared/contracts';
import { ownedEventTarget } from '../shared/owned-event-target';
import { hexAccessLabel } from './hex-access';
import { installHexMapGestures } from './hex-map-gestures';
import { installHexPartyDrag } from './hex-party-drag';
import type { LiveView } from './live-contracts';
import { PassiveMapCanvas } from './passive-map-canvas';
import type { AtlasCell, Climate, Hex, MarkerPresentation, Terrain } from './world-cell-contracts';
import type { AtlasMap } from './world-map-contracts';
import type { SceneWorld, WorldView } from './world-contracts';
import type { WorldEditorSurface } from './world-editor-surface';
import type { MapProjectionContext, MarkerDraft } from './world-editor-types';
import {
  authoredCellAt,
  cellAt,
  climateNames,
  hexDistance,
  hexKey,
  hexPoint,
  pointHex,
  terrainColors,
  terrainNames,
} from './world-model';
import type {
  WorldCalendarPort,
  WorldTravelPort,
  WorldWeatherPort,
  WorldWritePort,
} from './world-owner-ports';

interface Host {
  surface: Pick<
    WorldEditorSurface,
    | 'after'
    | 'api'
    | 'cleanups'
    | 'document'
    | 'editorSession'
    | 'el'
    | 'enter'
    | 'listen'
    | 'number'
    | 'option'
    | 'register'
    | 'run'
    | 'svg'
    | 'tell'
    | 'unwrap'
    | 'value'
  >;
  travel: Pick<
    WorldTravelPort,
    | 'chooseRouteHex'
    | 'clearTravelPreview'
    | 'liveSurface'
    | 'liveTravelOpen'
    | 'mountTravelControls'
    | 'mountTravelLayout'
    | 'placePartyAt'
    | 'placementKey'
    | 'playback'
    | 'preview'
    | 'renderJourney'
    | 'renderRouteDraft'
    | 'resetRouteDraft'
    | 'routeCursor'
    | 'routeMode'
    | 'routeStops'
    | 'sceneSelectionChanged'
    | 'sceneSelectionRequested'
    | 'mapCursorSelected'
    | 'mapLevelChanged'
    | 'journeyContextLoaded'
    | 'sceneSelection'
    | 'transportBusy'
    | 'worldSurface'
  >;
  writes: Pick<
    WorldWritePort,
    | 'action'
    | 'checkingWorldWriteWork'
    | 'flushWorld'
    | 'pendingWork'
    | 'raw'
    | 'reconcileWorldWrite'
    | 'uncertainState'
    | 'worldWrites'
  >;
  weather: Pick<
    WorldWeatherPort,
    'liveFocusId' | 'mountWeatherControls' | 'renderPhenomenonOptions'
  >;
  calendar: Pick<WorldCalendarPort, 'installCalendarRules' | 'renderCalendar'>;
}
export class WorldMapEditor {
  mapEdits = 0;
  markerEdits = 0;
  constructor(readonly host: Host) {
    this.markerSavingWork = this.host.surface.editorSession.operation<Promise<boolean>>();
  }
  markerSavingWork: import('../shared/editor-session').EditorOperation<Promise<boolean>>;

  worldRead = 0;

  sceneRead = 0;

  worldCanvas: PassiveMapCanvas | null = null;

  canvasBasis = '';

  partyDrag: ReturnType<typeof installHexPartyDrag> | null = null;

  suspendMapPointer = () => {
    this.partyDrag?.cancel('Platzierung abgebrochen · Standort unverändert.');
    this.mapGestures?.suspend();
    this.worldCanvas?.cancel();
  };

  mapGestures: ReturnType<typeof installHexMapGestures> | null = null;

  workspace: WorkspaceGeometry | null = null;

  world: WorldView | null = null;

  sources: Preparation | null = null;

  live: LiveView | null = null;

  frame: SceneWorld | null = null;

  mapDraft: AtlasMap | null = null;

  selected: Hex = { q: 0, r: 0 };

  center: Hex = { q: 0, r: 0 };

  level = 0;

  viewZoom = 1;

  dirtyMap = false;

  dirtyCell = false;

  mapSelection = 0;

  projectionContext = (): MapProjectionContext => ({
    token: this.workspace?.token ?? '',
    generation: this.host.surface.editorSession.generation,
    mapSelection: this.mapSelection,
    sceneSelection: this.host.travel.sceneSelection,
  });

  ownsProjection = (context: MapProjectionContext) =>
    this.host.surface.editorSession.status.attached &&
    this.workspace?.token === context.token &&
    this.host.surface.editorSession.generation === context.generation &&
    this.mapSelection === context.mapSelection &&
    this.host.travel.sceneSelection === context.sceneSelection;

  prepareLiveScene = (sceneId: string) => {
    if (this.host.surface.value('world-scene') === sceneId && this.frame?.scene.id === sceneId)
      return;
    this.frame = null;
    this.sceneRead++;
    this.host.travel.sceneSelectionChanged();
    this.host.surface.el<HTMLSelectElement>('world-scene').value = sceneId;
  };

  unavailableScene = () => {
    this.sceneRead++;
    this.frame = null;
  };

  closeLiveRead = () => {
    this.worldRead++;
  };

  useAtlasTargetLevel = () => {
    this.host.travel.mapLevelChanged(this.level, 0);
    this.level = 0;
  };

  navigateCursor = (hex: Hex, select: boolean) => {
    if (hexDistance(hex, this.center) > Math.max(1, 5 / this.viewZoom)) this.center = { ...hex };
    if (select) {
      this.selected = { ...hex };
      this.renderCell();
    }
    this.renderMap();
  };

  acceptWeatherProjection = (token: string, next: SceneWorld) => {
    const previous = this.frame;
    if (
      this.workspace?.token !== token ||
      !previous ||
      previous.scene.id !== next.scene.id ||
      this.host.surface.value('world-scene') !== next.scene.id ||
      previous.scene.clock.revision > next.scene.clock.revision ||
      previous.scene.revision > next.scene.revision ||
      previous.scene.membershipRevision > next.scene.membershipRevision ||
      previous.position.revision > next.position.revision ||
      (previous.weatherOverrideRevision ?? 0) > (next.weatherOverrideRevision ?? 0)
    )
      return;
    this.frame = next;
    this.renderMap();
    this.host.travel.renderJourney();
  };

  projectLiveGroup = (result: SceneWorld, context: MapProjectionContext, first: boolean) => {
    if (
      !this.ownsProjection(context) ||
      this.host.weather.liveFocusId !== result.scene.id ||
      !this.host.travel.liveSurface ||
      !this.host.travel.liveTravelOpen ||
      this.host.surface.value('world-scene') !== result.scene.id
    )
      return null;
    const changed = this.frame?.scene.id !== result.scene.id;
    const basisChanged =
      changed ||
      this.frame?.scene.clock.revision !== result.scene.clock.revision ||
      this.frame?.position.revision !== result.position.revision ||
      this.frame?.scene.membershipRevision !== result.scene.membershipRevision;
    this.frame = result;
    let cursor: Hex | null = null;
    // A confirmed position never replaces an independently edited map or camera.
    if ((changed || first) && !this.dirtyMap && !this.dirtyCell && result.position.mapId) {
      const map = this.world?.maps.find((m) => m.id === result.position.mapId);
      this.mapDraft = map ? structuredClone(map) : null;
      this.host.surface.el<HTMLSelectElement>('world-map-select').value = this.mapDraft?.id ?? '';
      if (this.mapDraft) {
        const p = hexPoint(result.position);
        this.center = pointHex(p.x, p.y, 3 ** this.level);
        cursor = { ...this.center };
      }
    }
    return { changed, basisChanged, cursor };
  };

  readTravelCell = (hex: Hex) => (this.mapDraft ? cellAt(this.mapDraft, hex) : null);

  collectCell = () => {
    if (!this.mapDraft) return;
    const access = this.host.surface.value('hex-access'),
      requirement = this.host.surface.value('hex-access-requirement').trim();
    const c: AtlasCell = {
      ...(access === 'open'
        ? {}
        : { access: { mode: access as 'blocked' | 'requires', requirement } }),
      ...this.selected,
      level: this.level,
      terrain: this.host.surface.value('hex-terrain') as Terrain,
      elevationM: this.host.surface.number('hex-elevation'),
      climate: (this.host.surface.value('hex-climate') as Climate) || null,
      road: this.host.surface.el<HTMLInputElement>('hex-road').checked,
      river: this.host.surface.el<HTMLInputElement>('hex-river').checked,
      label: this.host.surface.value('hex-label'),
      faction: this.host.surface.value('hex-faction'),
      interrupt: this.host.surface.value('hex-interrupt'),
    };
    this.mapDraft.cells = this.mapDraft.cells.filter(
      (h) => !(h.level === this.level && hexKey(h) === hexKey(this.selected)),
    );
    this.mapDraft.cells.push(c);
    this.dirtyMap = true;
    this.dirtyCell = false;
  };

  selectWorldMap = async () => {
    const picker = this.host.surface.el<HTMLSelectElement>('world-map-select'),
      id = picker.value,
      token = this.workspace?.token,
      request = ++this.mapSelection;
    const current = () => this.workspace?.token === token && request === this.mapSelection;
    // A requested destination is not the loaded map while its previous edits save.
    picker.value = this.mapDraft?.id ?? '';
    if (id === this.mapDraft?.id) {
      picker.setAttribute('aria-busy', 'false');
      return;
    }
    picker.setAttribute('aria-busy', 'true');
    this.host.travel.playback.stop();
    this.host.travel.clearTravelPreview();
    this.renderMap(true);
    try {
      if (!token || !(await this.host.writes.flushWorld()) || !current()) return;
      const map = this.world?.maps.find((m) => m.id === id);
      if (!map) throw new Error('Ausgewählte Hexkarte ist nicht mehr verfügbar.');
      this.host.travel.resetRouteDraft();
      this.mapDraft = structuredClone(map);
      this.center = { q: 0, r: 0 };
      this.selected = { q: 0, r: 0 };
      picker.value = id;
      this.renderMapFields();
      this.renderMap(true);
      this.renderCell();
      this.host.weather.renderPhenomenonOptions();
      this.host.travel.renderJourney();
      this.host.travel.renderRouteDraft();
    } finally {
      if (current()) {
        picker.value = this.mapDraft?.id ?? '';
        picker.setAttribute('aria-busy', 'false');
      }
    }
  };

  openWorld = async () => {
    const current = this.host.surface.editorSession.capture();
    if (!this.workspace) return;
    const request = ++this.worldRead,
      focus =
        this.host.travel.liveSurface && this.host.travel.liveTravelOpen
          ? this.host.weather.liveFocusId
          : null,
      token = this.workspace.token,
      [w, p, l] = await Promise.all([
        this.host.surface.api.world(token),
        this.host.surface.api.preparation(token, ''),
        this.host.surface.api.live(token),
      ]);
    if (
      this.workspace?.token !== token ||
      !current() ||
      request !== this.worldRead ||
      (focus !== null &&
        (!this.host.travel.liveSurface ||
          !this.host.travel.liveTravelOpen ||
          focus !== this.host.weather.liveFocusId))
    )
      return;
    this.world = this.host.surface.unwrap(w);
    this.sources = this.host.surface.unwrap(p);
    this.live = this.host.surface.unwrap(l);
    const maps = this.host.surface.el<HTMLSelectElement>('world-map-select'),
      old = this.mapDraft?.id ?? maps.value;
    maps.replaceChildren();
    for (const m of this.world.maps) this.host.surface.option(maps, m.id, m.name);
    maps.value = this.world.maps.some((m) => m.id === old) ? old : (this.world.maps[0]?.id ?? '');
    if (maps.value !== old) this.host.travel.resetRouteDraft();
    this.mapDraft = this.world.maps.find((m) => m.id === maps.value)
      ? structuredClone(this.world.maps.find((m) => m.id === maps.value)!)
      : null;
    const scenes = this.host.surface.el<HTMLSelectElement>('world-scene'),
      prior = scenes.value;
    scenes.replaceChildren();
    for (const s of this.live.scenes)
      this.host.surface.option(scenes, s.id, s.title || 'Gruppe ' + s.id.slice(0, 6));
    if (focus !== null && !this.live.scenes.some((s) => s.id === focus))
      throw new Error('Die angefragte Fokusgruppe ist nicht mehr verfügbar.');
    scenes.value =
      focus ?? (this.live.scenes.some((s) => s.id === prior) ? prior : (this.live.focusId ?? ''));
    if (scenes.value !== prior) this.host.travel.resetRouteDraft();
    this.renderLocationOptions();
    this.loadMarkerEditor();
    const loaded = await this.reloadScene();
    if (
      this.workspace?.token !== token ||
      !current() ||
      request !== this.worldRead ||
      (focus !== null &&
        (!this.host.travel.liveSurface ||
          !this.host.travel.liveTravelOpen ||
          focus !== this.host.weather.liveFocusId))
    )
      return;
    this.renderMapFields();
    this.host.calendar.renderCalendar();
    this.host.weather.renderPhenomenonOptions();
    this.renderMap();
    this.renderCell();
    this.host.travel.renderJourney();
    return loaded;
  };

  reloadScene = async () => {
    const token = this.workspace?.token,
      id = this.host.surface.value('world-scene'),
      request = ++this.sceneRead;
    const current = this.host.surface.editorSession.capture(
      () => [this.workspace?.token, this.host.surface.value('world-scene'), this.sceneRead],
      () =>
        this.workspace?.token === token &&
        this.host.surface.value('world-scene') === id &&
        request === this.sceneRead,
    );
    if (!token || !id) {
      this.frame = null;
      return;
    }
    if (this.frame?.scene.id !== id) {
      this.frame = null;
      this.host.travel.playback.stop();
      this.host.travel.resetRouteDraft();
      this.renderMap();
      this.host.travel.renderJourney();
      this.host.travel.renderRouteDraft();
      this.host.surface.el('world-current').textContent = 'Reisekontext wird geladen …';
    }
    try {
      const result = await this.host.surface.api.sceneWorld(token, id);
      if (!current()) return;
      const loaded = this.host.surface.unwrap(result);
      if (loaded.scene.id !== id) throw new Error('Reisekontext gehört zu einer anderen Gruppe.');
      if (
        this.frame &&
        (this.frame.scene.clock.revision !== loaded.scene.clock.revision ||
          this.frame.position.revision !== loaded.position.revision ||
          this.frame.scene.membershipRevision !== loaded.scene.membershipRevision)
      )
        this.host.travel.clearTravelPreview();
      const entering = this.frame?.scene.id !== loaded.scene.id;
      this.frame = loaded;
      if (
        entering &&
        loaded.journey &&
        ['active', 'paused', 'interrupted'].includes(loaded.journey.status)
      ) {
        this.host.travel.journeyContextLoaded();
      }
      return loaded;
    } catch (error) {
      if (!current()) return;
      this.frame = null;
      this.host.travel.playback.stop();
      this.host.travel.clearTravelPreview();
      this.renderMap();
      this.host.travel.renderJourney();
      this.host.travel.renderRouteDraft();
      this.host.surface.el('world-current').textContent =
        'Reisekontext nicht verfügbar: ' + (error as Error).message;
      throw error;
    }
  };

  renderMapFields = () => {
    const picker = this.host.surface.el<HTMLSelectElement>('world-map-select');
    if (this.mapDraft) {
      const opt = [...picker.options].find((o) => o.value === this.mapDraft!.id);
      if (opt) opt.textContent = this.mapDraft.name;
    }
    this.host.surface.el('world-map-workspace').hidden = !this.mapDraft;
    if (!this.mapDraft) return;
    this.host.surface.el<HTMLInputElement>('world-map-name').value = this.mapDraft.name;
    this.host.surface.el<HTMLInputElement>('world-hex-size').value = String(
      this.mapDraft.hexMeters / 1000,
    );
    this.host.surface.el<HTMLSelectElement>('world-climate').value = this.mapDraft.climate;
    this.host.surface.el<HTMLInputElement>('world-seed').value = this.mapDraft.seed;
  };

  markerDraft: MarkerDraft | null = null;

  markerSelection = 0;

  renderLocationOptions = () => {
    const picker = this.host.surface.el<HTMLSelectElement>('world-anchor-location'),
      old = picker.value,
      query = this.host.surface.value('world-anchor-search').trim().toLocaleLowerCase();
    picker.replaceChildren();
    this.host.surface.option(picker, '', 'Ort auswählen');
    for (const row of this.sources?.locations ?? []) {
      if (row.trashed) continue;
      const d = row.document,
        place = this.world?.places.find((p) => p.locationId === d.id),
        where = place
          ? ' · ' +
            (this.world?.maps.find((m) => m.id === place.mapId)?.name ?? 'Karte') +
            ' ' +
            hexKey(place)
          : ' · ohne Marker';
      if (
        d.id === old ||
        !query ||
        [d.name, d.type === 'city' ? 'Stadt Siedlung' : 'Ort Sehenswürdigkeit', where]
          .join(' ')
          .toLocaleLowerCase()
          .includes(query)
      )
        this.host.surface.option(picker, d.id, d.name + where);
    }
    picker.value = old;
  };

  loadMarkerEditor = () => {
    const id = this.host.surface.value('world-anchor-location'),
      place = this.world?.places.find((p) => p.locationId === id && !p.trashed);
    this.markerDraft = place
      ? {
          id,
          revision: place.presentationRevision ?? 0,
          presentation: structuredClone(place.presentation ?? defaultMarkerPresentation),
          dirty: false,
        }
      : null;
    this.host.surface.el<HTMLFieldSetElement>('world-marker-fields').disabled = !place;
    for (const [key, v] of Object.entries({
      title: this.markerDraft?.presentation.title ?? '',
      symbol: this.markerDraft?.presentation.symbol ?? 'pin',
      size: String(this.markerDraft?.presentation.size ?? 1),
      'label-position': this.markerDraft?.presentation.labelPosition ?? 'above',
      curve: String(this.markerDraft?.presentation.curve ?? 0),
    }))
      this.host.surface.el<HTMLInputElement>('world-marker-' + key).value = v;
    this.host.surface.el('world-marker-status').textContent = place
      ? 'Marker auf ' +
        (this.world?.maps.find((m) => m.id === place.mapId)?.name ?? 'Karte') +
        ' · Hex ' +
        hexKey(place) +
        '. Kartendarstellung wird unabhängig vom Ortsinhalt gespeichert.'
      : 'Ort auswählen und auf einem Hex platzieren, um seinen Marker zu gestalten.';
    this.host.surface.el<HTMLButtonElement>('world-anchor-focus').disabled = !place;
    this.host.surface.el('world-anchor-save').textContent = place
      ? 'Marker auf ausgewähltes Hex versetzen'
      : 'Ort auf diesem Hex platzieren';
  };

  collectMarker = () => {
    if (
      !this.markerDraft ||
      this.host.surface.el<HTMLFieldSetElement>('world-marker-fields').disabled ||
      this.host.surface.value('world-anchor-location') !== this.markerDraft.id
    )
      return;
    const next: MarkerPresentation = {
      title: this.host.surface.value('world-marker-title'),
      symbol: this.host.surface.value('world-marker-symbol'),
      size: this.host.surface.number('world-marker-size'),
      labelPosition: this.host.surface.value(
        'world-marker-label-position',
      ) as MarkerPresentation['labelPosition'],
      curve: this.host.surface.number('world-marker-curve'),
    };
    if (JSON.stringify(next) === JSON.stringify(this.markerDraft.presentation)) return;
    this.markerDraft.presentation = next;
    this.markerDraft.dirty = true;
    this.markerEdits++;
    this.renderMap();
  };

  flushMarker = async (): Promise<boolean> => {
    if (this.markerSavingWork.value) return this.markerSavingWork.value;
    if (!this.markerDraft?.dirty) return true;
    if (this.host.writes.uncertainState.value) return false;
    const token = this.workspace?.token,
      draft = this.markerDraft;
    const operation = Promise.resolve().then(async () => {
      try {
        await Promise.all([...this.host.writes.worldWrites]);
        while (draft === this.markerDraft && this.workspace?.token === token && draft.dirty) {
          const version = this.markerEdits,
            ack = await this.host.writes.raw(
              {
                kind: 'place-presentation',
                locationId: draft.id,
                expectedRevision: draft.revision || null,
                presentation: structuredClone(draft.presentation),
              },
              () => this.workspace?.token === token && this.markerDraft === draft,
            );
          if (this.workspace?.token !== token || this.markerDraft !== draft) return false;
          draft.revision =
            ack.world.places.find((p) => p.locationId === draft.id)?.presentationRevision ?? 0;
          draft.dirty = version !== this.markerEdits;
        }
        if (this.workspace?.token !== token || this.markerDraft !== draft) return false;
        this.host.surface.el('world-marker-status').textContent =
          'Ortsmarke gespeichert. Ortsinhalt und Gelände bleiben eigenständig.';
        this.renderMap();
        return true;
      } catch (error) {
        if (this.workspace?.token === token && this.markerDraft === draft) {
          let restored = false;
          if (token && !this.host.writes.uncertainState.value) {
            try {
              const confirmed = this.host.surface.unwrap(await this.host.surface.api.world(token));
              if (this.workspace?.token === token && this.markerDraft === draft) {
                this.world = confirmed;
                this.loadMarkerEditor();
                this.renderMap();
                restored = true;
              }
            } catch {}
          }
          if (this.workspace?.token === token)
            this.host.surface.tell(
              (error as Error).message +
                (this.host.writes.uncertainState.value
                  ? ' Auftrag prüfen, bevor der Marker weiter geändert wird.'
                  : restored
                    ? ' Bestätigte Darstellung wiederhergestellt; Änderung erneut prüfen.'
                    : ' Bestätigter Stand konnte nicht gelesen werden. Eingabe bleibt offen.'),
              true,
            );
        }
        return false;
      }
    });
    this.markerSavingWork.value = operation;
    return operation;
  };

  renderCell = () => {
    if (!this.mapDraft) return;
    const c = cellAt(this.mapDraft, this.selected, this.level);
    this.host.surface.el('hex-authored-status').textContent = authoredCellAt(
      this.mapDraft,
      this.selected,
      this.level,
    )
      ? 'Gestaltetes Gelände'
      : 'Noch ungezeichnet · Reisen rechnen hier mit Ebene.';
    this.host.surface.el('hex-selected').textContent =
      'Hex ' +
      hexKey(this.selected) +
      ' · Maßstab ' +
      ((this.mapDraft.hexMeters * 3 ** this.level) / 1000).toFixed(2) +
      ' km';
    for (const [id, v] of Object.entries({
      'hex-terrain': c.terrain,
      'hex-elevation': String(c.elevationM),
      'hex-climate': c.climate ?? '',
      'hex-label': c.label,
      'hex-faction': c.faction,
      'hex-interrupt': c.interrupt,
      'hex-access': c.access?.mode ?? 'open',
      'hex-access-requirement': c.access?.requirement ?? '',
    }))
      this.host.surface.el<HTMLInputElement>(id).value = v;
    this.host.surface.el<HTMLInputElement>('hex-road').checked = c.road;
    this.host.surface.el<HTMLInputElement>('hex-river').checked = c.river;
    if (this.host.travel.routeStops.length || this.host.travel.routeMode !== 'edit') return;
    const base = hexPoint(this.selected, 3 ** this.level),
      target = pointHex(base.x, base.y);
    this.host.surface.el<HTMLInputElement>('travel-q').value = String(target.q);
    this.host.surface.el<HTMLInputElement>('travel-r').value = String(target.r);
    const place = this.world?.places.find(
      (p) => p.mapId === this.mapDraft!.id && !p.trashed && hexKey(p) === hexKey(target),
    );
    this.host.surface.el<HTMLSelectElement>('world-destination').value = place?.locationId ?? '';
  };

  hexCameraBox = (): CanvasBox => {
    const p = hexPoint(this.center);
    return {
      x: (p.x - 7.8 / this.viewZoom) * 100,
      y: (p.y - 6.8 / this.viewZoom) * 100,
      width: 1560 / this.viewZoom,
      height: 1360 / this.viewZoom,
    };
  };

  cameraBasis = () => {
    return JSON.stringify([
      this.workspace?.token,
      this.mapDraft?.id,
      this.level,
      this.center.q,
      this.center.r,
      this.viewZoom,
    ]);
  };

  renderMap = (restoreView: unknown = false) => {
    this.partyDrag?.cancel('Platzierung abgebrochen · Kartenstand aktualisiert.');
    // The shared Atlas owns the visible map. Do not rebuild its hidden legacy twin.
    if (
      !this.worldCanvas ||
      this.host.travel.worldSurface === 'atlas' ||
      (this.host.travel.liveSurface &&
        this.host.travel.liveTravelOpen &&
        this.host.surface.el('live-travel-host')?.dataset.sharedAtlas === 'true')
    )
      return;
    const basis = this.cameraBasis(),
      key =
        (this.workspace?.campaign.id ?? '') + ':' + (this.mapDraft?.id ?? '') + ':' + this.level;
    if (this.worldCanvas.context(key, this.hexCameraBox(), restoreView === true)) {
      if (this.worldCanvas.contextRestored) {
        const box = this.worldCanvas.view;
        this.viewZoom = 1560 / box.width;
        this.center = pointHex((box.x + box.width / 2) / 100, (box.y + box.height / 2) / 100);
      } else this.worldCanvas.defaultView({ x: -780, y: -680, width: 1560, height: 1360 });
      this.canvasBasis = this.cameraBasis();
    } else if (basis !== this.canvasBasis) {
      this.worldCanvas.set(this.hexCameraBox());
      this.canvasBasis = basis;
    }
    this.worldCanvas.render(
      this.renderMapScene,
      this.mapDraft
        ? ''
        : 'Keine Karte ausgewählt. Region anlegen oder eine vorhandene Karte öffnen.',
    );
  };

  visibleHexLabels = (labels: SVGElement[]) => {
    const candidates = labels.filter((label) => label.dataset.hexLabel !== undefined),
      hidden = new Set<SVGElement>();
    if (candidates.length < 2) return labels;
    const context = this.host.surface.document.createElement('canvas').getContext?.('2d'),
      family =
        this.host.surface.document.defaultView?.getComputedStyle?.(
          this.host.surface.el('world-map'),
        ).fontFamily || 'sans-serif';
    const cursor = hexKey(
        this.host.travel.routeMode === 'edit' ? this.selected : this.host.travel.routeCursor,
      ),
      occupied: {
        x: number;
        y: number;
        width: number;
        height: number;
      }[] = [],
      padding = 4 / this.viewZoom;
    candidates.sort(
      (a, b) => Number(b.dataset.hexLabel === cursor) - Number(a.dataset.hexLabel === cursor),
    );
    for (const label of candidates) {
      const size = Number(label.getAttribute('font-size')),
        text = label.textContent ?? '';
      if (context) context.font = size + 'px ' + family;
      const width = context?.measureText(text).width ?? Array.from(text).length * size * 0.7;
      const box = {
        x: Number(label.getAttribute('x')) - width / 2 - padding,
        y: Number(label.getAttribute('y')) - size - padding,
        width: width + 2 * padding,
        height: size * 1.25 + 2 * padding,
      };
      if (
        occupied.some(
          (other) =>
            box.x < other.x + other.width &&
            box.x + box.width > other.x &&
            box.y < other.y + other.height &&
            box.y + box.height > other.y,
        )
      )
        hidden.add(label);
      else occupied.push(box);
    }
    return labels.filter((label) => !hidden.has(label));
  };

  renderMapScene = (root: SVGGElement) => {
    this.mapGestures?.sync();
    if (!this.mapDraft) return;
    const labels: SVGElement[] = [];
    const m = this.mapDraft,
      radius = Math.ceil(7 / this.viewZoom),
      known = new Set(this.frame?.knowledge.filter((k) => k.mapId === m.id).map(hexKey)),
      passive = this.host.surface.el<HTMLInputElement>('world-passive').checked;
    for (let q = this.center.q - radius; q <= this.center.q + radius; q++)
      for (let r = this.center.r - radius; r <= this.center.r + radius; r++) {
        const h = { q, r };
        if (hexDistance(h, this.center) > radius) continue;
        const authored = authoredCellAt(m, h, this.level),
          c = authored ?? cellAt(m, h, this.level),
          p = hexPoint(h),
          poly = this.host.surface.svg('polygon');
        const pts = Array.from({ length: 6 }, (_, i) => {
          const a = ((30 + 60 * i) * Math.PI) / 180;
          return (
            (p.x + Math.cos(a) / Math.sqrt(3)) * 100 +
            ',' +
            (p.y + Math.sin(a) / Math.sqrt(3)) * 100
          );
        });
        poly.setAttribute('points', pts.join(' '));
        const fine = pointHex(p.x * 3 ** this.level, p.y * 3 ** this.level),
          visible = !passive || known.has(hexKey(fine));
        poly.setAttribute(
          'fill',
          visible ? (authored ? terrainColors[c.terrain] : '#edf1e8') : '#26384a',
        );
        poly.setAttribute(
          'stroke',
          hexKey(h) ===
            hexKey(
              this.host.travel.routeMode === 'edit' ? this.selected : this.host.travel.routeCursor,
            )
            ? '#10283d'
            : visible && !authored
              ? '#9caa94'
              : '#ffffff66',
        );
        poly.setAttribute(
          'stroke-width',
          hexKey(h) ===
            hexKey(
              this.host.travel.routeMode === 'edit' ? this.selected : this.host.travel.routeCursor,
            )
            ? '4'
            : '1',
        );
        poly.dataset.authored = String(!!authored);
        if (visible && !authored) poly.setAttribute('stroke-dasharray', '5 4');
        poly.dataset.q = String(q);
        poly.dataset.r = String(r);
        poly.classList.add('atlas-hex');
        const title = this.host.surface.svg('title');
        title.textContent = visible
          ? [
              authored ? terrainNames[c.terrain] : 'Ungezeichnet · Reiseannahme Ebene',
              c.label,
              climateNames[c.climate ?? m.climate],
              c.interrupt,
              ...(!passive && c.access ? [hexAccessLabel(c)] : []),
            ]
              .filter(Boolean)
              .join(' · ')
          : 'Unbekannt für diese Gruppe';
        poly.append(title);
        const choose = () =>
          this.host.surface.run(async () => {
            if (this.host.travel.routeMode !== 'edit') {
              this.host.travel.chooseRouteHex(h);
              return;
            }
            if (!(await this.host.writes.flushWorld())) return;
            this.selected = h;
            this.host.travel.mapCursorSelected(h);
            this.renderCell();
            this.renderMap();
          });
        poly.addEventListener('click', choose);
        root.append(poly);
        if (visible && (c.road || c.river)) {
          const line = this.host.surface.svg('line');
          line.setAttribute('x1', String((p.x - 0.43) * 100));
          line.setAttribute('x2', String((p.x + 0.43) * 100));
          line.setAttribute('y1', String(p.y * 100));
          line.setAttribute('y2', String(p.y * 100));
          line.setAttribute('stroke', c.river ? '#457eaa' : '#725342');
          line.setAttribute('stroke-width', c.river ? '6' : '3');
          line.setAttribute('pointer-events', 'none');
          root.append(line);
        }
        if (visible && c.label) {
          const t = this.host.surface.svg('text'),
            size =
              Math.max(30, (14 * 1360) / (this.host.surface.el('world-map').clientHeight || 520)) /
              this.viewZoom;
          t.setAttribute('x', String(p.x * 100));
          t.setAttribute('y', String(p.y * 100 + size + 8 / this.viewZoom));
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-size', String(size));
          t.setAttribute('paint-order', 'stroke');
          t.setAttribute('stroke', '#f7f9fc');
          t.setAttribute('stroke-width', '4');
          t.style.cursor = 'pointer';
          t.setAttribute('pointer-events', 'bounding-box');
          t.addEventListener('click', choose);
          t.dataset.hexLabel = hexKey(h);
          t.textContent = c.label.slice(0, 24);
          t.setAttribute('aria-label', c.label);
          labels.push(t);
        }
      }
    if (!passive)
      for (let q = this.center.q - radius; q <= this.center.q + radius; q++)
        for (let r = this.center.r - radius; r <= this.center.r + radius; r++) {
          const h = { q, r };
          if (hexDistance(h, this.center) > radius) continue;
          const c = cellAt(m, h, this.level);
          if (!c.access) continue;
          const p = hexPoint(h),
            mark = this.host.surface.svg('text');
          mark.dataset.hexAccess = c.access.mode;
          mark.setAttribute('x', String(p.x * 100));
          mark.setAttribute('y', String(p.y * 100 - 15));
          mark.setAttribute('text-anchor', 'middle');
          mark.setAttribute('font-size', '24');
          mark.setAttribute('paint-order', 'stroke');
          mark.setAttribute('stroke', '#fff');
          mark.setAttribute('stroke-width', '4');
          mark.setAttribute('pointer-events', 'none');
          mark.textContent = c.access.mode === 'blocked' ? '×' : '!';
          const title = this.host.surface.svg('title');
          title.textContent = hexAccessLabel(c);
          mark.append(title);
          labels.push(mark);
        }
    const shownLabels = this.visibleHexLabels(labels);
    root.append(...shownLabels);
    const route =
      this.host.travel.preview?.request.mapId === m.id
        ? this.host.travel.preview.route
        : this.frame?.journey?.mapId === m.id &&
            ['active', 'paused', 'interrupted'].includes(this.frame.journey.status)
          ? this.frame.journey.route
          : [];
    if (route.length) {
      const path = this.host.surface.svg('polyline');
      path.setAttribute(
        'points',
        route
          .map((h) => {
            const p = hexPoint(h);
            return (p.x / 3 ** this.level) * 100 + ',' + (p.y / 3 ** this.level) * 100;
          })
          .join(' '),
      );
      path.dataset.travelRoute = 'accepted';
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#7c433f');
      path.setAttribute('stroke-width', '5');
      path.setAttribute('stroke-dasharray', '9 6');
      path.setAttribute('pointer-events', 'none');
      root.append(path);
    }
    if (this.host.travel.routeStops.length) {
      const points = this.host.surface.svg('polyline');
      points.dataset.travelDraft = 'true';
      points.setAttribute(
        'points',
        this.host.travel.routeStops
          .map((h) => {
            const p = hexPoint(h);
            return (p.x / 3 ** this.level) * 100 + ',' + (p.y / 3 ** this.level) * 100;
          })
          .join(' '),
      );
      points.setAttribute('fill', 'none');
      points.setAttribute('stroke', '#4d6854');
      points.setAttribute('stroke-width', '3');
      points.setAttribute('stroke-dasharray', '3 7');
      points.setAttribute('pointer-events', 'none');
      root.append(points);
      for (const [i, h] of this.host.travel.routeStops.entries()) {
        const p = hexPoint(h),
          label = this.host.surface.svg('text');
        label.dataset.routeStop = String(i + 1);
        label.setAttribute('x', String((p.x / 3 ** this.level) * 100));
        label.setAttribute('y', String((p.y / 3 ** this.level) * 100 - 24));
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('paint-order', 'stroke');
        label.setAttribute('stroke', '#fff');
        label.setAttribute('stroke-width', '4');
        label.setAttribute('font-size', '20');
        label.setAttribute('pointer-events', 'none');
        label.textContent = String(i + 1);
        root.append(label);
      }
    }
    for (const place of this.world?.places.filter((p) => p.mapId === m.id && !p.trashed) ?? []) {
      if (passive && !known.has(hexKey(place))) continue;
      const p = hexPoint(place),
        x = (p.x / 3 ** this.level) * 100,
        y = (p.y / 3 ** this.level) * 100,
        style =
          this.markerDraft?.id === place.locationId
            ? this.markerDraft.presentation
            : (place.presentation ?? defaultMarkerPresentation),
        unit = style.size / this.viewZoom,
        marker = this.host.surface.svg('path'),
        label = this.host.surface.svg('text');
      marker.setAttribute('d', markerSymbols.find((s) => s.id === style.symbol)!.path);
      marker.setAttribute('transform', `translate(${x} ${y}) scale(${unit})`);
      marker.setAttribute('fill-rule', 'evenodd');
      marker.setAttribute('stroke-width', '2');
      marker.setAttribute('stroke-linejoin', 'round');
      marker.style.cursor = 'pointer';
      const hint = this.host.surface.svg('title');
      hint.textContent = place.name;
      marker.append(hint);
      marker.setAttribute('fill', '#f4ead4');
      marker.setAttribute('stroke', '#26384a');
      marker.dataset.locationId = place.locationId;
      const choose = () =>
        this.host.surface.run(async () => {
          if (this.host.travel.routeMode !== 'edit') {
            this.host.travel.chooseRouteHex(pointHex(p.x, p.y, 3 ** this.level), place.locationId);
            return;
          }
          if (!(await this.host.writes.flushWorld())) return;
          this.selected = pointHex(p.x, p.y, 3 ** this.level);
          this.host.surface.el<HTMLSelectElement>('world-anchor-location').value = place.locationId;
          this.renderLocationOptions();
          this.loadMarkerEditor();
          this.renderCell();
          this.host.surface.el<HTMLSelectElement>('world-destination').value = place.locationId;
          this.host.surface.el<HTMLInputElement>('travel-q').value = String(place.q);
          this.host.surface.el<HTMLInputElement>('travel-r').value = String(place.r);
          this.renderMap();
        });
      marker.addEventListener('click', choose);
      label.style.cursor = 'pointer';
      label.setAttribute('pointer-events', 'bounding-box');
      label.addEventListener('click', choose);
      const right = style.labelPosition === 'right',
        lx = x + (right ? 25 * unit : 0),
        ly =
          y +
          (style.labelPosition === 'below' ? 43 : style.labelPosition === 'right' ? 9 : -25) * unit;
      label.dataset.markerLabel = place.locationId;
      label.setAttribute('x', String(lx));
      label.setAttribute('y', String(ly));
      label.setAttribute('text-anchor', right ? 'start' : 'middle');
      label.setAttribute('font-size', String(30 * unit));
      label.setAttribute('paint-order', 'stroke');
      label.setAttribute('stroke', '#f7f9fc');
      label.setAttribute('stroke-width', '4');
      label.setAttribute('stroke-linejoin', 'round');
      const title = style.title || place.name;
      if (style.curve && style.labelPosition !== 'hidden') {
        const path = this.host.surface.svg('path'),
          width = Math.max(120, title.length * 20) * unit,
          id = 'marker-label-' + place.locationId;
        path.id = id;
        path.setAttribute(
          'd',
          `M${lx - (right ? 0 : width / 2)} ${ly} q${width / 2} ${(-style.curve * width) / 2} ${width} 0`,
        );
        path.setAttribute('fill', 'none');
        path.setAttribute('pointer-events', 'none');
        const text = this.host.surface.svg('textPath');
        text.setAttribute('href', '#' + id);
        text.setAttribute('startOffset', right ? '0%' : '50%');
        text.textContent = title;
        label.append(text);
        root.append(path);
      } else label.textContent = title;
      root.append(marker);
      if (style.labelPosition !== 'hidden') root.append(label);
    }
    if (this.frame?.position.mapId === m.id) {
      const p = hexPoint(this.frame.position),
        marker = this.host.surface.svg('circle');
      marker.setAttribute('cx', String((p.x / 3 ** this.level) * 100));
      marker.setAttribute('cy', String((p.y / 3 ** this.level) * 100));
      marker.setAttribute('r', '15');
      marker.setAttribute('fill', '#b7413d');
      marker.setAttribute('stroke', '#fff');
      marker.setAttribute('stroke-width', '4');
      marker.dataset.partyToken = this.frame.scene.id;
      marker.setAttribute('aria-label', 'Party-Token · Hex ' + hexKey(this.frame.position));
      marker.setAttribute('pointer-events', 'all');
      marker.style.cursor = 'grab';
      const title = this.host.surface.svg('title');
      title.textContent =
        'Party ziehen: administrativ platzieren, ohne Reisezeit. Tastatur: Hex mit Pfeiltasten wählen, dann Gruppe am Cursor platzieren.';
      marker.append(title);
      root.append(marker);
    }
    const dest = this.host.surface.el<HTMLSelectElement>('world-destination'),
      old = dest.value;
    dest.replaceChildren();
    this.host.surface.option(dest, '', 'Hex aus Karte oder Koordinaten');
    for (const p of this.world?.places.filter((p) => p.mapId === m.id && !p.trashed) ?? [])
      this.host.surface.option(dest, p.locationId, p.name);
    dest.value = old;
    this.host.surface.el('world-scale').textContent =
      ((m.hexMeters * 3 ** this.level) / 1000).toFixed(2) +
      ' km je Hex · Ansicht ' +
      Math.round(this.viewZoom * 100) +
      ' %';
    this.host.surface.el<HTMLSelectElement>('world-edit-level').value = String(this.level);
    this.host.surface.el<HTMLButtonElement>('world-zoom-in').disabled = this.viewZoom >= 3;
    this.host.surface.el<HTMLButtonElement>('world-zoom-out').disabled = this.viewZoom <= 0.5;
    this.host.travel.renderRouteDraft();
  };

  initWorld = () => {
    let recovery = this.host.surface.el('world-write-recovery');
    if (!recovery) {
      recovery = this.host.surface.document.createElement('div');
      recovery.id = 'world-write-recovery';
      recovery.hidden = true;
      recovery.innerHTML =
        '<span>Die Weltänderung ist noch unklar. Eingaben bleiben offen.</span> <button id="world-write-check">Auftrag prüfen</button>';
      this.host.surface.el('status').after(recovery);
      this.host.surface.register(recovery);
    }
    this.host.surface.el('world-write-check').onclick = () => {
      void this.host.writes.reconcileWorldWrite();
    };
    const terrainOptions = Object.entries(terrainNames)
        .map(([id, name]) => `<option value="${id}">${name}</option>`)
        .join(''),
      climateOptions = Object.entries(climateNames)
        .map(([id, name]) => `<option value="${id}">${name}</option>`)
        .join('');
    this.host.surface.el('world').innerHTML =
      `<div class="catalog-heading"><h2>Atlas, Reise und Kalender</h2></div><div id="world-travel-home"></div><div id="world-travel-owner"><div class="toolbar world-map-selection"><label>Karte<select id="world-map-select"></select></label><button id="world-map-new">Neue Hexkarte</button><button id="world-map-copy">Karte duplizieren</button><label class="world-scene-selection">Gruppe<select id="world-scene"></select></label><button id="world-group-center">Zur Gruppe</button></div><p id="world-current"></p><div id="world-map-workspace" hidden><div class="world-columns world-map-columns"><section class="world-map-canvas"><div class="world-authoring world-map-title"><label>Kartenname<input id="world-map-name" form="world-map-form" required></label><button type="submit" form="world-map-form">Karte speichern</button></div><div class="toolbar"><button id="world-zoom-in">+ Näher</button><button id="world-zoom-out">− Weiter</button></div><div id="hex-author-tools" class="toolbar world-authoring"><label class="check-label"><input id="hex-paint" type="checkbox"> Gelände malen</label><select id="hex-brush" aria-label="Pinselgelände">${terrainOptions}</select><label>Radius (Hexes)<input id="hex-brush-radius" type="number" min="0" max="5" value="0"></label></div><svg id="world-map" tabindex="0" role="group" aria-label="Bearbeitbare Hexkarte mit Orten und Partyposition"></svg><details class="world-map-navigation"><summary>Verschieben und Tastatur</summary><div class="toolbar world-map-pan"><button data-world-pan="-5,0">←</button><button data-world-pan="0,-5">↑</button><button data-world-pan="0,5">↓</button><button data-world-pan="5,0">→</button></div><span id="world-scale"></span><label class="check-label"><input id="world-passive" type="checkbox"> Wissen der Gruppe anzeigen</label><p id="world-map-gesture-hint" class="caption"></p></details><details class="world-authoring"><summary>Karteneinstellungen und Austausch</summary><label>Bearbeitungsraster<select id="world-edit-level">${Array.from({ length: 13 }, (_, i) => `<option value="${i}">${i === 0 ? 'Lokale Hexes' : 'Stufe ' + i + ' · ' + 3 ** i + '× Hexgröße'}</option>`).join('')}</select></label><p class="caption">Gröbere Raster haben eigene Geländeeinträge. Zoomen oben ändert nur die Ansicht.</p><form id="world-map-form"><div class="time-fields"><label>Lokales Hex in km<input id="world-hex-size" type="number" min=".001" step="any"></label><label>Fallbackklima<select id="world-climate">${climateOptions}</select></label></div><label>Wettermuster<input id="world-seed"></label></form><div class="toolbar"><button id="world-map-export">Kartendaten anzeigen</button><button id="world-map-import">Als neue Karte übernehmen</button></div><textarea id="world-map-json" rows="5" aria-label="Kartendaten zum Kopieren oder Importieren"></textarea></details></section><section class="world-authoring"><h3 id="hex-selected"></h3><p id="hex-authored-status" class="caption"></p><form id="hex-form"><label>Beschriftung<input id="hex-label"></label><details><summary>Gelände und Reiseeigenschaften</summary><div class="time-fields"><label>Gelände<select id="hex-terrain">${terrainOptions}</select></label><label>Höhe (m)<input id="hex-elevation" type="number" value="0"></label></div><label>Regionales Klima<select id="hex-climate"><option value="">Kartenklima erben</option>${climateOptions}</select></label><div class="toolbar"><label class="check-label"><input id="hex-road" type="checkbox"> Straße</label><label class="check-label"><input id="hex-river" type="checkbox"> Fluss</label></div><label>Fraktion / Einfluss<input id="hex-faction"></label><label>Reiseunterbrechung<textarea id="hex-interrupt" rows="2" placeholder="Zum Beispiel: Weg blockiert – GM entscheidet."></textarea></label></details><button type="submit">Hex speichern</button></form><section class="world-marker-editor"><h3>Ortsmarker</h3><label>Orte suchen<input id="world-anchor-search" type="search" placeholder="Name, Stadttyp oder Kartenname"></label><label>Ort<select id="world-anchor-location"></select></label><div class="toolbar"><button id="world-anchor-focus" type="button">Marker zeigen</button><button id="world-anchor-save" type="button">Ort auf diesem Hex platzieren</button></div><p id="world-marker-status" class="caption" role="status"></p><form id="world-marker-form"><fieldset id="world-marker-fields"><legend>Kartendarstellung</legend><label>Beschriftung überschreiben<input id="world-marker-title" maxlength="200" placeholder="Ortsname verwenden"></label><label>Symbol<select id="world-marker-symbol">${markerSymbols.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}</select></label><label>Markergröße<input id="world-marker-size" type="range" min="0.5" max="3" step="0.05" value="1"></label><label>Beschriftungsposition<select id="world-marker-label-position"><option value="above">Über dem Symbol</option><option value="below">Unter dem Symbol</option><option value="right">Rechts neben dem Symbol</option><option value="hidden">Ausgeblendet</option></select></label><label>Beschriftung krümmen<input id="world-marker-curve" type="range" min="-1" max="1" step="0.05" value="0"></label><button type="submit">Darstellung speichern</button><button id="world-marker-reset" type="button">Standarddarstellung</button></fieldset></form></section><div class="toolbar"><button id="world-place-group">Gruppe hier platzieren</button><button id="world-reveal">Für diese Gruppe aufdecken</button></div><p class="caption">Platzieren ändert keine Reisezeit. Zum Reisen die Vorschau annehmen und Abschnitte bestätigen.</p></section></div><section class="world-travel"><h3>Reise der ausgewählten Gruppe</h3><div class="toolbar"><button id="travel-mode-edit" type="button" aria-pressed="true">Karte bearbeiten</button><button id="travel-mode-target" type="button" aria-pressed="false">Ziel wählen</button><button id="travel-mode-route" type="button" aria-pressed="false">Wegpunkte wählen</button><button id="travel-route-clear" type="button">Route leeren</button></div><p id="travel-selected-hex" class="caption"></p><p id="travel-placement-status" class="caption" role="status">Party-Token ziehen oder Gruppe am Cursor platzieren · ohne Reisezeit.</p><p id="travel-draft-status"></p><button id="travel-place-cursor" type="button">Gruppe am Cursor platzieren</button><ol id="travel-stops"></ol><div id="travel-evaluation">Keine aktuelle Routenauswertung.</div><div id="travel-console-warnings" role="status"></div><form id="world-travel-form"><label>Ziel<select id="world-destination"><option value="">Hex aus Karte oder Koordinaten</option></select></label><label class="check-label"><input id="travel-party-pace" type="checkbox" checked> Tempo aus der langsamsten Figur ableiten</label><p id="travel-pace-context" class="caption" role="status"></p><div class="combat-fields"><label>Ziel q<input id="travel-q" type="number" value="0"></label><label>Ziel r<input id="travel-r" type="number" value="0"></label><label>Tempo (km/h)<input id="travel-pace" type="number" value="4" min=".1" step="any"></label><label>Zeitfaktor<input id="travel-factor" type="number" value="1" min=".01" step="any"></label></div><div class="time-fields"><label>Wegpunkte q,r; q,r (optional)<input id="travel-waypoints" placeholder="1,0; 2,1"></label><label>Enddauer in Stunden (optional; hat Vorrang)<input id="travel-final-hours" type="number" min=".001" step="any"></label></div><button id="travel-preview-open" type="submit">Route und Reisezeit ansehen</button></form><p id="world-journey-status"></p><p id="world-journey-refresh" role="status"></p><div class="toolbar"><button id="journey-play" type="button" aria-label="Reise wiedergeben">▶ Wiedergeben</button><button id="journey-slower" type="button" aria-label="Reise langsamer wiedergeben">−</button><output id="journey-speed" aria-label="Wiedergabegeschwindigkeit">1×</output><button id="journey-faster" type="button" aria-label="Reise schneller wiedergeben">+</button></div><p id="journey-playback-status" role="status"></p><div class="toolbar"><button id="journey-step">Nächsten Abschnitt bestätigen</button><button id="journey-many">Bis zur nächsten Grenze weiter</button><button id="journey-pause">Pause</button><button id="journey-end">Reise beenden</button><button id="journey-replan">Restweg neu bewerten…</button><button id="journey-wait">Pausieren / warten…</button><button id="journey-rest">Pausieren / rasten…</button></div><div id="world-relevant-events"></div><details><summary>Reise- und Weltverlauf</summary><div id="world-history"></div></details></section></div></div></div><div class="world-columns"><section><h3>Kampagnenkalender</h3><form id="calendar-form"><label>Name<input id="calendar-name" required></label><div class="time-fields"><label>Erstes Jahr<input id="calendar-year" type="number" value="1"></label><label>Stunden je Tag<input id="calendar-hours" type="number" min="1" max="168" step="any" value="24"></label></div><label>Monate: Name: Tage (eine Zeile je Monat)<textarea id="calendar-months" rows="8"></textarea></label><label>Wochentage, kommagetrennt<input id="calendar-weekdays"></label><button type="submit">Kalender speichern</button></form><p class="caption">Der Kalender deutet gespeicherte Zeitpunkte. Ein Kalenderwechsel verschiebt keine aufgezeichnete Reise.</p><h3>Feiertage und Ereignisse</h3><button id="world-agenda-open" type="button">Ereignisse und Papierkorb öffnen…</button></section><section><h3>Bewegte Wetterereignisse</h3><p>Klima und Jahreszeit bilden den Grundzustand. Eigene Wettergebiete ergänzen ihn; eine GM-Vorgabe für eine Gruppe bleibt bis zur Freigabe bestehen.</p><select id="phen-select"></select><button id="phen-new">Neues Wettergebiet</button><form id="phen-editor" hidden><label>Name<input id="phen-name"></label><div class="combat-fields"><label>Wetter<select id="phen-kind"><option value="storm">Sturm</option><option value="rain">Regen</option><option value="snow">Schnee</option><option value="fog">Nebel</option><option value="clouds">Bewölkt</option><option value="clear">Klar</option></select></label><label>Intensität (%)<input id="phen-intensity" type="number" min="0" max="100"></label><label>Gebietsradius in Hexes<input id="phen-radius" type="number" min=".1" step="any"></label><label>Status<select id="phen-state"><option value="active">Aktiv</option><option value="paused">Pausiert</option><option value="ended">Beendet</option></select></label></div><div class="combat-fields"><label>Zentrum q<input id="phen-q" type="number"></label><label>Zentrum r<input id="phen-r" type="number"></label><label>Bewegung q / 24 Stunden<input id="phen-move-q" type="number" step="any"></label><label>Bewegung r / 24 Stunden<input id="phen-move-r" type="number" step="any"></label></div><div class="combat-fields"><label>Beginn: Tage seit Start<input id="phen-start" type="number" min="0" step="any"></label><label>Dauer in Tagen<input id="phen-duration" type="number" min=".001" step="any"></label><label>Temperatur °C (optional)<input id="phen-temperature" type="number" step="any"></label><label>Reisefaktor (optional)<input id="phen-travel" type="number" min=".1" step="any"></label></div><label>Hinweise / Effekte<textarea id="phen-notes" rows="3"></textarea></label><button type="submit">Wettergebiet speichern</button></form></section></div><dialog id="travel-preview-dialog"><h2>Reisevorschau</h2><p id="travel-preview-summary"></p><div id="travel-preview-warnings"></div><div id="travel-preview-itinerary"></div><div class="actions"><button id="travel-preview-cancel">Abbrechen</button><button id="travel-preview-accept">Reise starten</button></div></dialog>`;
    this.host.surface.el('live-world-panel').innerHTML =
      `<h3>Weltzeit und Wetter</h3><p id="live-world-summary"></p><button id="live-agenda-open" type="button">Agenda / Fristen…</button><div id="live-agenda-upcoming"></div><p id="live-weather-effects" class="caption"></p><div id="live-world-notices"></div><div class="toolbar"><button id="live-travel-toggle" type="button" aria-expanded="false" aria-controls="live-travel-host">Reisekarte am Spieltisch</button><button id="live-open-world">Atlas bearbeiten</button></div><div id="live-travel-host" hidden><p id="live-travel-context" class="caption"></p><p id="live-travel-empty" hidden>Noch keine Hexkarte. Lege im Atlas eine Karte an und platziere die Gruppe.</p><button id="live-travel-retry" type="button" hidden>Reisekontext erneut laden</button></div><details><summary>Wetter für diese Gruppe vorgeben</summary><form id="weather-override-form"><div class="combat-fields"><label>Wetter<select id="weather-override-kind"><option value="clear">Klar</option><option value="clouds">Bewölkt</option><option value="rain">Regen</option><option value="snow">Schnee</option><option value="fog">Nebel</option><option value="storm">Sturm</option></select></label><label>Intensität (%)<input id="weather-override-intensity" type="number" min="0" max="100" value="70"></label><label>Temperatur °C<input id="weather-override-temperature" type="number" value="15"></label><label>Reisefaktor<input id="weather-override-factor" type="number" min=".1" step="any" value="1"></label></div><label>GM-Hinweis<input id="weather-override-notes"></label><div class="toolbar"><button type="submit">GM-Wetter übernehmen</button><button id="weather-discard-input" type="button">Eigene Eingabe verwerfen</button><button id="weather-release" type="button">Wetterautomatik freigeben</button></div></form></details>`;
    this.host.surface.register(this.host.surface.el('world'));
    this.host.surface.register(this.host.surface.el('live'));
    this.host.calendar.installCalendarRules();
    this.host.travel.mountTravelLayout();
    // Keep one set of map/travel controls; arrange it by the GM's current task.

    const mapInput = () => {
        this.dirtyMap = true;
        this.mapEdits++;
      },
      cellInput = () => {
        this.dirtyCell = true;
        this.mapEdits++;
      };
    const accessField = this.host.surface.document.createElement('fieldset');
    accessField.id = 'hex-access-fields';
    accessField.innerHTML =
      '<legend>Passierbarkeit für Reisen</legend><label>Hex-Zugang<select id="hex-access"><option value="open">Frei passierbar</option><option value="blocked">Gesperrt</option><option value="requires">Benötigt Voraussetzung</option></select></label><label>Voraussetzung oder Sperrgrund<input id="hex-access-requirement" maxlength="200" placeholder="Zum Beispiel Boot oder eingestürzte Brücke"></label><p>Ungezeichnetes Gelände bleibt passierbar. Geländeart und Straße heben eine ausdrückliche Sperre nicht auf.</p>';
    this.host.surface.el('hex-form').append(accessField);
    accessField.oninput = () => this.host.travel.clearTravelPreview();

    this.host.surface.el('world-map-name').oninput = mapInput;
    for (const [id, input] of [
      ['world-map-form', mapInput],
      ['hex-form', cellInput],
    ] as const) {
      this.host.surface.el(id).oninput = input;
    }
    for (const id of ['world-map-form', 'hex-form', 'phen-editor'])
      this.host.surface.el(id).onsubmit = (e) => {
        e.preventDefault();
        this.host.surface.run(async () => {
          if (await this.host.writes.flushWorld()) {
            await this.reloadScene();
            this.renderMapFields();
            this.renderMap();
            this.renderCell();
            this.host.calendar.renderCalendar();
            this.host.travel.renderJourney();
            this.host.weather.renderPhenomenonOptions();
            await this.host.surface.after();
            this.host.surface.tell('Welt und Reise gespeichert.');
          }
        });
      };
    this.host.surface.el('world-map-new').onclick = () =>
      this.host.surface.run(async () => {
        if (!(await this.host.writes.flushWorld())) return;
        const m: AtlasMap = {
          id: crypto.randomUUID(),
          revision: 0,
          name: 'Neue Region',
          hexMeters: 4828.032,
          climate: 'temperate',
          seed: crypto.randomUUID(),
          cells: [],
        };
        await this.host.writes.raw({ kind: 'map', map: m, expectedRevision: null });
        await this.openWorld();
        this.host.travel.resetRouteDraft();
        this.host.surface.el<HTMLSelectElement>('world-map-select').value = m.id;
        this.mapDraft = structuredClone(this.world!.maps.find((p) => p.id === m.id)!);
        this.center = { q: 0, r: 0 };
        this.selected = { q: 0, r: 0 };
        this.renderMapFields();
        this.renderMap();
        this.renderCell();
      });
    this.host.surface.el('world-map-copy').onclick = () =>
      this.host.surface.run(async () => {
        if (!(await this.host.writes.flushWorld()) || !this.mapDraft) return;
        const m = {
          ...structuredClone(this.mapDraft),
          id: crypto.randomUUID(),
          revision: 0,
          name: this.mapDraft.name + ' – Kopie',
        };
        await this.host.writes.raw({ kind: 'map', map: m, expectedRevision: null });
        await this.openWorld();
        this.host.travel.resetRouteDraft();
        this.host.surface.el<HTMLSelectElement>('world-map-select').value = m.id;
        this.mapDraft = structuredClone(this.world!.maps.find((p) => p.id === m.id)!);
        this.center = { q: 0, r: 0 };
        this.selected = { q: 0, r: 0 };
        this.renderMapFields();
        this.renderMap();
        this.renderCell();
      });
    this.host.surface.el('world-map-select').onchange = () => {
      void this.selectWorldMap().catch((error) => this.host.surface.tell(error.message, true));
    };
    this.host.surface.el('world-scene').onchange = () => {
      const picker = this.host.surface.el<HTMLSelectElement>('world-scene'),
        id = picker.value,
        previous = this.frame?.scene.id ?? '',
        token = this.workspace?.token;
      this.sceneRead++;
      this.host.travel.sceneSelectionRequested();
      const selection = this.host.travel.sceneSelection,
        current = this.host.surface.editorSession.capture(() => [
          this.workspace?.token,
          this.host.travel.sceneSelection,
        ]);
      picker.value = previous;
      if (id === previous) {
        picker.setAttribute('aria-busy', 'false');
        return;
      }
      picker.setAttribute('aria-busy', 'true');
      this.host.surface.run(async () => {
        try {
          if (
            !(await this.host.writes.flushWorld()) ||
            !current() ||
            this.workspace?.token !== token
          )
            return;
          this.host.travel.resetRouteDraft();
          picker.value = id;
          await this.reloadScene();
          if (!current()) return;
          this.host.travel.renderJourney();
          this.renderMap();
        } finally {
          if (current() && this.host.travel.sceneSelection === selection)
            picker.setAttribute('aria-busy', 'false');
        }
      });
    };
    this.host.surface.listen(this.host.surface.document.defaultView!, 'resize', () => {
      this.suspendMapPointer();
      this.renderMap();
    });
    const zoom = (delta: number) => {
      this.suspendMapPointer();
      this.worldCanvas?.zoom(1.25 ** delta);
    };
    this.host.surface.el('world-zoom-in').onclick = () => zoom(-1);
    this.host.surface.el('world-zoom-out').onclick = () => zoom(1);
    this.host.surface.el('world-edit-level').onchange = () => {
      const next = Number(this.host.surface.value('world-edit-level'));
      this.host.surface.run(async () => {
        if (!(await this.host.writes.flushWorld())) {
          this.host.surface.el<HTMLSelectElement>('world-edit-level').value = String(this.level);
          return;
        }
        this.mapGestures?.finish();
        const p = hexPoint(this.center, 3 ** this.level),
          selection = hexPoint(this.selected, 3 ** this.level);
        this.host.travel.mapLevelChanged(this.level, next);
        this.level = next;
        this.center = pointHex(p.x, p.y, 3 ** this.level);
        this.selected = pointHex(selection.x, selection.y, 3 ** this.level);
        this.renderMap(true);
        this.renderCell();
      });
    };
    for (const b of this.host.surface
      .el('world')
      .querySelectorAll<HTMLButtonElement>('[data-world-pan]'))
      b.onclick = () => {
        this.suspendMapPointer();
        const [q, r] = b.dataset.worldPan!.split(',').map(Number),
          shift = hexPoint({ q: q!, r: r! });
        this.worldCanvas?.pan(shift.x * 100, shift.y * 100);
      };
    this.host.surface.el('world-passive').onchange = this.renderMap;
    const canvas = this.host.surface.el('world-map') as unknown as SVGSVGElement,
      tools = this.host.surface.document.createElement('div');
    tools.innerHTML =
      '<button id="hex-paint-undo" type="button" disabled aria-label="Geländestrich zurücknehmen" title="Geländestrich zurücknehmen (Strg+Z)">↶</button><button id="hex-paint-redo" type="button" disabled aria-label="Geländestrich wiederholen" title="Geländestrich wiederholen (Strg+Umschalt+Z)">↷</button><span id="hex-paint-status" role="status"></span>';
    this.host.surface.el('hex-author-tools').append(...tools.children);
    const gestureHint = this.host.surface.el('world-map-gesture-hint');
    gestureHint.textContent =
      'Karte ziehen zum Verschieben, Mausrad zum Zoomen. Mit Gelände malen zeichnet Ziehen einen zusammenhängenden Strich; Alt oder mittlere Maustaste verschiebt auch bei aktivem Pinsel. Auf der fokussierten Karte: Pfeiltasten wählen Hexes, Alt+Pfeiltasten verschieben; Strg+Z und Strg+Umschalt+Z.';
    // Settle only the adopter's local draft before the shared surface changes CTM.
    ownedEventTarget(canvas, this.host.surface.cleanups).addEventListener(
      'wheel',
      (e) => {
        if (e.deltaY) this.suspendMapPointer();
      },
      { capture: true, passive: true },
    );
    ownedEventTarget(canvas, this.host.surface.cleanups).addEventListener(
      'pointerdown',
      (e) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) this.suspendMapPointer();
      },
      true,
    );
    this.partyDrag = installHexPartyDrag(canvas, {
      key: this.host.travel.placementKey,
      begin: () => {
        this.host.travel.playback.stop();
        return (
          !this.host.travel.playback.busy &&
          !this.host.writes.pendingWork.value &&
          !this.host.writes.uncertainState.value &&
          !this.host.writes.checkingWorldWriteWork.value &&
          !this.host.writes.worldWrites.size &&
          !this.dirtyMap &&
          !this.dirtyCell &&
          !this.host.travel.transportBusy
        );
      },
      target: (x, y) => {
        if (!this.mapDraft || !this.worldCanvas?.hit(x, y)) return null;
        const box = canvas.getBoundingClientRect();
        if (x < box.left || x > box.right || y < box.top || y > box.bottom) return null;
        const matrix = canvas.getScreenCTM();
        if (!matrix) return null;
        const p = new DOMPoint(x, y).matrixTransform(matrix.inverse()),
          h = pointHex(p.x / 100, p.y / 100);
        if (!authoredCellAt(this.mapDraft, h, this.level)) return null;
        const local = hexPoint(h, 3 ** this.level),
          point = hexPoint(h);
        return { hex: pointHex(local.x, local.y), x: point.x * 100, y: point.y * 100 };
      },
      drop: (h, key) => this.host.travel.placePartyAt(h, true, key),
      status: (text, error) => {
        this.host.surface.el('travel-placement-status').textContent = text;
        this.host.surface.el('travel-placement-status').dataset.error = String(!!error);
      },
    });
    this.worldCanvas = new PassiveMapCanvas(canvas, {
      initial: this.hexCameraBox(),
      minWidth: 520,
      maxWidth: 3120,
      prepareCamera: this.suspendMapPointer,
      locked: () => !!this.mapGestures?.active || !!this.partyDrag?.active,
      pan: (e) =>
        e.button === 1 ||
        (e.button === 0 &&
          this.host.travel.routeMode === 'edit' &&
          (!this.host.surface.el<HTMLInputElement>('hex-paint').checked || e.altKey)),
      changed: (box) => {
        this.viewZoom = 1560 / box.width;
        this.center = pointHex((box.x + box.width / 2) / 100, (box.y + box.height / 2) / 100);
        this.canvasBasis = this.cameraBasis();
        this.renderMap();
      },
    });
    this.mapGestures = installHexMapGestures(canvas, {
      controls: {
        undo: this.host.surface.el<HTMLButtonElement>('hex-paint-undo'),
        redo: this.host.surface.el<HTMLButtonElement>('hex-paint-redo'),
        status: this.host.surface.el('hex-paint-status'),
      },
      state: () =>
        this.workspace && this.mapDraft
          ? {
              owner: this.workspace.token,
              map: this.mapDraft,
              level: this.level,
              center: { ...this.center },
              mode: this.host.travel.routeMode,
              paint: this.host.surface.el<HTMLInputElement>('hex-paint').checked,
              terrain: this.host.surface.value('hex-brush') as Terrain,
              radius: Math.max(
                0,
                Math.min(5, Math.floor(this.host.surface.number('hex-brush-radius'))),
              ),
            }
          : null,
      prepare: () => {
        if (
          this.host.writes.pendingWork.value ||
          this.host.writes.uncertainState.value ||
          this.host.writes.worldWrites.size
        ) {
          this.host.surface.tell('Kartenspeicherung zuerst abschließen.', true);
          return false;
        }
        if (this.dirtyCell) this.collectCell();
        return true;
      },
      pan: (h) => {
        this.partyDrag?.cancel('Platzierung abgebrochen · Kartenansicht verschoben.');
        const delta = hexPoint({ q: h.q - this.center.q, r: h.r - this.center.r });
        this.worldCanvas?.cancel();
        this.worldCanvas?.pan(delta.x * 100, delta.y * 100);
      },
      select: (h) => {
        this.selected = h;
        this.host.travel.mapCursorSelected(h);
      },
      render: () => {
        this.renderMap();
        this.renderCell();
      },
      changed: () => {
        this.dirtyMap = true;
        this.mapEdits++;
      },
      commit: () => Promise.resolve().then(() => this.host.writes.flushWorld()),
      tell: this.host.surface.tell,
    });
    this.host.surface.el('world-group-center').onclick = () =>
      this.host.surface.run(async () => {
        if (!(await this.host.writes.flushWorld())) return;
        await this.reloadScene();
        if (!this.frame?.position.mapId) return;
        if (this.mapDraft?.id !== this.frame.position.mapId) this.host.travel.resetRouteDraft();
        this.mapDraft = structuredClone(
          this.world!.maps.find((m) => m.id === this.frame!.position.mapId)!,
        );
        this.host.surface.el<HTMLSelectElement>('world-map-select').value = this.mapDraft.id;
        const p = hexPoint(this.frame.position);
        this.center = pointHex(p.x, p.y, 3 ** this.level);
        this.selected = this.center;
        this.host.travel.mapCursorSelected(this.center);
        this.canvasBasis = '';
        this.renderMapFields();
        this.renderMap();
        this.renderCell();
      });
    const localHex = () => {
      const p = hexPoint(this.selected, 3 ** this.level);
      return pointHex(p.x, p.y);
    };
    this.host.surface.el('world-anchor-save').onclick = () =>
      this.host.surface.run(async () => {
        if (!this.mapDraft || !this.host.surface.value('world-anchor-location'))
          throw new Error('Karte und Ort auswählen.');
        const old = this.world?.places.find(
          (p) => p.locationId === this.host.surface.value('world-anchor-location'),
        );
        const location = this.sources?.locations.find(
          (l) => !l.trashed && l.document.id === this.host.surface.value('world-anchor-location'),
        );
        if (!location) throw new Error('Ort nicht verfügbar. Quellen neu laden.');
        await this.host.writes.action({
          kind: 'place',
          mapId: this.mapDraft.id,
          locationId: this.host.surface.value('world-anchor-location'),
          expectedLocationRevision: location.revision,
          expectedRevision: old?.revision ?? null,
          hex: localHex(),
        });
        this.renderLocationOptions();
        this.loadMarkerEditor();
      });
    this.host.surface.el('world-anchor-search').oninput = this.renderLocationOptions;
    this.host.surface.el('world-anchor-location').onchange = () => {
      const id = this.host.surface.value('world-anchor-location'),
        token = this.workspace?.token,
        request = ++this.markerSelection;
      // Keep identity and fields together while the old marker's save is unresolved.
      this.host.surface.el<HTMLSelectElement>('world-anchor-location').value =
        this.markerDraft?.id ?? '';
      this.host.surface.el<HTMLFieldSetElement>('world-marker-fields').disabled = true;
      this.host.surface.el('world-marker-status').textContent = 'Markerauswahl wird übernommen …';
      this.host.surface.run(async () => {
        const saved = await this.flushMarker();
        if (this.workspace?.token !== token || request !== this.markerSelection) return;
        if (!saved) {
          this.host.surface.el<HTMLSelectElement>('world-anchor-location').value =
            this.markerDraft?.id ?? '';
          this.host.surface.el<HTMLFieldSetElement>('world-marker-fields').disabled =
            !this.markerDraft;
          this.host.surface.el('world-marker-status').textContent =
            'Markerwechsel nicht übernommen. Speicherstatus prüfen; bisheriger Ort bleibt ausgewählt.';
          return;
        }
        this.host.surface.el<HTMLSelectElement>('world-anchor-location').value = id;
        this.loadMarkerEditor();
        this.renderMap();
      });
    };
    this.host.surface.el('world-anchor-focus').onclick = () =>
      this.host.surface.run(async () => {
        if (!(await this.host.writes.flushWorld())) return;
        const place = this.world?.places.find(
          (p) => p.locationId === this.host.surface.value('world-anchor-location'),
        );
        if (!place) return;
        if (this.mapDraft?.id !== place.mapId) this.host.travel.resetRouteDraft();
        this.mapDraft = structuredClone(this.world!.maps.find((m) => m.id === place.mapId)!);
        this.host.surface.el<HTMLSelectElement>('world-map-select').value = this.mapDraft.id;
        const p = hexPoint(place);
        this.selected = pointHex(p.x, p.y, 3 ** this.level);
        this.center = { ...this.selected };
        this.host.travel.mapCursorSelected(this.selected);
        this.canvasBasis = '';
        this.renderMapFields();
        this.renderMap();
        this.renderCell();
        this.host.weather.renderPhenomenonOptions();
      });
    for (const id of ['title', 'symbol', 'size', 'label-position', 'curve']) {
      const input = this.host.surface.el<HTMLInputElement>('world-marker-' + id);
      input.oninput = this.collectMarker;
      input.onchange = () => {
        this.collectMarker();
        this.host.surface.run(this.flushMarker);
      };
      input.onblur = () => this.host.surface.run(this.flushMarker);
      if (input.type === 'range') input.onpointerup = () => this.host.surface.run(this.flushMarker);
    }
    this.host.surface.el('world-marker-form').onsubmit = (event) => {
      event.preventDefault();
      this.host.surface.run(this.flushMarker);
    };
    this.host.surface.el('world-marker-reset').onclick = () => {
      if (!this.markerDraft) return;
      for (const [key, v] of Object.entries({
        title: '',
        symbol: 'pin',
        size: '1',
        'label-position': 'above',
        curve: '0',
      }))
        this.host.surface.el<HTMLInputElement>('world-marker-' + key).value = v;
      this.collectMarker();
      this.host.surface.run(this.flushMarker);
    };
    this.host.surface.el('world-place-group').onclick = () =>
      this.host.surface.run(async () => {
        if (!this.mapDraft || !this.frame) throw new Error('Karte und aktive Gruppe auswählen.');
        const h = localHex(),
          loc = this.world?.places.find(
            (p) => p.mapId === this.mapDraft!.id && !p.trashed && hexKey(p) === hexKey(h),
          );
        await this.host.writes.action({
          kind: 'place-scene',
          sceneId: this.frame.scene.id,
          expectedSceneRevision: this.frame.scene.revision,
          expectedPositionRevision: this.frame.position.revision,
          position: { ...h, mapId: this.mapDraft.id, locationId: loc?.locationId ?? null },
        });
      });
    this.host.surface.el('world-reveal').onclick = () =>
      this.host.surface.run(async () => {
        if (!this.mapDraft || !this.frame) return;
        await this.host.writes.action({
          kind: 'reveal',
          sceneId: this.frame.scene.id,
          mapId: this.mapDraft.id,
          hex: localHex(),
          expectedMembershipRevision: this.frame.scene.membershipRevision,
        });
      });
    this.host.travel.mountTravelControls();

    this.host.surface.el('world-map-export').onclick = () =>
      this.host.surface.run(async () => {
        if (await this.host.writes.flushWorld())
          this.host.surface.el<HTMLTextAreaElement>('world-map-json').value = JSON.stringify(
            this.mapDraft,
            null,
            2,
          );
      });
    this.host.surface.el('world-map-import').onclick = () =>
      this.host.surface.run(async () => {
        if (!(await this.host.writes.flushWorld())) return;
        const m = JSON.parse(this.host.surface.value('world-map-json')) as AtlasMap;
        await this.host.writes.raw({
          kind: 'map',
          map: { ...m, id: crypto.randomUUID(), revision: 0 },
          expectedRevision: null,
        });
        await this.openWorld();
      });
    this.host.weather.mountWeatherControls();

    this.host.surface.el('live-open-world').onclick = () =>
      this.host.surface.run(this.host.surface.enter);
  };

  activate = (w: WorkspaceGeometry) => {
    this.partyDrag?.cancel();
    this.worldRead++;
    this.mapSelection++;
    this.host.surface.el('world-map-select').setAttribute('aria-busy', 'false');
    this.mapGestures?.reset();
    this.workspace = w;
    this.markerDraft = null;
    this.markerSelection++;
    this.world = null;
    this.sources = null;
    this.live = null;
    this.frame = null;
    this.mapDraft = null;
    this.dirtyMap = false;
    this.dirtyCell = false;
    this.level = 0;
    this.viewZoom = 1;
    this.selected = { q: 0, r: 0 };
    this.center = { q: 0, r: 0 };
  };

  flushDraft = async () => {
    if (this.dirtyMap && this.mapDraft) {
      const version = this.mapEdits,
        id = this.mapDraft.id;
      this.mapDraft.name = this.host.surface.value('world-map-name');
      this.mapDraft.hexMeters = this.host.surface.number('world-hex-size') * 1000;
      this.mapDraft.climate = this.host.surface.value('world-climate') as Climate;
      this.mapDraft.seed = this.host.surface.value('world-seed');
      const ack = await this.host.writes.raw({
        kind: 'map',
        map: this.mapDraft,
        expectedRevision: this.mapDraft.revision,
      });
      const confirmed = ack.world.maps.find((m) => m.id === id)!;
      if (this.mapDraft?.id === id) {
        if (this.mapEdits === version) this.mapDraft = structuredClone(confirmed);
        else this.mapDraft.revision = confirmed.revision;
        this.dirtyMap = this.mapEdits !== version;
      }
    }
  };

  acceptSnapshot = (ack: import('./world-contracts').WorldAck) => {
    this.world = ack.world;
    if (ack.scene && this.frame?.scene.id === ack.scene.scene.id) this.frame = ack.scene;
  };
  acceptConfirmed = (
    command: import('./world-contracts').WorldCommand,
    ack: import('./world-contracts').WorldAck,
    versions: import('./world-editor-types').WorldEdits,
  ) => {
    this.acceptSnapshot(ack);
    const a = command.action;
    if (a.kind === 'map' && this.mapDraft?.id === a.map.id) {
      const confirmed = ack.world.maps.find((m) => m.id === a.map.id)!;
      if (this.mapEdits === versions.map) this.mapDraft = structuredClone(confirmed);
      else this.mapDraft.revision = confirmed.revision;
      this.dirtyMap = this.mapEdits !== versions.map;
    } else if (a.kind === 'place-presentation' && this.markerDraft?.id === a.locationId) {
      const place = ack.world.places.find((p) => p.locationId === a.locationId);
      if (place) {
        this.markerDraft.revision = place.presentationRevision ?? 0;
        this.markerDraft.dirty = this.markerEdits !== versions.marker;
        if (!this.markerDraft.dirty) this.loadMarkerEditor();
      }
    }
  };
}
