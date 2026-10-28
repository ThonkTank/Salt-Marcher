import { ownedEventTarget } from '../shared/owned-event-target';
import { agendaCountdown } from './agenda-model';
import type { CalendarEvent, FantasyCalendar } from './calendar-contracts';
import type { WorldEditorSurface } from './world-editor-surface';
import type {
  WorldMapPort,
  WorldRead,
  WorldWeatherPort,
  WorldWritePort,
} from './world-owner-ports';

function calendarCopy(calendar: WorldRead<FantasyCalendar>): FantasyCalendar {
  return {
    ...calendar,
    months: calendar.months.map((month) => ({ ...month })),
    weekdays: [...calendar.weekdays],
  };
}

interface Host {
  surface: Pick<
    WorldEditorSurface,
    | 'after'
    | 'api'
    | 'button'
    | 'cleanups'
    | 'document'
    | 'editorSession'
    | 'el'
    | 'number'
    | 'register'
    | 'tell'
    | 'unwrap'
    | 'value'
  >;
  writes: Pick<
    WorldWritePort,
    | 'checkingWorldWriteWork'
    | 'flushWorld'
    | 'pendingWork'
    | 'raw'
    | 'resolveWorldWrite'
    | 'showUncertainWorldWrite'
    | 'uncertainState'
    | 'worldWrites'
  >;
  map: Pick<WorldMapPort, 'workspace' | 'world'>;
  weather: Pick<WorldWeatherPort, 'liveFocusId' | 'liveRequest' | 'liveWorld'>;
}
export class WorldCalendarEditor {
  calendarEdits = 0;
  constructor(readonly host: Host) {}
  dirtyCalendar = false;

  calendarRules: HTMLDialogElement | null = null;

  calendarRulesEpoch = 0;

  calendarRulesBusy = false;

  calendarRulesBasis: FantasyCalendar | null = null;

  calendarStatus = (message: string) => {
    const status = this.host.surface.el('calendar-rules-status');
    status.textContent = message;
    if (this.calendarRules?.open) status.scrollIntoView({ block: 'nearest' });
  };

  resetCalendarRules = () => {
    this.calendarRulesEpoch++;
    this.calendarRulesBusy = false;
    this.calendarRulesBasis = null;
    if (this.calendarRules?.open) this.calendarRules.close();
    if (this.calendarRules)
      for (const field of this.calendarRules.querySelectorAll<HTMLInputElement>(
        'input,textarea,button',
      ))
        field.disabled = false;
  };

  closeCalendarRules = (discard = false) => {
    if (
      this.calendarRulesBusy ||
      this.host.writes.pendingWork.value ||
      this.host.writes.uncertainState.value ||
      this.host.writes.checkingWorldWriteWork.value ||
      this.host.writes.worldWrites.size
    ) {
      this.calendarStatus('Speicherauftrag zuerst abschließen oder prüfen.');
      return false;
    }
    if (this.dirtyCalendar && !discard) {
      this.calendarStatus('Kalenderangaben zuerst speichern oder ausdrücklich verwerfen.');
      return false;
    }
    if (discard) {
      this.dirtyCalendar = false;
      this.calendarEdits++;
      this.renderCalendar();
    }
    this.resetCalendarRules();
    return true;
  };

  openWorldCalendar = async () => {
    const attached = this.host.surface.editorSession.capture();
    if (!this.host.map.workspace || this.calendarRules?.open) return;
    const token = this.host.map.workspace.token,
      n = ++this.calendarRulesEpoch;
    if (
      !(await this.host.writes.flushWorld()) ||
      this.host.map.workspace?.token !== token ||
      n !== this.calendarRulesEpoch
    )
      return;
    const result = await this.host.surface.api.world(token);
    if (!attached() || this.host.map.workspace?.token !== token || n !== this.calendarRulesEpoch)
      return;
    this.calendarRulesBasis = structuredClone(this.host.surface.unwrap(result).calendar);
    this.renderCalendar();
    this.calendarStatus(
      'Kalenderregeln deuten bestehende Zeitpunkte. Gruppenzeit und Ereignisse bleiben unverändert.',
    );
    this.calendarRules!.showModal();
    this.host.surface.el('calendar-name').focus();
  };

  installCalendarRules = () => {
    this.host.surface.el('calendar-form').oninput = () => {
      this.dirtyCalendar = true;
      this.calendarEdits++;
    };
    // Move the existing form out of the retired map surface; keep its writer,
    // revision checks and original-command reconciliation.
    this.calendarRules = this.host.surface.document.createElement('dialog');
    this.calendarRules.id = 'calendar-rules';
    this.calendarRules.className = 'calendar-rules';
    this.calendarRules.setAttribute('aria-labelledby', 'calendar-rules-heading');
    const section = this.host.surface.el('calendar-form').parentElement!,
      heading = section.querySelector('h3')!;
    heading.id = 'calendar-rules-heading';
    const status = this.host.surface.document.createElement('p');
    status.id = 'calendar-rules-status';
    status.setAttribute('role', 'status');
    const actions = this.host.surface.document.createElement('div');
    actions.className = 'toolbar';
    const check = this.host.surface.button('Speicherauftrag prüfen', async () => {
      await this.calendarRulesWork(true);
    });
    check.id = 'calendar-write-check';
    check.hidden = true;
    actions.append(
      this.host.surface.button('Schließen', () => {
        this.closeCalendarRules();
      }),
      this.host.surface.button('Eingaben verwerfen', () => {
        this.closeCalendarRules(true);
      }),
      check,
    );
    this.host.surface.register(section);
    this.calendarRules.append(actions, status, section);
    this.host.surface.register(this.calendarRules);
    this.host.surface.document.body.append(this.calendarRules);
    const agenda = this.host.surface.el('world-agenda-open');
    agenda.textContent = 'Zurück zu Ereignissen und Fristen';
    ownedEventTarget(agenda, this.host.surface.cleanups).addEventListener(
      'click',
      (e) => {
        if (this.calendarRules?.open && !this.closeCalendarRules()) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    ownedEventTarget(this.calendarRules, this.host.surface.cleanups).addEventListener(
      'cancel',
      (e) => {
        e.preventDefault();
        this.closeCalendarRules();
      },
    );
    this.host.surface.el('calendar-form').onsubmit = (e) => {
      e.preventDefault();
      void this.calendarRulesWork(false);
    };
  };

  calendarRulesWork = async (reconcile: boolean) => {
    if (!this.calendarRules?.open || this.calendarRulesBusy || !this.host.map.workspace) return;
    const token = this.host.map.workspace.token,
      n = this.calendarRulesEpoch,
      current = () =>
        this.host.map.workspace?.token === token &&
        n === this.calendarRulesEpoch &&
        this.calendarRules!.open;
    this.calendarRulesBusy = true;
    for (const field of this.calendarRules.querySelectorAll<HTMLInputElement>(
      'input,textarea,button',
    ))
      field.disabled = true;
    try {
      if (reconcile) {
        const result = await this.host.writes.resolveWorldWrite();
        if (!current()) return;
        if (!result) {
          this.calendarStatus('Speicherauftrag weiterhin ungeklärt. Erneut prüfen.');
          return;
        }
        if (result.outcome === 'applied') {
          this.calendarRulesBasis = calendarCopy(this.host.map.world!.calendar);
          this.renderCalendar();
        }
        this.calendarStatus(
          result.outcome === 'applied'
            ? 'Kalender gespeichert. Gruppenzeit und Ereignisse bleiben unverändert.'
            : 'Auftrag nicht übernommen. Eingaben bleiben offen.',
        );
      } else {
        if (!(await this.host.writes.flushWorld()) || !current()) return;
        this.renderCalendar();
        this.calendarStatus(
          'Kalender gespeichert. Gruppenzeit und Ereignisse bleiben unverändert.',
        );
      }
      if (current()) await this.host.surface.after();
    } catch (error) {
      if (current()) this.calendarStatus((error as Error).message + ' Eingaben bleiben offen.');
    } finally {
      if (current()) {
        this.calendarRulesBusy = false;
        for (const field of this.calendarRules!.querySelectorAll<HTMLInputElement>(
          'input,textarea,button',
        ))
          field.disabled = false;
        this.host.writes.showUncertainWorldWrite();
      }
    }
  };

  renderCalendar = () => {
    const c = this.calendarRulesBasis ?? this.host.map.world?.calendar;
    if (!c || (this.calendarRules?.open && this.dirtyCalendar)) return;
    if (this.calendarRules?.open) this.calendarRulesBasis = calendarCopy(c);
    for (const [id, v] of Object.entries({
      'calendar-name': c.name,
      'calendar-year': String(c.startYear),
      'calendar-hours': String(c.daySeconds / 3600),
      'calendar-months': c.months.map((m) => m.name + ': ' + m.days).join('\n'),
      'calendar-weekdays': c.weekdays.join(', '),
    }))
      this.host.surface.el<HTMLInputElement>(id).value = v;
  };

  saveAgendaEvent = async (
    event: CalendarEvent,
    expectedRevision: number | null,
    basis: import('./agenda-contracts').AgendaBasis,
    token: string,
    stillCurrent: () => boolean = () => true,
  ) => {
    if (
      this.host.map.workspace?.token !== token ||
      !stillCurrent() ||
      !(await this.host.writes.flushWorld())
    )
      throw new Error('Offene Welt-Eingaben zuerst abschließen.');
    const ack = await this.host.writes.raw(
      { kind: 'calendar-event', event, expectedRevision, basis },
      () => this.host.map.workspace?.token === token && stillCurrent(),
    );
    const saved = ack.world.events.find((e) => e.id === event.id);
    if (!saved || saved.revision !== (expectedRevision ?? 0) + 1)
      throw new Error('Ereignisbestätigung fehlt.');
    try {
      await this.host.surface.after();
    } catch (e) {
      this.host.surface.tell(
        'Ereignis gespeichert; Live-Anzeige später aktualisieren: ' + (e as Error).message,
        true,
      );
    }
    return saved;
  };

  agendaRead = 0;

  agendaPending = (message: string, busy = true) => {
    this.agendaRead++;
    const root = this.host.surface.el('live-agenda-upcoming');
    if (root) {
      root.textContent = message;
      root.setAttribute('aria-busy', String(busy));
    }
  };

  renderLiveAgenda = async (token: string, sceneId: string, request: number) => {
    const attached = this.host.surface.editorSession.capture();
    const root = this.host.surface.el('live-agenda-upcoming');
    if (!root) return;
    this.agendaPending('Termine werden geladen …');
    const read = this.agendaRead;
    const current = () =>
      attached() &&
      this.host.map.workspace?.token === token &&
      request === this.host.weather.liveRequest &&
      read === this.agendaRead &&
      this.host.weather.liveFocusId === sceneId;
    try {
      const result = this.host.surface.unwrap(
        await this.host.surface.api.agenda(token, {
          sceneId,
          search: '',
          location: 'current',
          horizonDays: 1,
          includePast: false,
          after: null,
        }),
      );
      if (!current()) return;
      if (result.scene?.id !== sceneId) throw new Error('Agenda gehört zu einer anderen Gruppe.');
      if (
        this.host.weather.liveWorld &&
        (result.scene.clockRevision !== this.host.weather.liveWorld.scene.clock.revision ||
          result.scene.instantMs !== this.host.weather.liveWorld.scene.clock.instantMs ||
          result.scene.locationId !== this.host.weather.liveWorld.scene.locationId)
      )
        throw new Error('Termine und Gruppenstand sind verschieden. Gruppe erneut laden.');
      root.replaceChildren();
      for (const item of result.items.slice(0, 3)) {
        const p = this.host.surface.document.createElement('p'),
          delta = String(
            BigInt(item.state === 'active' ? item.endMs : item.startMs) -
              BigInt(result.scene.instantMs),
          );
        p.textContent =
          item.event.name +
          ' · ' +
          (item.state === 'active' ? 'jetzt aktiv, noch ' : 'in ') +
          agendaCountdown(result.calendar, delta);
        root.append(p);
      }
      if (!result.items.length) {
        const p = this.host.surface.document.createElement('p');
        p.className = 'caption';
        p.textContent = 'Keine Kalenderereignisse am Gruppenort im nächsten Tag.';
        root.append(p);
      }
    } catch (error) {
      if (current()) root.textContent = 'Agenda nicht verfügbar: ' + (error as Error).message;
    } finally {
      if (current()) root.setAttribute('aria-busy', 'false');
    }
  };

  activate = () => {
    this.resetCalendarRules();
    this.dirtyCalendar = false;
    this.agendaPending('Keine Gruppe geladen.', false);
  };

  flushDraft = async () => {
    const basis = this.calendarRulesBasis ?? this.host.map.world?.calendar;
    if (this.dirtyCalendar && !basis) throw new Error('Kalenderbasis fehlt. Regeln erneut öffnen.');
    if (this.dirtyCalendar && basis) {
      const version = this.calendarEdits;
      const months = this.host.surface
        .value('calendar-months')
        .split('\n')
        .filter((s) => s.trim())
        .map((s) => {
          const i = s.lastIndexOf(':');
          return { name: s.slice(0, i).trim(), days: Number(s.slice(i + 1)) };
        });
      const calendar = {
        ...basis,
        name: this.host.surface.value('calendar-name'),
        startYear: this.host.surface.number('calendar-year'),
        daySeconds: Math.round(this.host.surface.number('calendar-hours') * 3600),
        months,
        weekdays: this.host.surface
          .value('calendar-weekdays')
          .split(',')
          .map((s) => s.trim()),
      };
      const ack = await this.host.writes.raw({
        kind: 'calendar',
        calendar,
        expectedRevision: basis.revision,
      });
      this.calendarRulesBasis = structuredClone(ack.world.calendar);
      this.dirtyCalendar = this.calendarEdits !== version;
    }
  };

  acceptConfirmed = (
    command: import('./world-contracts').WorldCommand,
    ack: import('./world-contracts').WorldAck,
    versions: import('./world-editor-types').WorldEdits,
  ) => {
    if (command.action.kind === 'calendar') {
      this.calendarRulesBasis = structuredClone(ack.world.calendar);
      this.dirtyCalendar = this.calendarEdits !== versions.calendar;
    }
  };
}
