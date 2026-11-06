import { canonicalJson } from '../campaign/generation/canonical-json';
import { ownedEventTarget } from '../shared/owned-event-target';
import { HexAccessChoices } from './hex-access-ui';
import { journeyPlayback, journeySpeeds } from './journey-playback';
import { liveHexSurface } from './live-hex-surface';
import { partyTravelPace } from './travel-pace';
import { renderTravelBriefing, renderTravelEvaluation } from './travel-preview-ui';
import type { Hex } from './world-cell-contracts';
import type { SceneWorld, WorldAction } from './world-contracts';
import type { TravelPreview, TravelRequest } from './world-travel-contracts';
import type { WorldEditorSurface } from './world-editor-surface';
import type { TravelOwner } from './world-editor-types';
import { hexKey, hexPoint, pointHex, terrainFactor, terrainNames } from './world-model';
import type {
  WorldCalendarPort,
  WorldMapPort,
  WorldWeatherPort,
  WorldWritePort,
} from './world-owner-ports';

interface Host {
  map: Pick<
    WorldMapPort,
    | 'center'
    | 'readTravelCell'
    | 'projectLiveGroup'
    | 'prepareLiveScene'
    | 'unavailableScene'
    | 'closeLiveRead'
    | 'useAtlasTargetLevel'
    | 'navigateCursor'
    | 'dirtyCell'
    | 'dirtyMap'
    | 'frame'
    | 'level'
    | 'live'
    | 'mapDraft'
    | 'mapSelection'
    | 'openWorld'
    | 'partyDrag'
    | 'reloadScene'
    | 'renderCell'
    | 'renderMap'
    | 'renderMapFields'
    | 'selected'
    | 'viewZoom'
    | 'workspace'
    | 'world'
  >;
  surface: Pick<
    WorldEditorSurface,
    | 'after'
    | 'api'
    | 'before'
    | 'button'
    | 'camp'
    | 'changed'
    | 'cleanups'
    | 'dialogOpen'
    | 'document'
    | 'editorSession'
    | 'el'
    | 'listen'
    | 'liveSurface'
    | 'number'
    | 'option'
    | 'run'
    | 'tell'
    | 'unwrap'
    | 'value'
  >;
  weather: Pick<
    WorldWeatherPort,
    'dirtyPhenomenon' | 'liveFocusId' | 'renderLiveWorld' | 'weatherBusy' | 'weatherDirty'
  >;
  writes: Pick<
    WorldWritePort,
    | 'checkingWorldWriteWork'
    | 'flushWorld'
    | 'pendingWork'
    | 'raw'
    | 'uncertainState'
    | 'worldWrites'
  >;
  calendar: Pick<WorldCalendarPort, 'dirtyCalendar'>;
}
export class WorldTravelEditor {
  constructor(readonly host: Host) {
    this.playback = journeyPlayback({
      read: () => this.playbackFrame(),
      step: async (basis) => {
        const j = this.host.map.frame?.journey;
        if (!j || j.revision !== basis.revision || j.nextIndex !== basis.nextIndex) return false;
        return this.changeJourney({
          kind: 'journey-step',
          id: j.id,
          expectedRevision: j.revision,
          maxSteps: 1,
        });
      },
      changed: () => this.renderPlayback(),
    });
  }
  travelSurface: ReturnType<typeof liveHexSurface> | null = null;

  travelOpenRequest = 0;

  preview: TravelPreview | null = null;

  routeMode: 'edit' | 'target' | 'route' = 'edit';

  routeCursor: Hex = { q: 0, r: 0 };

  routeStops: Hex[] = [];

  liveTravelOpen = false;

  liveSurface = false;

  liveBoundSceneId: string | null = null;

  travelRequest = 0;

  placementDisplayOwner = '';
  sceneSelection = 0;

  worldSurface = 'atlas';

  transportBusy = false;

  playbackJourneyId: string | null = null;

  playback: ReturnType<typeof journeyPlayback>;

  sceneSelectionRequested = () => {
    this.sceneSelection++;
    this.transportBusy = false;
    this.playback.stop();
    this.clearTravelPreview();
  };

  sceneSelectionChanged = () => {
    this.sceneSelectionRequested();
    this.resetRouteDraft();
  };

  mapCursorSelected = (hex: Hex) => {
    this.routeCursor = { ...hex };
  };

  mapLevelChanged = (previous: number, next: number) => {
    const cursor = hexPoint(this.routeCursor, 3 ** previous);
    this.routeCursor = pointHex(cursor.x, cursor.y, 3 ** next);
  };

  journeyContextLoaded = () => {
    this.routeMode = 'target';
    this.renderRouteDraft();
  };

  journeyBasisChanged = () => {
    const j = this.host.map.frame?.journey;
    return (
      !!j &&
      !!this.host.map.frame &&
      (this.host.map.frame.scene.clock.revision !== j.clockRevision ||
        this.host.map.frame.position.revision !== j.positionRevision ||
        this.host.map.frame.scene.membershipRevision !== j.membershipRevision ||
        this.host.map.world?.maps.find((m) => m.id === j.mapId)?.revision !== j.mapRevision)
    );
  };

  showsJourneyMap = () => {
    const j = this.host.map.frame?.journey;
    return (
      !!j &&
      this.host.map.mapDraft?.id === j.mapId &&
      this.host.surface.value('world-map-select') === j.mapId
    );
  };

  playbackFrame = () => {
    const j = this.host.map.frame?.journey;
    if (
      !this.host.map.workspace ||
      !j ||
      j.status !== 'active' ||
      !this.showsJourneyMap() ||
      this.host.map.frame?.scene.id !== this.host.surface.value('world-scene') ||
      this.host.surface.document.visibilityState === 'hidden' ||
      (this.worldSurface !== 'world' &&
        this.worldSurface !== 'atlas' &&
        !(this.liveSurface && this.liveTravelOpen)) ||
      this.host.surface.dialogOpen() ||
      this.journeyBasisChanged() ||
      this.host.weather.weatherDirty ||
      this.host.weather.weatherBusy ||
      this.host.writes.pendingWork.value ||
      this.host.writes.uncertainState.value ||
      this.host.writes.checkingWorldWriteWork.value ||
      this.host.writes.worldWrites.size ||
      this.host.map.dirtyMap ||
      this.host.map.dirtyCell ||
      this.host.calendar.dirtyCalendar ||
      this.host.weather.dirtyPhenomenon
    )
      return null;
    return {
      key: this.host.map.workspace.token + ':' + j.sceneId + ':' + j.mapId + ':' + j.id,
      revision: j.revision,
      nextIndex: j.nextIndex,
      seconds: j.segmentSeconds[j.nextIndex - 1]!,
    };
  };

  renderPlayback = () => {
    const label = this.host.surface.el('journey-playback-status');
    if (!label) return;
    const j = this.host.map.frame?.journey,
      open = !!j && ['active', 'paused', 'interrupted'].includes(j.status),
      busy = this.transportBusy || this.playback.busy;
    const startable =
      !!this.preview &&
      !!this.host.map.frame &&
      !!this.host.map.mapDraft &&
      this.preview.request.sceneId === this.host.map.frame.scene.id &&
      this.preview.request.mapId === this.host.map.mapDraft.id &&
      this.host.map.frame.position.mapId === this.host.map.mapDraft.id &&
      !!this.host.map.frame.scene.members.length;
    label.textContent =
      !startable && open && !this.showsJourneyMap()
        ? 'Für die Wiedergabe die Reisekarte auswählen.'
        : this.playback.running
          ? 'Wiedergabe ' +
            this.playback.speed +
            '× · jeder erreichte Hex bestätigt Position und Zeit.'
          : open
            ? 'Wiedergabe pausiert · Fortsetzen startet am letzten bestätigten Hex.'
            : '1× = eine Echtsekunde je Spielstunde. Geschwindigkeit ändert keine Reisezeit.';
    this.host.surface.el('journey-speed').textContent = this.playback.speed + '×';
    this.host.surface.el<HTMLButtonElement>('journey-slower').disabled = this.playback.speed === 1;
    this.host.surface.el<HTMLButtonElement>('journey-faster').disabled = this.playback.speed === 10;
    const play = this.host.surface.el<HTMLButtonElement>('journey-play');
    play.parentElement!.hidden = !!j && !open && !startable;
    label.hidden = !!j && !open && !startable;
    play.disabled =
      busy ||
      (!startable &&
        (!open || !this.showsJourneyMap() || this.playback.running || this.journeyBasisChanged()));
    play.textContent = startable
      ? this.preview!.continuation
        ? '▶ Restreise starten'
        : '▶ Reise starten'
      : j?.status === 'paused' || j?.status === 'interrupted'
        ? '▶ Fortsetzen'
        : '▶ Wiedergeben';
    play.setAttribute('aria-label', startable ? 'Ausgewertete Reise starten' : 'Reise wiedergeben');
    for (const id of ['journey-step', 'journey-many'])
      if (busy) this.host.surface.el<HTMLButtonElement>(id).disabled = true;
    this.host.surface.el<HTMLButtonElement>('journey-pause').disabled =
      !open || this.transportBusy || (!this.playback.running && j?.status !== 'active');
    this.host.surface.el<HTMLButtonElement>('journey-end').disabled = !open || this.transportBusy;
    this.renderTravelHistory();
  };

  renderTravelHistory = () => {
    const group = this.host.surface.el('travel-history-controls');
    if (!group) return;
    const history = this.host.map.frame?.travelHistory,
      j = this.host.map.frame?.journey;
    group.hidden = !history?.undo && !history?.redo;
    this.host.surface.el('travel-history-summary').textContent =
      (history?.undo
        ? 'Letzter Schritt: ' + history.undo.label
        : history?.redo
          ? 'Wiederholen: ' + history.redo.label
          : '') +
      (history?.undo?.retainedShared || history?.redo?.retainedShared
        ? ' · Später bestätigte gemeinsame Weltfakten bleiben erhalten.'
        : '');
    for (const direction of ['undo', 'redo'] as const) {
      const item = history?.[direction],
        control = this.host.surface.el<HTMLButtonElement>('travel-' + direction);
      control.hidden = !item;
      control.disabled =
        this.transportBusy ||
        this.playback.busy ||
        !!this.host.writes.pendingWork.value ||
        !!this.host.writes.uncertainState.value ||
        !!this.host.writes.checkingWorldWriteWork.value ||
        this.host.writes.worldWrites.size > 0 ||
        !item ||
        item.journeyId !== j?.id ||
        this.journeyBasisChanged();
      control.textContent =
        direction === 'undo' ? 'Letzten Reiseschritt zurücknehmen' : 'Reiseschritt wiederholen';
      control.title = item?.label ?? '';
    }
  };

  changeTravelHistory = async (direction: 'undo' | 'redo') => {
    const attached = this.host.surface.editorSession.capture(() => [
      this.sceneSelection,
      this.host.map.mapSelection,
    ]);
    const owner = this.travelOwner(),
      source = this.host.map.frame,
      step = source?.travelHistory?.[direction];
    if (!owner || !source?.journey || !step || this.transportBusy) return;
    const current = () =>
      this.ownsTravel(owner) &&
      this.host.map.frame?.travelHistory?.[direction]?.id === step.id &&
      this.host.map.frame?.travelHistory?.[direction]?.revision === step.revision;
    this.transportBusy = true;
    this.playback.stop();
    this.renderPlayback();
    try {
      await this.playback.settled();
      if (!current()) {
        if (this.ownsTravel(owner))
          this.travelFeedback(
            'Der bestätigte Reiseschritt hat sich geändert. Rücknahmeziel erneut prüfen.',
          );
        return;
      }
      if (!(await this.host.writes.flushWorld()) || !current()) return;
      await this.host.writes.raw(
        {
          kind: 'travel-history',
          sceneId: source.scene.id,
          id: step.id,
          revision: step.revision,
          direction,
          expectedClockRevision: source.scene.clock.revision,
          expectedPositionRevision: source.position.revision,
          expectedJourneyRevision: source.journey.revision,
        },
        () => this.ownsTravel(owner),
      );
      if (!this.ownsTravel(owner)) return;
      this.clearTravelPreview();
      await this.host.map.reloadScene();
      this.host.map.renderMap();
      this.renderJourney();
      await this.host.surface.after();
    } catch (error) {
      if (this.ownsTravel(owner)) this.travelFailure(error);
    } finally {
      if (attached()) {
        this.transportBusy = false;
        this.renderPlayback();
      }
    }
  };

  transport = async (kind: 'play' | 'pause' | 'end' | 'step' | 'many') => {
    const attached = this.host.surface.editorSession.capture(() => [
      this.sceneSelection,
      this.host.map.mapSelection,
    ]);
    if (kind === 'play' && this.preview) {
      if (!this.transportBusy) {
        this.transportBusy = true;
        this.renderPlayback();
        try {
          await this.acceptTravelPreview();
        } finally {
          if (attached()) {
            this.transportBusy = false;
            this.renderPlayback();
          }
        }
      }
      return;
    }
    const owner = this.travelOwner(),
      journeyId = this.host.map.frame?.journey?.id;
    if (!owner || !journeyId || this.transportBusy) return;
    this.transportBusy = true;
    this.playback.stop();
    this.renderPlayback();
    try {
      await this.playback.settled();
      if (!this.ownsTravel(owner) || this.host.map.frame?.journey?.id !== journeyId) return;
      const j = this.host.map.frame.journey;
      if (['arrived', 'ended'].includes(j.status) || (kind === 'play' && !this.showsJourneyMap()))
        return;
      const ok =
        kind === 'play'
          ? j.status === 'active' ||
            (await this.changeJourney({
              kind: 'journey-state',
              id: j.id,
              expectedRevision: j.revision,
              state: 'active',
            }))
          : await this.changeJourney(
              kind === 'step' || kind === 'many'
                ? {
                    kind: 'journey-step',
                    id: j.id,
                    expectedRevision: j.revision,
                    maxSteps: kind === 'step' ? 1 : 12,
                  }
                : {
                    kind: 'journey-state',
                    id: j.id,
                    expectedRevision: j.revision,
                    state: kind === 'pause' ? 'paused' : 'ended',
                  },
            );
      if (ok && kind === 'play' && this.ownsTravel(owner)) this.playback.play();
    } finally {
      if (attached()) {
        this.transportBusy = false;
        this.renderJourney();
      }
    }
  };

  travelOwner = (): TravelOwner | null => {
    return this.host.map.workspace &&
      this.host.map.frame?.scene.id === this.host.surface.value('world-scene')
      ? {
          token: this.host.map.workspace.token,
          sceneId: this.host.map.frame.scene.id,
          mapId: this.host.surface.value('world-map-select'),
          generation: this.host.surface.editorSession.generation,
          sceneSelection: this.sceneSelection,
          mapSelection: this.host.map.mapSelection,
        }
      : null;
  };

  ownsTravel = (owner: TravelOwner) => {
    return (
      this.host.surface.editorSession.status.attached &&
      this.host.surface.editorSession.generation === owner.generation &&
      this.sceneSelection === owner.sceneSelection &&
      this.host.map.mapSelection === owner.mapSelection &&
      this.host.map.workspace?.token === owner.token &&
      this.host.map.frame?.scene.id === owner.sceneId &&
      this.host.surface.value('world-scene') === owner.sceneId &&
      this.host.surface.value('world-map-select') === owner.mapId
    );
  };

  travelFeedback = (text = '') => {
    const message = this.host.surface.el('journey-feedback');
    if (message) {
      message.textContent = text;
      message.hidden = !text;
    }
  };

  travelFailure = (error: unknown) => {
    const text = (error as Error).message;
    this.travelFeedback(text);
    this.host.surface.tell(text, true);
  };

  clearTravelPreview = () => {
    this.travelFeedback();
    this.travelRequest++;
    this.preview = null;
    this.host.surface.changed('atlas-draft');
    if (this.host.surface.el('travel-evaluation'))
      this.host.surface.el('travel-evaluation').textContent = 'Keine aktuelle Routenauswertung.';
    this.host.surface.el('travel-preview-summary').textContent = '';
    this.host.surface.el('travel-preview-warnings').replaceChildren();
    this.host.surface.el('travel-preview-itinerary').replaceChildren();
    this.host.surface.el<HTMLButtonElement>('travel-preview-accept').disabled = true;
    const dialog = this.host.surface.el<HTMLDialogElement>('travel-preview-dialog');
    if (dialog.open) dialog.close();
    if (this.host.surface.el('travel-console-warnings'))
      this.host.surface.el('travel-console-warnings').replaceChildren();
    this.renderPlayback();
  };

  resetRouteDraft = () => {
    this.accessChoices?.render('', []);
    this.routeCursor = { q: 0, r: 0 };
    this.writeRouteStops([]);
  };

  writeRouteStops = (stops: Hex[], locationId: string | null = null) => {
    if (stops.length > 21) throw new Error('Höchstens 20 Wegpunkte plus Reiseziel.');
    this.routeStops = stops.map((h) => ({ ...h }));
    this.clearTravelPreview();
    this.host.surface.el<HTMLInputElement>('travel-waypoints').value = stops
      .slice(0, -1)
      .map(hexKey)
      .join('; ');
    const last = stops.at(-1);
    this.host.surface.el<HTMLInputElement>('travel-q').value = last ? String(last.q) : '';
    this.host.surface.el<HTMLInputElement>('travel-r').value = last ? String(last.r) : '';
    this.host.surface.el<HTMLSelectElement>('world-destination').value = locationId ?? '';
    this.renderRouteDraft();
    this.host.map.renderMap();
  };

  readRouteInputs = (): Hex[] | null => {
    try {
      const stops = this.host.surface
        .value('travel-waypoints')
        .split(';')
        .filter((t) => t.trim())
        .map((t) => {
          const parts = t.split(',');
          if (parts.length !== 2 || parts.some((p) => !p.trim()))
            throw new Error('Wegpunkte vollständig als q,r eingeben.');
          return { q: Number(parts[0]), r: Number(parts[1]) };
        });
      if (['travel-q', 'travel-r'].some((id) => !this.host.surface.value(id).trim()))
        throw new Error('Zielkoordinaten q und r vollständig eingeben.');
      stops.push({
        q: this.host.surface.number('travel-q'),
        r: this.host.surface.number('travel-r'),
      });
      if (
        stops.length > 21 ||
        stops.some((h) => !Number.isSafeInteger(h.q) || !Number.isSafeInteger(h.r))
      )
        throw new Error('Ganze Hexkoordinaten und höchstens 21 Stationen eingeben.');
      this.routeStops = stops;
      this.renderRouteDraft();
      this.host.map.renderMap();
      return stops;
    } catch (error) {
      this.routeStops = [];
      this.renderRouteDraft();
      this.host.map.renderMap();
      this.host.surface.el('travel-draft-status').textContent = (error as Error).message;
      return null;
    }
  };

  chooseRouteHex = (h: Hex, locationId: string | null = null) => {
    this.routeCursor = { ...h };
    const p = hexPoint(h, 3 ** this.host.map.level),
      fine = pointHex(p.x, p.y);
    if (this.routeMode === 'route') {
      this.writeRouteStops([...this.routeStops, fine], locationId);
    } else this.writeRouteStops([...this.routeStops.slice(0, -1), fine], locationId);
    this.renderRouteDraft();
    this.host.map.renderMap();
  };

  renderPartyPace = () => {
    const auto = this.host.surface.el<HTMLInputElement>('travel-party-pace').checked,
      field = this.host.surface.el<HTMLInputElement>('travel-pace'),
      members =
        this.host.map.live?.roster.filter(
          (c) => c.active && c.sceneId === this.host.surface.value('world-scene'),
        ) ?? [],
      pace = partyTravelPace(members);
    field.disabled = !!auto;
    if (auto) field.value = String(pace.kmh);
    this.host.surface.el('travel-pace-context').textContent =
      'Reisegruppe: ' +
      (members.map((c) => c.profile.name).join(', ') || 'keine aktive Figur') +
      (auto
        ? ' · Langsamste Bewegung: ' +
          pace.feet +
          ' ft → ' +
          pace.kmh.toFixed(2) +
          ' km/h.' +
          (pace.missing.length
            ? ' Bewegung fehlt bei ' + pace.missing.join(', ') + ': 30 ft angenommen.'
            : '')
        : ' · Manuelle GM-Vorgabe.');
  };

  renderRouteDraft = () => {
    if (!this.host.surface.el('travel-stops')) return;
    const placementReady =
      !!this.host.map.frame &&
      this.host.map.frame.scene.id === this.host.surface.value('world-scene') &&
      !!this.host.map.mapDraft &&
      this.host.map.mapDraft.id === this.host.surface.value('world-map-select') &&
      !!this.host.map.frame.scene.members.length;
    const placementContext = [
      this.host.map.workspace?.token,
      this.host.surface.value('world-scene'),
      this.host.surface.value('world-map-select'),
      this.host.weather.liveFocusId,
      placementReady,
    ].join(':');
    if (placementContext !== this.placementDisplayOwner) {
      this.placementDisplayOwner = placementContext;
      this.host.surface.el('travel-placement-status').textContent = placementReady
        ? 'Party-Token ziehen oder Gruppe am Cursor platzieren · ohne Reisezeit.'
        : 'Kein bestätigter Gruppenkontext für eine Platzierung.';
      this.host.surface.el('travel-placement-status').dataset.error = 'false';
    }
    const selectedRow = this.host.surface.el('travel-selected-hex');
    if (selectedRow) {
      const p = hexPoint(
          this.routeMode === 'edit' ? this.host.map.selected : this.routeCursor,
          3 ** this.host.map.level,
        ),
        h = pointHex(p.x, p.y),
        c = this.host.map.readTravelCell(h);
      selectedRow.textContent = this.host.map.mapDraft
        ? hexKey(h) +
          ' · ' +
          (c ? terrainNames[c.terrain] + ' · Kosten ×' + terrainFactor(c).toFixed(2) : '')
        : 'Kein Hex ausgewählt';
    }
    this.host.surface
      .el('world-travel-owner')
      .classList.toggle('travel-planning', this.routeMode !== 'edit');
    this.renderPartyPace();
    for (const mode of ['edit', 'target', 'route'])
      this.host.surface
        .el('travel-mode-' + mode)
        .setAttribute('aria-pressed', String(mode === this.routeMode));
    this.host.surface.el<HTMLButtonElement>('travel-preview-open').disabled =
      !this.routeStops.length ||
      !this.host.map.frame ||
      !this.host.map.mapDraft ||
      this.host.map.frame.position.mapId !== this.host.map.mapDraft.id ||
      !this.host.map.frame.scene.members.length;
    this.host.surface.el<HTMLButtonElement>('travel-place-cursor').disabled =
      !this.host.map.frame || !this.host.map.mapDraft || !this.host.map.frame.scene.members.length;
    const root = this.host.surface.el('travel-stops');
    root.replaceChildren();
    for (const [i, h] of this.routeStops.entries()) {
      const li = this.host.surface.document.createElement('li'),
        name = this.host.map.world?.places.find(
          (p) => p.mapId === this.host.map.mapDraft?.id && !p.trashed && hexKey(p) === hexKey(h),
        )?.name;
      li.append(
        this.host.surface.document.createTextNode(
          (i === this.routeStops.length - 1 ? 'Ziel: ' : 'Wegpunkt ' + (i + 1) + ': ') +
            (name ? name + ' · ' : '') +
            hexKey(h) +
            ' ',
        ),
      );
      for (const [text, delta] of [
        ['↑', -1],
        ['↓', 1],
      ] as const) {
        const b = this.host.surface.button(text, () => {
          const j = i + delta;
          if (j < 0 || j >= this.routeStops.length) return;
          const next = this.routeStops.slice();
          [next[i], next[j]] = [next[j]!, next[i]!];
          this.writeRouteStops(next);
        });
        b.disabled = i + delta < 0 || i + delta >= this.routeStops.length;
        b.setAttribute(
          'aria-label',
          'Station ' + (i + 1) + (delta < 0 ? ' nach oben' : ' nach unten'),
        );
        li.append(b);
      }
      li.append(
        this.host.surface.button('Entfernen', () =>
          this.writeRouteStops(this.routeStops.filter((_, j) => j !== i)),
        ),
      );
      root.append(li);
    }
    const p = hexPoint(this.routeCursor, 3 ** this.host.map.level),
      base = pointHex(p.x, p.y),
      cell = this.host.map.readTravelCell(base);
    this.host.surface.el('travel-draft-status').textContent =
      this.routeMode === 'edit'
        ? 'Kartenbearbeitung: Hexauswahl und Malen.'
        : 'Kartenmodus ' +
          (this.routeMode === 'route' ? 'Wegpunkte' : 'Ziel') +
          ' · Cursor ' +
          hexKey(base) +
          (cell
            ? ' · ' +
              terrainNames[cell.terrain] +
              ' · Grundkosten ×' +
              terrainFactor(cell).toFixed(2)
            : '') +
          ' · Pfeiltasten bewegen, Enter wählen.';
    this.host.surface
      .el('travel-place-cursor')
      .setAttribute('aria-label', 'Gruppe auf Hex ' + hexKey(base) + ' platzieren');
  };

  placementKey = () => {
    const o = this.travelOwner();
    return o &&
      this.host.map.frame &&
      this.host.map.mapDraft &&
      o.mapId === this.host.map.mapDraft.id &&
      this.host.map.frame.scene.members.length &&
      this.host.map.frame.position.mapId === this.host.map.mapDraft.id &&
      (!this.liveSurface || (this.liveTravelOpen && this.host.weather.liveFocusId === o.sceneId))
      ? JSON.stringify([
          o.token,
          o.sceneId,
          o.mapId,
          this.host.map.frame.scene.revision,
          this.host.map.frame.scene.membershipRevision,
          this.host.map.frame.position.revision,
          this.host.map.frame.scene.clock.revision,
          this.host.map.mapDraft.revision,
          this.host.map.level,
          this.worldSurface,
          this.host.weather.liveFocusId,
        ])
      : null;
  };

  placePartyAt = async (h: Hex, requireAuthored = false, key = this.placementKey()) => {
    const owner = this.travelOwner();
    if (!owner || !this.host.map.mapDraft || !this.host.map.frame)
      throw new Error('Karte und aktive Gruppe auswählen.');
    const request = this.travelRequest,
      scene = structuredClone(this.host.map.frame.scene),
      positionRevision = this.host.map.frame.position.revision,
      mapRevision = this.host.map.mapDraft.revision,
      locationId =
        this.host.map.world?.places.find(
          (p) => p.mapId === owner.mapId && !p.trashed && hexKey(p) === hexKey(h),
        )?.locationId ?? null;
    if (
      this.host.map.frame.position.mapId === owner.mapId &&
      hexKey(this.host.map.frame.position) === hexKey(h) &&
      this.host.map.frame.position.locationId === locationId
    ) {
      this.host.surface.el('travel-placement-status').textContent =
        'Standort unverändert · keine neue Platzierung nötig.';
      this.host.surface.el('travel-placement-status').dataset.error = 'false';
      return;
    }
    this.host.surface.el('travel-placement-status').textContent = 'Platzierung wird geprüft…';
    this.host.surface.el('travel-placement-status').dataset.error = 'false';
    this.playback.stop();
    if (this.playback.busy) throw new Error('Laufenden Reiseabschnitt zuerst abschließen.');
    if (
      !(await this.host.writes.flushWorld()) ||
      !this.ownsTravel(owner) ||
      key !== this.placementKey()
    )
      throw new Error('Gruppe oder Karte inzwischen geändert. Platzierung erneut wählen.');
    await this.host.writes.raw(
      {
        kind: 'place-scene',
        sceneId: scene.id,
        expectedSceneRevision: scene.revision,
        expectedPositionRevision: positionRevision,
        placementBasis: {
          mapRevision,
          membershipRevision: scene.membershipRevision,
          requireAuthored,
        },
        position: { ...h, mapId: owner.mapId, locationId },
      },
      () => this.ownsTravel(owner) && key === this.placementKey(),
    );
    if (!this.ownsTravel(owner)) return;
    // A placement invalidates evaluations from the old position, not newer route input.
    if (request === this.travelRequest) this.resetRouteDraft();
    else this.clearTravelPreview();
    await this.host.map.reloadScene();
    if (!this.ownsTravel(owner)) return;
    this.host.map.renderMap();
    this.renderJourney();
    await this.host.surface.after();
    if (!this.ownsTravel(owner)) return;
    this.host.surface.el('travel-placement-status').dataset.error = 'false';
    this.host.surface.el('travel-placement-status').textContent =
      'Gruppe auf Hex ' + hexKey(h) + ' platziert · keine Reisezeit.';
  };

  placeRouteCursor = async () => {
    const p = hexPoint(this.routeCursor, 3 ** this.host.map.level);
    try {
      await this.placePartyAt(pointHex(p.x, p.y));
    } catch (error) {
      this.host.surface.el('travel-placement-status').textContent = (error as Error).message;
      this.host.surface.el('travel-placement-status').dataset.error = 'true';
      throw error;
    }
  };

  makeTravelPreview = async (continueJourney = false, atlas = false) => {
    const owner = this.travelOwner();
    if (!owner) return;
    this.playback.stop();
    await this.playback.settled();
    if (!this.ownsTravel(owner)) return;
    this.clearTravelPreview();
    const request = this.travelRequest;
    try {
      if (
        (this.liveTravelOpen && this.liveSurface && !(await this.host.surface.before())) ||
        !(await this.host.writes.flushWorld()) ||
        !this.ownsTravel(owner) ||
        request !== this.travelRequest ||
        this.host.map.frame?.scene.id !== owner.sceneId ||
        this.host.map.mapDraft?.id !== owner.mapId
      )
        return;
      const j = continueJourney ? this.host.map.frame.journey : null;
      if (continueJourney && (!j || !['active', 'paused', 'interrupted'].includes(j.status)))
        throw new Error('Kein offener Restweg.');
      const stops = j ? null : this.readRouteInputs();
      if (!j && !stops) return;
      const requested: TravelRequest = {
        sceneId: owner.sceneId,
        mapId: owner.mapId,
        destination: j ? j.route.at(-1)! : stops!.at(-1)!,
        destinationLocationId: j
          ? j.destinationLocationId
          : this.host.surface.value('world-destination') || null,
        waypoints: j ? [] : stops!.slice(0, -1),
        paceKmh: this.host.surface.number('travel-pace'),
        ...(this.host.surface.el<HTMLInputElement>('travel-party-pace').checked
          ? { usePartyPace: true }
          : {}),
        factor: this.host.surface.number('travel-factor'),
        ...(this.accessChoices?.values().length ? { supplies: this.accessChoices.values() } : {}),
        finalSeconds: this.host.surface.value('travel-final-hours')
          ? Math.ceil(this.host.surface.number('travel-final-hours') * 3600)
          : null,
        ...(j ? { continuation: { journeyId: j.id, expectedRevision: j.revision } } : {}),
      };
      const result = this.host.surface.unwrap(
        await this.host.surface.api.previewTravel(owner.token, requested),
      );
      if (!this.ownsTravel(owner) || request !== this.travelRequest) return;
      // Automatic pace is resolved by the provider; every other requested value must match.
      const echoed = requested.usePartyPace
        ? { ...result.request, paceKmh: requested.paceKmh }
        : result.request;
      if (canonicalJson(echoed) !== canonicalJson(requested))
        throw new Error('Auswertung gehört nicht zur angefragten Reise. Erneut auswerten.');
      if (result.request.usePartyPace)
        this.host.surface.el<HTMLInputElement>('travel-pace').value = String(
          result.request.paceKmh,
        );
      this.preview = result;
      this.host.surface.changed('atlas-draft');
      renderTravelEvaluation(this.host.surface.el('travel-evaluation'), result);
      this.host.surface.el('travel-preview-summary').textContent =
        (result.distanceMeters / 1000).toFixed(2) +
        ' km · ' +
        (result.durationSeconds / 3600).toFixed(2) +
        ' Stunden · ' +
        (result.route.length - 1) +
        ' Abschnitte · Ankunft: ' +
        result.arrival;
      const warnings = this.host.surface.el('travel-preview-warnings');
      warnings.replaceChildren();
      for (const warning of result.warnings) {
        const p = this.host.surface.document.createElement('p');
        p.textContent = warning;
        warnings.append(p);
      }
      renderTravelBriefing(this.host.surface.el('travel-preview-itinerary'), result);
      this.host.surface.el<HTMLButtonElement>('travel-preview-accept').textContent =
        result.continuation ? 'Restreise starten' : 'Reise starten';
      this.host.map.renderMap();
      this.host.surface.el<HTMLButtonElement>('travel-preview-accept').disabled = false;
      if (!atlas && this.liveSurface && this.liveTravelOpen) {
        this.host.surface.el<HTMLDetailsElement>('travel-advanced').open = false;
        const root = this.host.surface.el('travel-console-warnings');
        root.replaceChildren();
        for (const text of result.warnings) {
          const p = this.host.surface.document.createElement('p');
          p.textContent = text;
          root.append(p);
        }
        this.renderJourney();
        this.revealTravelInRail(this.host.surface.el('travel-evaluation'));
      } else if (!atlas)
        this.host.surface.el<HTMLDialogElement>('travel-preview-dialog').showModal();
      this.host.surface.tell('Route und Reisezeit ausgewertet.');
    } catch (error) {
      if (this.ownsTravel(owner) && request === this.travelRequest) this.travelFailure(error);
    }
  };

  revealTravelInRail = (target: HTMLElement) => {
    const rail = target.closest<HTMLElement>('.live-desk-reference');
    if (rail?.getBoundingClientRect && target.getBoundingClientRect)
      rail.scrollTop += target.getBoundingClientRect().top - rail.getBoundingClientRect().top;
  };

  acceptTravelPreview = async (atlas = false) => {
    const owner = this.travelOwner(),
      source = this.preview;
    if (!owner || !source) return;
    const current = () => this.ownsTravel(owner) && this.preview === source;
    this.travelFeedback();
    try {
      if (!(await this.host.writes.flushWorld()) || !current()) return;
      await this.host.writes.raw(
        { kind: 'journey', preview: source, presentationSpeed: this.playback.speed },
        current,
      );
      if (!current()) return;
      this.resetRouteDraft();
      this.routeMode = 'target';
      await this.host.map.reloadScene();
      this.host.map.renderMap();
      this.renderJourney();
      this.renderRouteDraft();
      await this.host.surface.after();
      if (this.ownsTravel(owner)) {
        if (!atlas) {
          if (this.liveSurface && this.liveTravelOpen)
            this.revealTravelInRail(this.host.surface.el('world-journey-console'));
          else this.host.surface.el('world-journey-console').scrollIntoView({ block: 'start' });
        }
        this.playback.play();
      }
    } catch (error) {
      if (current()) this.travelFailure(error);
    }
  };

  changeJourney = async (
    action: Extract<
      WorldAction,
      {
        kind: 'journey-step' | 'journey-state';
      }
    >,
  ) => {
    const owner = this.travelOwner(),
      id = this.host.map.frame?.journey?.id;
    if (!owner || id !== action.id) return false;
    const current = () =>
      this.ownsTravel(owner) &&
      this.host.map.frame?.scene.id === owner.sceneId &&
      this.host.map.frame?.journey?.id === id;
    this.travelFeedback();
    try {
      if (!(await this.host.writes.flushWorld()) || !current()) return false;
      await this.host.writes.raw(action, current);
      if (!this.ownsTravel(owner)) return false;
      this.clearTravelPreview();
      await this.host.map.reloadScene();
      this.host.map.renderMap();
      this.renderJourney();
      await this.host.surface.after();
      return this.ownsTravel(owner);
    } catch (error) {
      if (current()) this.travelFailure(error);
      return false;
    }
  };

  replanRemainingJourney = async () => {
    const j = this.host.map.frame?.journey;
    if (!j) return;
    this.host.surface.el<HTMLInputElement>('travel-party-pace').checked = !!j.usePartyPace;
    this.renderPartyPace();
    this.host.surface.el<HTMLInputElement>('travel-pace').value = String(j.paceKmh);
    this.host.surface.el<HTMLInputElement>('travel-factor').value = String(j.factor);
    this.host.surface.el<HTMLInputElement>('travel-final-hours').value = '';
    await this.makeTravelPreview(true);
  };

  openTravelCamp = async (kind: 'wait' | 'rest') => {
    const owner = this.travelOwner(),
      id = this.host.map.frame?.journey?.id;
    if (!owner || !id) return;
    const current = () =>
      this.ownsTravel(owner) &&
      this.host.map.frame?.journey?.id === id &&
      this.liveSurface &&
      this.host.weather.liveFocusId === owner.sceneId;
    if (!current()) return;
    this.playback.stop();
    await this.playback.settled();
    const j = this.host.map.frame?.journey;
    if (!current() || !j) return;
    if (
      j.status === 'active' &&
      !(await this.changeJourney({
        kind: 'journey-state',
        id: j.id,
        expectedRevision: j.revision,
        state: 'paused',
      }))
    )
      return;
    if (current()) await this.host.surface.camp(owner.sceneId, kind);
  };

  stopWorldPlayback = () => {
    this.playback.stop();
    return this.playback.settled();
  };

  setWorldSurface = (tab: string) => {
    this.host.map.partyDrag?.cancel();
    this.worldSurface = tab;
    if (tab !== 'world' && !(tab === 'live' && this.liveTravelOpen)) this.playback.stop();
    this.liveSurface = tab === 'live';
    const host = this.host.surface.el('live-travel-host');
    if (!host) return;
    const docked = this.liveSurface && this.liveTravelOpen;
    this.travelSurface?.dock(docked);
    if (docked) {
      if (this.routeMode === 'edit') this.routeMode = 'target';
      if (
        this.host.weather.liveFocusId &&
        this.host.map.frame?.scene.id !== this.host.weather.liveFocusId
      ) {
        this.resetRouteDraft();
        this.host.map.prepareLiveScene(this.host.weather.liveFocusId);
        this.renderJourney();
      }
    }
    host.hidden = !docked;
    this.host.surface
      .el('live-travel-toggle')
      .setAttribute('aria-expanded', String(this.liveTravelOpen));
    this.host.surface.el('live-travel-toggle').textContent = this.liveTravelOpen
      ? 'Reise schließen'
      : 'Reise';
    this.host.surface
      .el('world-map')
      .setAttribute(
        'aria-label',
        docked
          ? 'Hexkarte: Reiseziele und Wegpunkte für die Fokusgruppe'
          : 'Bearbeitbare Hexkarte mit Orten und Partyposition',
      );
    this.renderRouteDraft();
  };

  unavailableLiveTravel = (message: string, error = false) => {
    this.host.map.unavailableScene();
    this.playback.stop();
    this.resetRouteDraft();
    this.host.surface.el('live-travel-context').textContent = error ? '' : message;
    const empty = this.host.surface.el('live-travel-empty');
    empty.textContent = message;
    empty.hidden = !error;
    this.host.surface.el<HTMLButtonElement>('live-travel-retry').hidden = !error;
    this.host.map.renderMap();
    this.renderJourney();
    this.renderRouteDraft();
    this.host.surface.el('world-current').textContent = '';
  };

  followLiveGroup = (
    result: SceneWorld,
    context: import('./world-editor-types').MapProjectionContext,
  ) => {
    const projection = this.host.map.projectLiveGroup(
      result,
      context,
      this.liveBoundSceneId === null,
    );
    if (!projection) return;
    const { changed, basisChanged } = projection;
    if (changed) this.sceneSelectionChanged();
    else if (basisChanged) this.clearTravelPreview();
    this.liveBoundSceneId = result.scene.id;
    if (projection.cursor) this.mapCursorSelected(projection.cursor);
    if (changed) this.host.surface.el<HTMLInputElement>('travel-final-hours').value = '';
    this.host.surface.el('live-travel-context').textContent =
      (result.scene.title || 'Fokusgruppe') +
      ' · ' +
      result.scene.members.length +
      ' Figuren · ' +
      result.date;
    this.host.surface.el('live-travel-empty').textContent =
      result.position.mapId && !this.host.map.mapDraft
        ? 'Die Karte der Gruppe ist nicht verfügbar. Wähle bewusst eine andere Karte oder öffne den Atlas.'
        : 'Noch keine Hexkarte. Lege im Atlas eine Karte an und platziere die Gruppe.';
    this.host.surface.el('live-travel-empty').hidden = !!this.host.map.mapDraft;
    this.host.surface.el<HTMLButtonElement>('live-travel-retry').hidden = !(
      result.position.mapId && !this.host.map.mapDraft
    );
    this.host.map.renderMapFields();
    this.host.map.renderMap();
    this.renderJourney();
  };

  toggleLiveTravel = async () => {
    if (this.liveTravelOpen) {
      this.playback.stop();
      if (!(await this.host.writes.flushWorld())) return;
      this.liveTravelOpen = false;
      this.travelOpenRequest++;
      this.host.map.closeLiveRead();
      this.travelSurface?.close();
      this.setWorldSurface(this.liveSurface ? 'live' : 'world');
      return;
    }
    const token = this.host.map.workspace?.token,
      sceneId = this.host.weather.liveFocusId,
      request = ++this.travelOpenRequest;
    if (
      !token ||
      !sceneId ||
      !(await this.host.surface.before()) ||
      !(await this.host.writes.flushWorld()) ||
      this.host.map.workspace?.token !== token ||
      this.host.weather.liveFocusId !== sceneId ||
      request !== this.travelOpenRequest
    )
      return;
    const toggle = this.host.surface.el<HTMLButtonElement>('live-travel-toggle');
    toggle.disabled = true;
    try {
      this.liveTravelOpen = true;
      this.setWorldSurface(this.liveSurface ? 'live' : 'world');
      this.unavailableLiveTravel('Reisekontext wird geladen …');
      const loaded = await this.host.map.openWorld();
      if (this.host.map.workspace?.token !== token || request !== this.travelOpenRequest) return;
      if (this.host.weather.liveFocusId !== sceneId) {
        await this.refreshLiveTravel();
        return;
      }
      if (loaded) await this.host.weather.renderLiveWorld(token, sceneId, loaded);
    } catch (error) {
      if (this.host.map.workspace?.token === token && request === this.travelOpenRequest)
        this.unavailableLiveTravel(
          'Reisekontext nicht verfügbar: ' + (error as Error).message,
          true,
        );
    } finally {
      if (request === this.travelOpenRequest) toggle.disabled = false;
    }
  };

  refreshLiveTravel = async () => {
    const token = this.host.map.workspace?.token,
      id = this.host.weather.liveFocusId;
    if (!token || !id || !this.liveTravelOpen) return;
    this.unavailableLiveTravel('Reisekontext wird geladen …');
    try {
      const loaded = await this.host.map.openWorld();
      if (
        loaded &&
        this.host.map.workspace?.token === token &&
        this.host.weather.liveFocusId === id &&
        this.liveTravelOpen
      )
        await this.host.weather.renderLiveWorld(token, id, loaded);
    } catch (error) {
      if (
        this.host.map.workspace?.token === token &&
        this.host.weather.liveFocusId === id &&
        this.liveTravelOpen
      )
        this.unavailableLiveTravel(
          'Reisekontext nicht verfügbar: ' + (error as Error).message,
          true,
        );
    }
  };

  accessChoices: HexAccessChoices | null = null;

  renderAccessChoices = () => {
    const journey = this.host.map.frame?.journey,
      names = [
        ...new Set(
          this.host.map.mapDraft?.cells.flatMap((c) =>
            c.access?.mode === 'requires' ? [c.access.requirement] : [],
          ) ?? [],
        ),
      ];
    this.accessChoices?.render(
      JSON.stringify([
        this.host.map.workspace?.token,
        this.host.map.frame?.scene.id,
        this.host.map.mapDraft?.id,
        journey?.mapId === this.host.map.mapDraft?.id ? journey?.id : null,
      ]),
      names,
      journey?.mapId === this.host.map.mapDraft?.id ? [...(journey?.supplies ?? [])] : [],
    );
    const status = this.host.surface.el('journey-access-status');
    if (status) {
      status.textContent = journey?.supplies?.length
        ? 'Für die angenommene Reise bestätigt: ' + journey.supplies.join(', ')
        : '';
      status.hidden = !status.textContent;
    }
  };

  renderJourney = () => {
    this.host.surface.changed('atlas-runtime');
    this.renderAccessChoices();
    this.renderPartyPace();
    const position = this.host.map.frame?.position,
      place = position?.locationId
        ? this.host.map.world?.places.find(
            (p) => p.locationId === position.locationId && !p.trashed,
          )
        : null;
    const where = position?.mapId
      ? (place ? place.name + ' · ' : '') +
        'Hex ' +
        hexKey(position) +
        (position.mapId !== this.host.map.mapDraft?.id
          ? ' auf ' +
            (this.host.map.world?.maps.find((m) => m.id === position.mapId)?.name ??
              'anderer Karte')
          : '')
      : 'Ohne Kartenposition';
    this.host.surface.el('world-current').textContent = this.host.map.frame
      ? this.host.map.frame.date +
        ' · ' +
        where +
        ' · ' +
        (this.host.map.frame.weather
          ? this.host.map.frame.weather.label +
            ' · ' +
            this.host.map.frame.weather.effects.temperatureC +
            ' °C · ' +
            this.host.map.frame.weather.source
          : 'Wetter noch nicht bestimmt')
      : 'Wähle eine aktive Gruppe; Karten und Kalender lassen sich unabhängig vorbereiten.';
    const j = this.host.map.frame?.journey;
    if (j && j.id !== this.playbackJourneyId) {
      this.playback.stop();
      this.playbackJourneyId = j.id;
      this.playback.setSpeed(j.presentationSpeed ?? 1);
    }
    this.host.surface.el('world-journey-status').textContent = j
      ? {
          active: 'Unterwegs',
          paused: 'Pausiert',
          interrupted: 'Zur GM-Entscheidung angehalten',
          arrived: 'Angekommen',
          ended: 'Beendet',
        }[j.status] +
        ' · ' +
        (j.nextIndex - 1) +
        ' / ' +
        (j.route.length - 1) +
        ' Abschnitte · geplante Restzeit ' +
        (j.segmentSeconds.slice(j.nextIndex - 1).reduce((a, b) => a + b, 0) / 3600).toFixed(2) +
        ' h' +
        (j.reason ? ' · ' + j.reason : '')
      : this.host.map.frame
        ? 'Keine angenommene Reise.'
        : 'Reisestand nicht geladen.';
    for (const id of ['journey-step', 'journey-many', 'journey-pause', 'journey-end'])
      this.host.surface.el<HTMLButtonElement>(id).disabled =
        !j ||
        ['arrived', 'ended'].includes(j.status) ||
        (['journey-step', 'journey-many', 'journey-pause'].includes(id) && j.status !== 'active');
    const refresh = this.host.surface.el('world-journey-refresh'),
      open = !!j && ['active', 'paused', 'interrupted'].includes(j.status),
      changed =
        !!j &&
        !!this.host.map.frame &&
        (this.host.map.frame.scene.clock.revision !== j.clockRevision ||
          this.host.map.frame.position.revision !== j.positionRevision ||
          this.host.map.frame.scene.membershipRevision !== j.membershipRevision ||
          this.host.map.world?.maps.find((m) => m.id === j.mapId)?.revision !== j.mapRevision);
    this.host.surface.el('journey-controls').hidden = !open;
    const console = this.host.surface.el('world-journey-console'),
      anchor =
        open ||
        (!!j &&
          (!!this.host.map.frame?.travelHistory?.undo ||
            !!this.host.map.frame?.travelHistory?.redo))
          ? this.host.surface.el('world-travel-form').parentElement!.querySelector('h3')!
          : this.preview && this.liveSurface && this.liveTravelOpen
            ? this.host.surface.el('travel-evaluation')
            : this.host.surface.el('world-travel-form');
    if (anchor.nextElementSibling !== console) anchor.after(console);
    refresh.textContent = open
      ? (changed
          ? 'Zeit, Gruppe, Position oder Karte geändert. Restweg neu bewerten und die neue Vorschau bestätigen.'
          : j?.status === 'active'
            ? 'Für Warten oder Rast zuerst pausieren. Danach Restweg mit aktuellem Kalender und Wetter neu bewerten.'
            : 'Nach zusätzlichem Warten oder einer Rast den Restweg mit aktuellem Kalender und Wetter neu bewerten.') +
        (j?.continuedFrom ? ' · Fortsetzung einer früheren Reise.' : '')
      : '';
    this.host.surface.el<HTMLButtonElement>('journey-replan').disabled =
      !open || j!.nextIndex >= j!.route.length;
    for (const id of ['journey-wait', 'journey-rest']) {
      this.host.surface.el<HTMLButtonElement>(id).hidden = !this.liveSurface;
      this.host.surface.el<HTMLButtonElement>(id).disabled =
        !open || this.host.weather.liveFocusId !== this.host.map.frame?.scene.id;
    }
    const history = this.host.surface.el('world-history');
    history.replaceChildren();
    for (const h of this.host.map.frame?.history ?? []) {
      const p = this.host.surface.document.createElement('p');
      p.textContent = h.text;
      history.append(p);
    }
    const events = this.host.surface.el('world-relevant-events');
    events.replaceChildren();
    for (const e of this.host.map.frame?.events ?? []) {
      const p = this.host.surface.document.createElement('p');
      p.textContent = e.name + (e.notes ? ' · ' + e.notes : '');
      events.append(p);
    }
    this.playback.sync();
    this.renderPlayback();
  };

  atlasWorldTarget = (h: Hex) => {
    if (!this.host.map.mapDraft) return;
    this.host.map.useAtlasTargetLevel();
    if (this.routeMode !== 'route') this.routeMode = 'target';
    this.chooseRouteHex(h);
  };

  previewAtlasWorldTravel = async () => {
    await this.makeTravelPreview(false, true);
  };

  startAtlasWorldTravel = async () => {
    await this.acceptTravelPreview(true);
  };

  atlasWorldTravelState = () => {
    return {
      preview: this.preview,
      frame: this.host.map.frame,
      token: this.host.map.workspace?.token ?? null,
      canAccept: !this.host.surface.el<HTMLButtonElement>('travel-preview-accept').disabled,
    };
  };

  refreshWorldAfterAtlasTravel = async (token: string, sceneId: string) => {
    if (
      this.host.map.workspace?.token !== token ||
      (this.liveSurface && this.liveTravelOpen && this.host.weather.liveFocusId !== sceneId)
    )
      return;
    await this.host.map.openWorld();
  };

  activate = () => {
    this.transportBusy = false;
    this.sceneSelection++;
    this.travelOpenRequest++;
    this.travelSurface?.close();
    this.playback.stop();
    this.playbackJourneyId = null;
    this.playback.setSpeed(1);
    this.liveTravelOpen = false;
    this.liveBoundSceneId = null;
    this.setWorldSurface(this.liveSurface ? 'live' : 'world');
    this.routeMode = 'edit';
    this.resetRouteDraft();
    this.clearTravelPreview();
    this.preview = null;
  };

  mountTravelLayout = () => {
    this.host.surface
      .el('world-travel-owner')
      .append(this.host.surface.el('travel-preview-dialog'));
    const columns = this.host.surface
      .el('world-map-workspace')
      .querySelector('.world-map-columns')!;
    const travel = this.host.surface
      .el('world-map-workspace')
      .querySelector<HTMLElement>('.world-travel')!;
    const modes = this.host.surface.el('travel-mode-edit').parentElement!;
    modes.id = 'world-map-modes';
    this.host.surface.el('world-map-workspace').prepend(modes);
    columns.append(travel);
    const advanced = this.host.surface.document.createElement('details'),
      summary = this.host.surface.document.createElement('summary');
    summary.textContent = 'Koordinaten, Tempo und Dauer';
    advanced.id = 'travel-advanced';
    advanced.append(summary);
    const form = this.host.surface.el('world-travel-form');
    for (const fields of [
      ...form.querySelectorAll<HTMLElement>(':scope > .combat-fields,:scope > .time-fields'),
    ])
      advanced.append(fields);
    form.insertBefore(advanced, this.host.surface.el('travel-preview-open'));
    this.host.surface.el('journey-step').parentElement!.id = 'journey-controls';
    const transportBar = this.host.surface.el('journey-play').parentElement!;
    transportBar.append(this.host.surface.el('journey-pause'), this.host.surface.el('journey-end'));
    this.host.surface.el('journey-pause').textContent = '⏸ Pause';
    this.host.surface.el('journey-pause').setAttribute('aria-label', 'Reise pausieren');
    this.host.surface.el('journey-end').textContent = '■ Stoppen';
    this.host.surface.el('journey-end').setAttribute('aria-label', 'Reise abbrechen');
    const console = this.host.surface.document.createElement('div');
    console.id = 'world-journey-console';
    this.host.surface.el('world-journey-status').before(console);
    const events = this.host.surface.el('world-relevant-events');
    while (console.nextElementSibling && console.nextElementSibling !== events)
      console.append(console.nextElementSibling);
    const historyControls = this.host.surface.document.createElement('div');
    historyControls.id = 'travel-history-controls';
    historyControls.className = 'toolbar';
    historyControls.hidden = true;
    const historySummary = this.host.surface.document.createElement('p');
    historySummary.id = 'travel-history-summary';
    historyControls.append(historySummary);
    for (const direction of ['undo', 'redo'] as const) {
      const b = this.host.surface.document.createElement('button');
      b.id = 'travel-' + direction;
      b.type = 'button';
      b.onclick = () => this.host.surface.run(() => this.changeTravelHistory(direction));
      historyControls.append(b);
    }
    this.host.surface.el('world-journey-status').after(historyControls);
    const feedback = this.host.surface.document.createElement('p');
    feedback.id = 'journey-feedback';
    feedback.setAttribute('role', 'alert');
    feedback.hidden = true;
    console.prepend(feedback);
    this.host.surface.el('live-travel-toggle').onclick = () =>
      this.host.surface.run(this.toggleLiveTravel);
    this.host.surface.el('live-travel-retry').onclick = () =>
      this.host.surface.run(this.refreshLiveTravel);
    const supplies = this.host.surface.document.createElement('fieldset');
    supplies.id = 'travel-access-choices';
    this.host.surface.el('world-travel-form').append(supplies);
    this.accessChoices = new HexAccessChoices(supplies, () => this.clearTravelPreview());
    const accessStatus = this.host.surface.document.createElement('p');
    accessStatus.id = 'journey-access-status';
    this.host.surface.el('world-journey-status').after(accessStatus);
  };

  mountTravelControls = () => {
    this.host.surface.el('world-destination').onchange = () => {
      this.clearTravelPreview();
      const place = this.host.map.world?.places.find(
          (p) => p.locationId === this.host.surface.value('world-destination'),
        ),
        base = hexPoint(this.host.map.selected, 3 ** this.host.map.level),
        target = place ?? pointHex(base.x, base.y);
      this.host.surface.el<HTMLInputElement>('travel-q').value = String(target.q);
      this.host.surface.el<HTMLInputElement>('travel-r').value = String(target.r);
      this.readRouteInputs();
    };
    for (const id of ['travel-q', 'travel-r'])
      this.host.surface.el(id).oninput = () => {
        this.host.surface.el<HTMLSelectElement>('world-destination').value = '';
        this.clearTravelPreview();
      };
    this.host.surface.el<HTMLInputElement>('travel-party-pace').checked = true;
    this.host.surface.el('travel-party-pace').onchange = () => {
      this.clearTravelPreview();
      this.renderPartyPace();
    };
    this.host.surface.el('travel-pace').oninput = () => {
      this.host.surface.el<HTMLInputElement>('travel-party-pace').checked = false;
      this.host.surface.el<HTMLInputElement>('travel-pace').disabled = false;
    };
    this.host.surface.el('world-travel-form').oninput = () => {
      this.clearTravelPreview();
      this.readRouteInputs();
    };
    this.host.surface.el('world-travel-form').onsubmit = (e) => {
      e.preventDefault();
      void this.makeTravelPreview();
    };
    this.host.surface.el('travel-preview-cancel').onclick = () => {
      this.clearTravelPreview();
      this.host.map.renderMap();
    };
    for (const mode of ['edit', 'target', 'route'] as const)
      this.host.surface.el('travel-mode-' + mode).onclick = () => {
        if (mode === 'edit' && this.liveTravelOpen && this.liveSurface) return;
        this.routeMode = mode;
        if (this.liveSurface && this.liveTravelOpen && mode !== 'edit')
          this.travelSurface?.show('map');
        const last = this.routeStops.at(-1);
        if (last) {
          const p = hexPoint(last);
          this.routeCursor = pointHex(p.x, p.y, 3 ** this.host.map.level);
        } else this.routeCursor = { ...this.host.map.selected };
        this.clearTravelPreview();
        this.renderRouteDraft();
        this.host.map.renderMap();
      };
    this.host.surface.el('travel-route-clear').onclick = () => {
      this.resetRouteDraft();
      this.host.map.renderMap();
    };
    this.host.surface.el('travel-place-cursor').onclick = () => {
      if (this.liveSurface && this.liveTravelOpen) this.travelSurface?.show('map');
      this.host.surface.run(this.placeRouteCursor);
    };
    ownedEventTarget(
      this.host.surface.el('world-map'),
      this.host.surface.cleanups,
    ).addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (this.routeMode !== 'edit')
          this.host.surface.run(() => this.chooseRouteHex(this.routeCursor));
        return;
      }
      const moves: Record<string, Hex> = {
        ArrowLeft: { q: -1, r: 0 },
        ArrowRight: { q: 1, r: 0 },
        ArrowUp: { q: 0, r: -1 },
        ArrowDown: { q: 0, r: 1 },
      };
      const delta = moves[event.key];
      if (!delta) return;
      event.preventDefault();
      this.routeCursor = { q: this.routeCursor.q + delta.q, r: this.routeCursor.r + delta.r };
      if (this.routeMode === 'edit') {
        this.host.surface.run(async () => {
          if (!(await this.host.writes.flushWorld())) return;
          this.host.map.navigateCursor(this.routeCursor, true);
        });
      } else {
        this.host.map.navigateCursor(this.routeCursor, false);
        this.renderRouteDraft();
      }
    });
    this.host.surface.el('travel-preview-accept').onclick = () => {
      void this.acceptTravelPreview();
    };
    this.host.surface.el('journey-replan').onclick = () =>
      this.host.surface.run(this.replanRemainingJourney);
    this.host.surface.el('journey-wait').onclick = () =>
      this.host.surface.run(() => this.openTravelCamp('wait'));
    this.host.surface.el('journey-rest').onclick = () =>
      this.host.surface.run(() => this.openTravelCamp('rest'));
    for (const [id, kind] of [
      ['journey-play', 'play'],
      ['journey-step', 'step'],
      ['journey-many', 'many'],
      ['journey-pause', 'pause'],
      ['journey-end', 'end'],
    ] as const)
      this.host.surface.el(id).onclick = () => this.host.surface.run(() => this.transport(kind));
    for (const [id, delta] of [
      ['journey-slower', -1],
      ['journey-faster', 1],
    ] as const)
      this.host.surface.el(id).onclick = () =>
        this.playback.setSpeed(
          journeySpeeds[
            Math.max(0, Math.min(3, journeySpeeds.indexOf(this.playback.speed) + delta))
          ]!,
        );
    this.host.surface.listen(this.host.surface.document, 'visibilitychange', () => {
      if (this.host.surface.document.visibilityState === 'hidden') this.playback.stop();
    });
    this.travelSurface = this.host.surface.liveSurface();
  };
}
