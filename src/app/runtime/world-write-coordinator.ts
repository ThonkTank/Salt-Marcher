import type { Result } from '../shared/contracts';
import type { WorldAck,WorldAction,WorldCommand,WorldReconciliation } from './world-contracts';
import type { WorldEditorSurface } from './world-editor-surface';
import type { WeatherIntent,WorldEdits } from './world-editor-types';
import type {
WorldCalendarPort,
WorldMapPort,
WorldTravelPort,
WorldWeatherPort,
} from './world-owner-ports';

interface Host {
  surface: Pick<
    WorldEditorSurface,
    'after' | 'api' | 'before' | 'editorSession' | 'el' | 'settle' | 'tell' | 'unwrap' | 'write'
  >;
  weather: Pick<
    WorldWeatherPort,
    'acceptConfirmed' | 'acceptOwnWeather' | 'dirtyPhenomenon' | 'flushDraft' | 'phenomenonEdits'
  >;
  map: Pick<
    WorldMapPort,
    | 'acceptConfirmed'
    | 'acceptSnapshot'
    | 'collectCell'
    | 'dirtyCell'
    | 'dirtyMap'
    | 'flushDraft'
    | 'flushMarker'
    | 'mapEdits'
    | 'mapGestures'
    | 'markerEdits'
    | 'reloadScene'
    | 'renderMap'
    | 'workspace'
  >;
  calendar: Pick<
    WorldCalendarPort,
    | 'acceptConfirmed'
    | 'calendarEdits'
    | 'calendarRules'
    | 'calendarStatus'
    | 'dirtyCalendar'
    | 'flushDraft'
  >;
  travel: Pick<WorldTravelPort, 'renderJourney'>;
}
export class WorldWriteCoordinator {
  constructor(readonly host: Host) {
    this.uncertainState = this.host.surface.editorSession.command<{
      command: WorldCommand;
      versions: WorldEdits;
      weatherIntent?: WeatherIntent;
      generation: number;
    }>();
    this.pendingWork = this.host.surface.editorSession.operation<Promise<boolean>>();
    this.checkingWorldWriteWork =
      this.host.surface.editorSession.operation<Promise<WorldReconciliation | null>>();
  }
  uncertainState: import('../shared/editor-session').EditorCommand<{
    command: WorldCommand;
    versions: WorldEdits;
    weatherIntent?: WeatherIntent;
    generation: number;
  }>;

  pendingWork: import('../shared/editor-session').EditorOperation<Promise<boolean>>;

  checkingWorldWriteWork: import('../shared/editor-session').EditorOperation<
    Promise<WorldReconciliation | null>
  >;

  readonly worldWrites = new Set<Promise<void>>();

  showUncertainWorldWrite = () => {
    this.host.surface.el('world-write-recovery').hidden = !this.uncertainState.value;
    const check = this.host.surface.el('calendar-write-check');
    if (check) check.hidden = !this.uncertainState.value;
  };

  adoptConfirmedWorldWrite = (
    command: WorldCommand,
    ack: WorldAck,
    versions: WorldEdits,
    weatherIntent?: WeatherIntent,
  ) => {
    if (command.action.kind === 'weather-override') {
      if (!weatherIntent) throw new Error('Wettereingabe zum Auftrag fehlt.');
      this.host.weather.acceptOwnWeather(weatherIntent, ack.scene);
      return;
    }
    this.host.map.acceptConfirmed(command, ack, versions);
    this.host.calendar.acceptConfirmed(command, ack, versions);
    this.host.weather.acceptConfirmed(command, ack, versions);
  };

  resolveWorldWrite = async (): Promise<WorldReconciliation | null> => {
    if (this.checkingWorldWriteWork.value) return this.checkingWorldWriteWork.value;
    if (!this.uncertainState.value || !this.host.map.workspace) return null;
    const captured = this.uncertainState.value,
      token = captured.command.token;
    const operation = Promise.resolve().then(async () => {
      try {
        const result = this.host.surface.unwrap(
          await this.host.surface.api.reconcileWorld(captured.command, token),
        );
        if (this.uncertainState.value !== captured) return null;
        if (
          result.outcome === 'applied' &&
          this.host.map.workspace?.token === token &&
          this.host.surface.editorSession.generation === captured.generation
        )
          this.adoptConfirmedWorldWrite(
            captured.command,
            result.ack,
            captured.versions,
            captured.weatherIntent,
          );
        this.host.surface.settle(captured.command);
        this.uncertainState.value = null;
        this.showUncertainWorldWrite();
        if (
          this.host.map.workspace?.token === token &&
          this.host.surface.editorSession.generation === captured.generation
        )
          this.host.surface.tell(
            result.outcome === 'applied'
              ? 'Weltänderung bestätigt. Spätere Eingaben bleiben offen.'
              : 'Weltänderung wurde nicht übernommen. Eingabe bleibt offen.',
          );
        return result;
      } catch (error) {
        if (this.host.map.workspace?.token === token)
          this.host.surface.tell((error as Error).message + ' Weltänderung bleibt unklar.', true);
        return null;
      }
    });
    this.checkingWorldWriteWork.value = operation;
    return operation;
  };

  reconcileWorldWrite = async (): Promise<boolean> => {
    return (
      (!this.uncertainState.value && !this.checkingWorldWriteWork.value) ||
      !!(await this.resolveWorldWrite())
    );
  };

  agendaWritePending = (eventId: string, token: string) => {
    return (
      this.host.map.workspace?.token === token &&
      this.uncertainState.value?.command.action.kind === 'calendar-event' &&
      this.uncertainState.value.command.action.event.id === eventId
    );
  };

  recoverAgendaEvent = async (eventId: string, token: string) => {
    if (!this.agendaWritePending(eventId, token))
      throw new Error('Kein ungeklärter Speicherauftrag für dieses Ereignis.');
    const result = await this.resolveWorldWrite();
    if (!result || this.host.map.workspace?.token !== token)
      throw new Error('Speicherauftrag bleibt ungeklärt.');
    return result.outcome === 'applied'
      ? (result.ack.world.events.find((event) => event.id === eventId) ?? null)
      : null;
  };

  raw = async (
    action: WorldAction,
    stillCurrent: () => boolean = () => true,
    weatherIntent?: WeatherIntent,
  ) => {
    if (!this.host.map.workspace) throw new Error('Öffne eine Kampagne.');
    if (this.uncertainState.value)
      throw new Error('Unklare Weltänderung zuerst über Auftrag prüfen klären.');
    const owner = this.host.map.workspace,
      captured = structuredClone(action),
      versions = { ...this.edits };
    const generation = this.host.surface.editorSession.generation;
    const current = this.host.surface.editorSession.capture(() => [this.host.map.workspace?.token]);
    const command: WorldCommand = {
      commandId: crypto.randomUUID(),
      campaignId: owner.campaign.id,
      token: owner.token,
      action: captured,
    };
    const queue = this.worldWrites;
    if (queue.size) throw new Error('Vorherige Weltänderung wird noch gespeichert.');
    let complete!: () => void;
    const completion = new Promise<void>((resolve) => {
      complete = resolve;
    });
    queue.add(completion);
    this.host.surface.editorSession.track(completion);
    try {
      this.host.surface.tell('Welt wird gespeichert.');
      if (!(await this.host.surface.before()))
        throw new Error('Offene Live-Eingabe zuerst abschließen.');
      if (!current() || this.host.map.workspace?.token !== owner.token)
        throw new Error('Kampagne wurde gewechselt.');
      if (!stillCurrent()) throw new Error('Zielauswahl wurde gewechselt.');
      if (this.uncertainState.value)
        throw new Error('Unklare Weltänderung zuerst über Auftrag prüfen klären.');
      let result: Result<WorldAck>;
      try {
        result = await this.host.surface.write(command);
      } catch (error) {
        this.uncertainState.value = { command, versions, weatherIntent, generation };
        this.showUncertainWorldWrite();
        throw error;
      }
      const ack = this.host.surface.unwrap(result);
      if (!current() || this.host.map.workspace?.token !== owner.token)
        throw new Error('Kampagne wurde gewechselt.');
      if (!stillCurrent()) return ack;
      if (captured.kind !== 'weather-override') this.host.map.acceptSnapshot(ack);
      if (captured.kind !== 'weather-override') this.host.surface.tell('Weltänderung bestätigt.');
      return ack;
    } finally {
      queue.delete(completion);
      complete();
    }
  };

  action = async (a: WorldAction) => {
    if (!(await this.flushWorld())) return;
    await this.raw(a);
    await this.host.map.reloadScene();
    this.host.map.renderMap();
    this.host.travel.renderJourney();
    await this.host.surface.after();
    this.host.surface.tell('Welt und Reise gespeichert.');
  };

  get edits(): WorldEdits {
    return {
      map: this.host.map.mapEdits,
      marker: this.host.map.markerEdits,
      calendar: this.host.calendar.calendarEdits,
      phenomenon: this.host.weather.phenomenonEdits,
    };
  }

  flushWorld = async (): Promise<boolean> => {
    this.host.map.mapGestures?.finish();
    if (this.pendingWork.value) return this.pendingWork.value;
    if (this.uncertainState.value) {
      this.host.surface.tell(
        'Weltänderung ist unklar. Auftrag prüfen erhält die offenen Eingaben.',
        true,
      );
      return false;
    }
    const token = this.host.map.workspace?.token;
    const current = this.host.surface.editorSession.capture(() => [this.host.map.workspace?.token]);
    // Only preceding actions are awaited; this flush must not wait on its own raw writes.
    const preceding = [...this.worldWrites];
    const operation = Promise.resolve().then(async () => {
      try {
        await Promise.all(preceding);
        if (!current()) return false;
        if (!(await this.host.map.flushMarker())) return false;
        if (this.uncertainState.value) {
          if (this.host.map.workspace?.token === token)
            this.host.surface.tell(
              'Weltänderung ist unklar. Auftrag prüfen erhält die offenen Eingaben.',
              true,
            );
          return false;
        }
        do {
          if (!current() || this.host.map.workspace?.token !== token) return false;
          if (this.host.map.dirtyCell) this.host.map.collectCell();
          await this.host.map.flushDraft();
          await this.host.calendar.flushDraft();
          await this.host.weather.flushDraft();
          if (!current() || this.host.map.workspace?.token !== token) return false;
        } while (
          this.host.map.dirtyMap ||
          this.host.map.dirtyCell ||
          this.host.calendar.dirtyCalendar ||
          this.host.weather.dirtyPhenomenon
        );
        return true;
      } catch (error) {
        if (this.host.map.workspace?.token === token) {
          this.host.surface.tell((error as Error).message + ' Eingaben bleiben offen.', true);
          if (this.host.calendar.calendarRules?.open)
            this.host.calendar.calendarStatus(
              (error as Error).message + ' Eingaben bleiben offen.',
            );
        }
        return false;
      }
    });
    this.pendingWork.value = operation;
    return operation;
  };
}
