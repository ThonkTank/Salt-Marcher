import type { SceneWorld } from './world-contracts';
import type { Weather, WeatherPhenomenon } from './weather-contracts';
import type { WorldEditorSurface } from './world-editor-surface';
import type { WeatherIntent, WeatherOwner } from './world-editor-types';
import { hexPoint, pointHex, weatherEffects } from './world-model';
import type {
  WorldCalendarPort,
  WorldMapPort,
  WorldTravelPort,
  WorldWritePort,
} from './world-owner-ports';

interface Host {
  map: Pick<
    WorldMapPort,
    | 'acceptWeatherProjection'
    | 'projectionContext'
    | 'prepareLiveScene'
    | 'frame'
    | 'level'
    | 'mapDraft'
    | 'renderMap'
    | 'selected'
    | 'workspace'
    | 'world'
  >;
  surface: Pick<
    WorldEditorSurface,
    | 'after'
    | 'api'
    | 'button'
    | 'document'
    | 'editorSession'
    | 'el'
    | 'number'
    | 'option'
    | 'run'
    | 'syncScene'
    | 'tell'
    | 'unwrap'
    | 'value'
  >;
  calendar: Pick<WorldCalendarPort, 'agendaPending' | 'renderLiveAgenda'>;
  travel: Pick<
    WorldTravelPort,
    'followLiveGroup' | 'liveSurface' | 'liveTravelOpen' | 'renderJourney' | 'unavailableLiveTravel'
  >;
  writes: Pick<WorldWritePort, 'action' | 'flushWorld' | 'raw'>;
}
export class WorldWeatherEditor {
  phenomenonEdits = 0;
  constructor(readonly host: Host) {}
  dirtyPhenomenon = false;

  phenomenonDraft: WeatherPhenomenon | null = null;

  liveFocusId: string | null = null;

  liveWorld: SceneWorld | null = null;

  liveRequest = 0;

  weatherContext: {
    token: string;
    sceneId: string;
  } | null = null;

  weatherGeneration = 0;

  weatherBasis: WeatherOwner | null = null;

  weatherEdits = 0;

  weatherBusy = false;

  weatherDirty = false;

  weatherOwner = (): WeatherOwner | null => {
    if (!this.host.map.workspace || !this.liveWorld) return null;
    const revision = this.liveWorld.weatherOverrideRevision;
    if (revision !== null && (!Number.isSafeInteger(revision) || revision < 1))
      throw new Error('Wetterstand fehlt. Gruppe erneut öffnen.');
    return {
      token: this.host.map.workspace.token,
      campaignId: this.host.map.workspace.campaign.id,
      sceneId: this.liveWorld.scene.id,
      generation: this.weatherGeneration,
      clockRevision: this.liveWorld.scene.clock.revision,
      overrideRevision: revision,
    };
  };

  weatherCurrent = (o: WeatherOwner) => {
    return (
      this.host.surface.editorSession.status.attached &&
      this.host.map.workspace?.token === o.token &&
      this.host.map.workspace.campaign.id === o.campaignId &&
      this.weatherGeneration === o.generation &&
      this.weatherContext?.token === o.token &&
      this.weatherContext.sceneId === o.sceneId
    );
  };

  canAdoptWeatherFrame = (previous: SceneWorld | null, next: SceneWorld) => {
    return (
      !previous ||
      previous.scene.id !== next.scene.id ||
      (previous.scene.clock.revision <= next.scene.clock.revision &&
        previous.scene.revision <= next.scene.revision &&
        previous.scene.membershipRevision <= next.scene.membershipRevision &&
        previous.position.revision <= next.position.revision &&
        (previous.weatherOverrideRevision ?? 0) <= (next.weatherOverrideRevision ?? 0))
    );
  };

  populateWeatherInput = (w: Weather | null) => {
    for (const [id, value] of Object.entries({
      'weather-override-kind': w?.kind ?? 'clear',
      'weather-override-intensity': String((w?.intensity ?? 0) * 100),
      'weather-override-temperature': String(w?.effects.temperatureC ?? 15),
      'weather-override-factor': String(w?.effects.travelFactor ?? 1),
      'weather-override-notes': w?.effects.combatNote ?? '',
    }))
      this.host.surface.el<HTMLInputElement>(id).value = value;
  };

  finishWeatherWork = () => {
    this.weatherBusy = false;
    if (!this.weatherDirty && this.liveWorld) this.populateWeatherInput(this.liveWorld.weather);
    this.lockWeather();
  };

  lockWeather = () => {
    const form = this.host.surface.el('weather-override-form');
    if (!form) return;
    for (const b of form.querySelectorAll<HTMLButtonElement>('button'))
      b.disabled = this.weatherBusy;
    this.host.surface.el<HTMLButtonElement>('weather-release').disabled =
      this.weatherBusy || this.liveWorld?.weather?.source !== 'GM-Override';
  };

  acceptOwnWeather = (intent: WeatherIntent, next: SceneWorld | null | undefined) => {
    const { owner: o, version } = intent;
    if (
      !next ||
      next.scene.id !== o.sceneId ||
      next.weatherOverrideRevision !== (o.overrideRevision ?? 0) + 1
    )
      throw new Error('Bestätigter Wetterstand gehört nicht zur eigenen Änderung.');
    if (!this.weatherCurrent(o)) return;
    if (this.canAdoptWeatherFrame(this.liveWorld, next)) {
      this.liveWorld = next;
      this.paintLiveWeather(next, o.token, o.sceneId);
      void this.host.calendar.renderLiveAgenda(o.token, o.sceneId, this.liveRequest);
    }
    this.host.map.acceptWeatherProjection(o.token, next);
    this.weatherDirty = !!intent.preserveDraft || this.weatherEdits !== version;
    this.weatherBasis = this.weatherDirty
      ? {
          ...o,
          clockRevision: next.scene.clock.revision,
          overrideRevision: next.weatherOverrideRevision,
        }
      : null;
    if (!this.weatherBusy && !this.weatherDirty) this.populateWeatherInput(next.weather);
  };

  submitWeather = async (weather: Weather | null) => {
    if (this.weatherBusy) return;
    if (this.weatherDirty && !this.weatherBasis)
      throw new Error(
        'Wetterstand zur Eingabe fehlt. Eingabe vor neuem Stand ausdrücklich verwerfen.',
      );
    const o = this.weatherBasis ?? this.weatherOwner();
    if (!o) return;
    if (!this.weatherCurrent(o)) {
      this.host.surface.tell(
        'Gruppenauswahl geändert. Wettereingabe bleibt erhalten; vor neuer Eingabe ausdrücklich verwerfen.',
        true,
      );
      return;
    }
    const version = this.weatherEdits,
      intent: WeatherIntent = {
        owner: o,
        version,
        preserveDraft: weather === null && this.weatherDirty,
      };
    this.weatherBusy = true;
    this.lockWeather();
    try {
      if (!(await this.host.writes.flushWorld())) return;
      if (!this.weatherCurrent(o)) return;
      const ack = await this.host.writes.raw(
        {
          kind: 'weather-override',
          sceneId: o.sceneId,
          expectedClockRevision: o.clockRevision,
          expectedOverrideRevision: o.overrideRevision,
          weather,
        },
        () => this.weatherCurrent(o),
        intent,
      );
      if (!this.weatherCurrent(o)) return;
      this.acceptOwnWeather(intent, ack.scene);
      await this.host.surface.after();
      if (this.weatherCurrent(o)) this.host.surface.tell('Wetter für diese Gruppe gespeichert.');
    } catch (error) {
      if (this.weatherCurrent(o)) this.host.surface.tell((error as Error).message, true);
    } finally {
      if (this.weatherCurrent(o)) this.finishWeatherWork();
    }
  };

  discardWeatherInput = async () => {
    if (this.weatherBusy) return;
    const o = this.weatherOwner();
    if (!o) return;
    const version = this.weatherEdits;
    this.weatherBusy = true;
    this.lockWeather();
    try {
      const next = this.host.surface.unwrap(
        await this.host.surface.api.sceneWorld(o.token, o.sceneId),
      );
      if (!this.weatherCurrent(o) || this.weatherEdits !== version) return;
      if (next.scene.id !== o.sceneId)
        throw new Error('Wetterantwort gehört zu einer anderen Gruppe.');
      if (!this.canAdoptWeatherFrame(this.liveWorld, next))
        throw new Error('Wetter inzwischen geändert. Eingabe bleibt erhalten.');
      this.liveWorld = next;
      this.paintLiveWeather(next, o.token, o.sceneId);
      void this.host.calendar.renderLiveAgenda(o.token, o.sceneId, this.liveRequest);
      const w = next.weather;
      this.populateWeatherInput(w);
      this.weatherBasis = null;
      this.weatherDirty = false;
      this.weatherEdits++;
      this.host.surface.tell('Wettereingabe verworfen. Aktueller Gruppenstand geladen.');
    } catch (error) {
      if (this.weatherCurrent(o)) this.host.surface.tell((error as Error).message, true);
    } finally {
      if (this.weatherCurrent(o)) this.finishWeatherWork();
    }
  };

  daysMs = (days: number) => {
    if (!this.host.map.world || !Number.isFinite(days) || days < 0 || days > 100000000)
      throw new Error('Zeit benötigt 0 bis 100.000.000 Tage.');
    return Math.round(days * this.host.map.world.calendar.daySeconds * 1000).toString();
  };

  msDays = (ms: string) =>
    this.host.map.world ? Number(BigInt(ms)) / this.host.map.world.calendar.daySeconds / 1000 : 0;

  renderPhenomenonOptions = () => {
    const s = this.host.surface.el<HTMLSelectElement>('phen-select'),
      old = this.phenomenonDraft?.id;
    s.replaceChildren();
    this.host.surface.option(s, '', 'Neues Wetterereignis');
    for (const p of this.host.map.world?.phenomena.filter(
      (p) => p.mapId === this.host.map.mapDraft?.id,
    ) ?? [])
      this.host.surface.option(s, p.id, p.name + ' · ' + p.state);
    s.value = old ?? '';
    this.renderPhenomenon();
  };

  renderPhenomenon = () => {
    this.host.surface.el('phen-editor').hidden = !this.phenomenonDraft;
    if (!this.phenomenonDraft) return;
    const p = this.phenomenonDraft;
    for (const [id, v] of Object.entries({
      'phen-name': p.name,
      'phen-kind': p.kind,
      'phen-intensity': String(p.intensity * 100),
      'phen-q': String(p.center.q),
      'phen-r': String(p.center.r),
      'phen-radius': String(p.radiusHexes),
      'phen-move-q': String(p.movement.q),
      'phen-move-r': String(p.movement.r),
      'phen-start': String(this.msDays(p.startMs)),
      'phen-duration': String(this.msDays(p.durationMs)),
      'phen-state': p.state,
      'phen-temperature': p.temperatureC === null ? '' : String(p.temperatureC),
      'phen-travel': p.travelFactor === null ? '' : String(p.travelFactor),
      'phen-notes': p.notes,
    }))
      this.host.surface.el<HTMLInputElement>(id).value = v;
  };

  paintLiveWeather = (result: SceneWorld, token: string, sceneId: string) => {
    const weather = result.weather;
    if (!this.weatherDirty && !this.weatherBusy) this.populateWeatherInput(weather);
    this.host.surface.el('live-world-summary').textContent =
      result.date +
      (weather
        ? ' · ' +
          weather.label +
          ' · ' +
          weather.effects.temperatureC +
          ' °C · Wind ' +
          weather.windKmh +
          ' km/h'
        : '');
    this.host.surface.el('live-weather-effects').textContent = weather
      ? 'Sicht ' +
        weather.effects.visibilityMeters +
        ' m · Reisefaktor ' +
        weather.effects.travelFactor.toFixed(2) +
        ' · ' +
        weather.effects.perception +
        (weather.effects.combatNote ? ' · ' + weather.effects.combatNote : '')
      : '';
    const notices = this.host.surface.el('live-world-notices');
    notices.replaceChildren();
    for (const n of result.notices) {
      const card = this.host.surface.document.createElement('p');
      card.textContent = n.text;
      card.append(
        this.host.surface.button('Meldung ausblenden', async () => {
          await this.host.writes.action({ kind: 'notice-dismiss', sceneId, id: n.id });
          await this.renderLiveWorld(token, sceneId);
        }),
      );
      notices.append(card);
    }
    for (const event of result.events) {
      const p = this.host.surface.document.createElement('p');
      p.textContent = 'Kalender: ' + event.name + (event.notes ? ' · ' + event.notes : '');
      notices.append(p);
    }
    this.lockWeather();
  };

  renderLiveWorld = async (token: string, sceneId: string, confirmed?: SceneWorld) => {
    const current = this.host.surface.editorSession.capture();
    if (this.host.map.workspace?.token !== token) return;
    this.host.surface.syncScene(token, sceneId);
    const request = ++this.liveRequest;
    this.liveFocusId = sceneId;
    this.host.calendar.agendaPending('Termine werden geladen …');
    if (
      this.host.travel.liveTravelOpen &&
      this.host.travel.liveSurface &&
      this.host.map.frame?.scene.id !== sceneId
    ) {
      this.host.map.prepareLiveScene(sceneId);
      this.host.travel.unavailableLiveTravel('Reisekontext wird geladen …');
    }
    if (this.weatherContext?.token !== token || this.weatherContext.sceneId !== sceneId) {
      this.weatherContext = { token, sceneId };
      this.weatherGeneration++;
      this.liveWorld = null;
      this.weatherBusy = false;
    }
    if (!this.host.surface.el('live-world-summary')) return;
    const mapContext = this.host.map.projectionContext();
    try {
      const result =
        confirmed ??
        this.host.surface.unwrap(await this.host.surface.api.sceneWorld(token, sceneId));
      if (
        this.host.map.workspace?.token !== token ||
        !current() ||
        request !== this.liveRequest ||
        !this.host.surface.el('live-world-summary')
      )
        return;
      if (result.scene.id !== sceneId)
        throw new Error('Wetterantwort gehört zu einer anderen Gruppe.');
      if (!this.canAdoptWeatherFrame(this.liveWorld, result)) {
        void this.host.calendar.renderLiveAgenda(token, sceneId, request);
        return;
      }
      this.liveWorld = result;
      if (this.host.travel.liveTravelOpen && this.host.travel.liveSurface)
        this.host.travel.followLiveGroup(result, mapContext);
      this.paintLiveWeather(result, token, sceneId);
      void this.host.calendar.renderLiveAgenda(token, sceneId, request);
    } catch (error) {
      if (
        this.host.map.workspace?.token === token &&
        current() &&
        request === this.liveRequest &&
        this.host.surface.el('live-world-summary')
      ) {
        this.host.surface.el('live-world-summary').textContent =
          'Weltanzeige: ' + (error as Error).message;
        this.host.calendar.agendaPending(
          'Termine nicht verfügbar: ' + (error as Error).message,
          false,
        );
        if (this.host.travel.liveTravelOpen && this.host.travel.liveSurface)
          this.host.travel.unavailableLiveTravel(
            'Reisekontext nicht verfügbar: ' + (error as Error).message,
            true,
          );
      }
    }
  };

  activate = () => {
    this.weatherContext = null;
    this.weatherGeneration++;
    this.liveWorld = null;
    this.liveRequest++;
    this.liveFocusId = null;
    this.weatherBusy = false;
    this.phenomenonDraft = null;
    this.dirtyPhenomenon = false;
  };

  flushDraft = async () => {
    if (this.dirtyPhenomenon && this.phenomenonDraft) {
      const version = this.phenomenonEdits;
      const p: WeatherPhenomenon = {
        ...this.phenomenonDraft,
        name: this.host.surface.value('phen-name'),
        kind: this.host.surface.value('phen-kind') as Weather['kind'],
        intensity: this.host.surface.number('phen-intensity') / 100,
        center: { q: this.host.surface.number('phen-q'), r: this.host.surface.number('phen-r') },
        radiusHexes: this.host.surface.number('phen-radius'),
        movement: {
          q: this.host.surface.number('phen-move-q'),
          r: this.host.surface.number('phen-move-r'),
        },
        startMs: this.daysMs(this.host.surface.number('phen-start')),
        durationMs: this.daysMs(this.host.surface.number('phen-duration')),
        state: this.host.surface.value('phen-state') as WeatherPhenomenon['state'],
        temperatureC: this.host.surface.value('phen-temperature')
          ? this.host.surface.number('phen-temperature')
          : null,
        travelFactor: this.host.surface.value('phen-travel')
          ? this.host.surface.number('phen-travel')
          : null,
        notes: this.host.surface.value('phen-notes'),
      };
      const now = this.host.map.frame?.scene.clock.instantMs ?? '0';
      if (p.state === 'paused' && this.phenomenonDraft.state !== 'paused') p.pausedAtMs = now;
      if (p.state === 'active' && this.phenomenonDraft.state === 'paused') {
        p.startMs = (
          BigInt(p.startMs) +
          BigInt(now) -
          BigInt(this.phenomenonDraft.pausedAtMs ?? now)
        ).toString();
        p.pausedAtMs = null;
      }
      const ack = await this.host.writes.raw({
        kind: 'phenomenon',
        phenomenon: p,
        expectedRevision: this.phenomenonDraft.revision || null,
      });
      this.phenomenonDraft = structuredClone(ack.world.phenomena.find((e) => e.id === p.id)!);
      this.dirtyPhenomenon = this.phenomenonEdits !== version;
    }
  };

  mountWeatherControls = () => {
    const localHex = () => {
      const p = hexPoint(this.host.map.selected, 3 ** this.host.map.level);
      return pointHex(p.x, p.y);
    };
    this.host.surface.el('phen-editor').oninput = () => {
      this.dirtyPhenomenon = true;
      this.phenomenonEdits++;
    };
    this.host.surface.el('phen-new').onclick = () =>
      this.host.surface.run(async () => {
        if (!(await this.host.writes.flushWorld()) || !this.host.map.mapDraft) return;
        this.phenomenonDraft = {
          id: crypto.randomUUID(),
          revision: 0,
          mapId: this.host.map.mapDraft.id,
          name: '',
          kind: 'storm',
          intensity: 0.7,
          center: localHex(),
          radiusHexes: 3,
          movement: { q: 0, r: 0 },
          startMs: this.host.map.frame?.scene.clock.instantMs ?? '0',
          durationMs: this.daysMs(2),
          state: 'active',
          pausedAtMs: null,
          temperatureC: null,
          travelFactor: null,
          notes: '',
        };
        this.renderPhenomenon();
      });
    this.host.surface.el('phen-select').onchange = () =>
      this.host.surface.run(async () => {
        const id = this.host.surface.value('phen-select');
        if (await this.host.writes.flushWorld()) {
          this.phenomenonDraft = this.host.map.world?.phenomena.find((p) => p.id === id) ?? null;
          this.renderPhenomenon();
        }
      });
    this.host.surface.el('weather-override-form').oninput = () => {
      this.weatherDirty = true;
      this.weatherEdits++;
      try {
        this.weatherBasis ??= this.weatherOwner();
      } catch (error) {
        this.host.surface.tell((error as Error).message, true);
      }
    };
    this.host.surface.el('weather-override-form').onsubmit = (e) => {
      e.preventDefault();
      try {
        const kind = this.host.surface.value('weather-override-kind') as Weather['kind'],
          intensity = this.host.surface.number('weather-override-intensity') / 100,
          effects = weatherEffects(
            kind,
            intensity,
            this.host.surface.number('weather-override-temperature'),
          );
        effects.travelFactor = this.host.surface.number('weather-override-factor');
        effects.combatNote = this.host.surface.value('weather-override-notes');
        const weather: Weather = {
          kind,
          label:
            this.host.surface.el<HTMLSelectElement>('weather-override-kind').selectedOptions[0]!
              .textContent!,
          intensity,
          windKmh: 0,
          effects,
          source: 'GM-Override',
        };
        this.host.surface.run(() => this.submitWeather(weather));
      } catch (error) {
        this.host.surface.tell((error as Error).message, true);
      }
    };
    this.host.surface.el('weather-release').onclick = () =>
      this.host.surface.run(() => this.submitWeather(null));
    this.host.surface.el('weather-discard-input').onclick = () =>
      this.host.surface.run(this.discardWeatherInput);
  };

  acceptConfirmed = (
    command: import('./world-contracts').WorldCommand,
    ack: import('./world-contracts').WorldAck,
    versions: import('./world-editor-types').WorldEdits,
  ) => {
    const a = command.action;
    if (a.kind === 'phenomenon' && this.phenomenonDraft?.id === a.phenomenon.id) {
      this.phenomenonDraft = structuredClone(
        ack.world.phenomena.find((p) => p.id === a.phenomenon.id)!,
      );
      this.dirtyPhenomenon = this.phenomenonEdits !== versions.phenomenon;
    }
  };
}
