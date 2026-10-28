import type { WorkspaceGeometry } from '../shared/contracts';
import type { LiveScene } from './live-scene-contracts';
import type { LiveAction } from './live-contracts';
import type { AgendaPage, AgendaCursor, AgendaItem } from './agenda-contracts';
import type { TimeRequest, TimePreview } from './time-plan-contracts';
import { agendaUnitLabels, calendarParts, calendarInstant, type AgendaUnit } from './agenda-model';
import { calendarDate } from './world-model';
import { formatDuration } from './time-plan-model';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    return n;
  },
  button = (text: string, fn: () => void) => {
    const b = node('button', text);
    b.type = 'button';
    b.onclick = fn;
    return b;
  },
  field = (text: string, control: HTMLElement) => {
    const label = node('label', text);
    label.append(control);
    return label;
  };
type Context = { workspace: WorkspaceGeometry; scene: LiveScene };
export class TimeNavigator {
  private dialog = node('dialog');
  private mode = node('select');
  private amount = node('input');
  private unit = node('select');
  private dateFields = new Map<string, HTMLInputElement | HTMLSelectElement>();
  private dateBox = node('div');
  private durationBox = node('div');
  private eventBox = node('section');
  private eventList = node('div');
  private search = node('input');
  private phase = node('select');
  private reason = node('input');
  private summary = node('div');
  private status = node('p');
  private currentDate = node('p');
  private confirm = button('Zeit ausdrücklich verstreichen lassen', () => void this.apply());
  private recovery = button('Speicherstatus prüfen', () => void this.recover());
  private calculate = button('Vorschau berechnen', () => void this.preview());
  private next = button('Weitere Ereignisse', () => {
    if (this.page?.next) {
      this.cursor = this.page.next;
      void this.read();
    }
  });
  private prev = button('Erste Ereignisse', () => {
    this.cursor = null;
    void this.read();
  });
  private owner: Context | null = null;
  private page: AgendaPage | null = null;
  private cursor: AgendaCursor | null = null;
  private selected: AgendaItem | null = null;
  private preselected: {
    eventId: string;
    expectedRevision: number;
    phase: 'start' | 'end';
    sceneId: string;
    title?: string;
  } | null = null;
  private result: TimePreview | null = null;
  private request = 0;
  private reading = 0;
  private busy = false;
  private epoch = 0;
  private loading = false;
  private readVersion = 0;
  private refresh = button('Kalender und Ereignisse neu lesen', () => {
    if (!this.busy && this.recovery.hidden) void this.read();
  });
  constructor(
    private tell: (s: string, error?: boolean) => void,
    private context: () => Context | null,
    private flush: () => Promise<boolean>,
    private execute: (
      action: Extract<LiveAction, { kind: 'advance-clock' }>,
      stillCurrent: () => boolean,
    ) => Promise<boolean>,
    private recoverWrite: () => Promise<boolean>,
  ) {
    this.dialog.id = 'time-navigator';
    this.dialog.className = 'time-navigator';
    this.dialog.setAttribute('aria-labelledby', 'time-navigator-heading');
    this.status.id = 'time-navigator-status';
    this.status.setAttribute('role', 'status');
    this.summary.id = 'time-navigator-preview';
    this.mode.id = 'time-navigator-mode';
    this.mode.setAttribute('aria-label', 'Zeitwahl');
    for (const [id, title] of [
      ['duration', 'Dauer warten'],
      ['instant', 'Bis zu einem Kalenderdatum'],
      ['event', 'Bis zu einem Kalenderereignis'],
      ['next-day', 'Bis zum nächsten Tagesbeginn'],
    ] as const)
      this.mode.add(new Option(title, id));
    this.amount.id = 'time-navigator-amount';
    this.amount.type = 'number';
    this.amount.min = '0.001';
    this.amount.step = '0.001';
    this.amount.value = '1';
    this.amount.setAttribute('aria-label', 'Wartedauer');
    this.unit.id = 'time-navigator-unit';
    this.unit.setAttribute('aria-label', 'Zeiteinheit');
    for (const [id, label] of Object.entries(agendaUnitLabels))
      this.unit.add(new Option(label, id));
    this.unit.value = 'hour';
    this.durationBox.className = 'time-navigator-fields';
    this.durationBox.append(field('Dauer', this.amount), field('Einheit', this.unit));
    this.dateBox.className = 'time-navigator-date';
    for (const [id, label] of [
      ['year', 'Jahr'],
      ['month', 'Monat'],
      ['day', 'Tag'],
      ['hour', 'Stunde'],
      ['minute', 'Minute'],
    ] as const) {
      const wrapper = node('label', label),
        input = id === 'month' ? node('select') : node('input');
      input.id = 'time-navigator-' + id;
      if (input instanceof HTMLInputElement) {
        input.type = id === 'year' ? 'text' : 'number';
        input.min = id === 'day' ? '1' : '0';
        input.step = '1';
      }
      wrapper.append(input);
      this.dateFields.set(id, input);
      this.dateBox.append(wrapper);
    }
    this.search.id = 'time-navigator-search';
    this.search.type = 'search';
    this.search.placeholder = 'Ereignis finden';
    this.search.setAttribute('aria-label', 'Kalenderereignis suchen');
    this.phase.id = 'time-navigator-phase';
    this.phase.setAttribute('aria-label', 'Bis Beginn oder Ende warten');
    this.phase.add(new Option('Bis zum Beginn', 'start'));
    this.phase.add(new Option('Bis zum Ende', 'end'));
    this.eventList.id = 'time-navigator-events';
    const eventFields = node('div');
    eventFields.className = 'time-navigator-fields';
    eventFields.append(field('Ereignis suchen', this.search), field('Zielzeitpunkt', this.phase));
    const pages = node('div');
    pages.className = 'toolbar';
    pages.append(this.prev, this.next);
    this.eventBox.append(eventFields, this.eventList, pages);
    this.reason.id = 'time-navigator-reason';
    this.reason.maxLength = 2000;
    this.reason.placeholder = 'Optional, z. B. Wache abwarten';
    this.reason.setAttribute('aria-label', 'Grund für den Zeitsprung');
    const heading = node('h2', 'Zeit am Spieltisch');
    heading.id = 'time-navigator-heading';
    const head = node('div');
    head.className = 'toolbar';
    head.append(
      heading,
      button('Schließen', () => {
        if (!this.busy) this.reset();
      }),
    );
    const actions = node('div');
    actions.className = 'toolbar';
    actions.append(this.refresh, this.calculate, this.confirm, this.recovery);
    this.recovery.hidden = true;
    this.dialog.append(
      head,
      this.currentDate,
      node(
        'p',
        'Kalenderereignisse, Wetter, NPC-Verhalten und andere Zeitfolgen verwenden die bestehende Gruppenzeit. Rastwirkungen bestätigst du im Rastbereich.',
      ),
      field('Zeitpunkt wählen', this.mode),
      this.durationBox,
      this.dateBox,
      this.eventBox,
      field('Grund (optional)', this.reason),
      actions,
      this.status,
      this.summary,
    );
    document.body.append(this.dialog);
    document.getElementById('time-plan-open')!.onclick = () => {
      const epoch = this.epoch;
      void this.open().catch((e) => {
        if (epoch === this.epoch) this.report((e as Error).message);
      });
    };
    this.mode.onchange = () => {
      this.invalidate();
      this.drawMode();
    };
    this.dialog.addEventListener('input', () => this.invalidate());
    this.phase.onchange = this.unit.onchange = () => this.invalidate();
    this.search.oninput = () => {
      this.cursor = null;
      void this.read();
    };
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (!this.busy) this.reset();
    });
    this.confirm.disabled = true;
  }
  reset() {
    this.epoch++;
    this.request++;
    this.reading++;
    this.readVersion = 0;
    this.owner = null;
    this.page = null;
    this.selected = null;
    this.preselected = null;
    this.result = null;
    this.busy = false;
    this.loading = false;
    this.recovery.hidden = true;
    this.recovery.disabled = false;
    this.refresh.disabled = false;
    this.calculate.disabled = true;
    this.confirm.disabled = true;
    for (const input of this.dialog.querySelectorAll<HTMLInputElement>('input,select'))
      input.disabled = false;
    this.eventList.replaceChildren();
    this.summary.replaceChildren();
    this.status.textContent = '';
    this.dialog.close();
  }
  contextChanged() {
    const c = this.context();
    if (
      this.owner &&
      (c?.workspace.token !== this.owner.workspace.token || c.scene.id !== this.owner.scene.id)
    )
      this.reset();
  }
  private current(owner = this.owner, epoch = this.epoch) {
    const c = this.context();
    return (
      epoch === this.epoch &&
      !!owner &&
      this.owner === owner &&
      c?.workspace.token === owner.workspace.token &&
      c.scene.id === owner.scene.id &&
      this.dialog.open
    );
  }
  private fields() {
    return JSON.stringify(
      [...this.dialog.querySelectorAll<HTMLInputElement>('input,select')]
        .filter((n) => n !== this.search)
        .map((n) => [n.id, n.value]),
    );
  }
  private report(message: string) {
    this.status.textContent = message;
    this.tell(message, true);
  }
  private invalidate() {
    this.request++;
    this.result = null;
    this.confirm.disabled = true;
    this.summary.replaceChildren();
  }
  private drawMode() {
    this.durationBox.hidden = this.mode.value !== 'duration';
    this.dateBox.hidden = this.mode.value !== 'instant';
    this.eventBox.hidden = this.mode.value !== 'event';
  }
  async open(target?: {
    eventId: string;
    expectedRevision: number;
    phase: 'start' | 'end';
    sceneId: string;
    title?: string;
  }) {
    if (this.dialog.open) return;
    const c = this.context();
    if (!c || (target && target.sceneId !== c.scene.id))
      throw new Error('Die fokussierte Gruppe hat gewechselt. Agenda neu öffnen.');
    this.reset();
    const epoch = this.epoch;
    try {
      if (
        !(await this.flush()) ||
        epoch !== this.epoch ||
        this.context()?.workspace.token !== c.workspace.token ||
        this.context()?.scene.id !== c.scene.id
      )
        return;
      this.owner = c;
      this.preselected = target ?? null;
      this.cursor = null;
      this.search.value = '';
      this.reason.value = '';
      this.mode.value = target ? 'event' : 'duration';
      this.phase.value = target?.phase ?? 'start';
      this.drawMode();
      this.dialog.showModal();
      const readNumber = this.reading + 1,
        ready = await this.read(target?.eventId);
      if (!this.current(c, epoch) || !this.page || this.readVersion !== readNumber) return;
      const parts = calendarParts(
        this.page.calendar,
        this.page.scene?.instantMs ?? c.scene.clock.instantMs,
      );
      for (const [id, value] of Object.entries(parts)) this.dateFields.get(id)!.value = value;
      if (target && ready) await this.preview();
    } catch (e) {
      if (
        epoch === this.epoch &&
        this.context()?.workspace.token === c.workspace.token &&
        this.context()?.scene.id === c.scene.id
      )
        this.report((e as Error).message);
    }
  }
  private async read(preselect?: string, duringRecovery = false): Promise<boolean> {
    const o = this.owner,
      epoch = this.epoch;
    if (!o || (!duringRecovery && (this.busy || !this.recovery.hidden))) return false;
    const n = ++this.reading;
    const fields = this.fields();
    this.loading = true;
    this.refresh.disabled = true;
    this.calculate.disabled = true;
    this.invalidate();
    this.status.textContent = 'Aktuelle Zeit und Ereignisse werden gelesen…';
    try {
      const r = await window.campaign.agenda(o.workspace.token, {
        sceneId: o.scene.id,
        search: this.search.value,
        location: 'all',
        horizonDays: null,
        includePast: false,
        after: this.cursor,
      });
      if (!this.current(o, epoch) || n !== this.reading) return false;
      if (!r.ok) throw new Error(r.error);
      if (r.value.scene?.id !== o.scene.id)
        throw new Error('Zeitantwort gehört nicht zur gezeigten Gruppe.');
      if (this.fields() !== fields) {
        this.status.textContent =
          'Spätere Zeitangaben bleiben offen. Kalender und Ereignisse erneut lesen; danach eine neue Vorschau prüfen.';
        return false;
      }
      if (this.page && r.value.calendar.revision !== this.page.calendar.revision)
        throw new Error(
          'Kalenderregeln geändert. Zeitangaben behalten; Kalenderbasis durch erneutes Öffnen ausdrücklich prüfen.',
        );
      this.page = r.value;
      this.readVersion = n;
      this.currentDate.textContent =
        o.scene.title + ' · ' + calendarDate(r.value.calendar, r.value.scene.instantMs);
      const month = this.dateFields.get('month') as HTMLSelectElement,
        previous = month.value;
      month.replaceChildren(
        ...r.value.calendar.months.map((m, i) => new Option(m.name, String(i))),
      );
      month.value = previous;
      const targetId = preselect ?? this.selected?.event.id ?? this.preselected?.eventId,
        expected =
          this.preselected && this.preselected.eventId === targetId
            ? this.preselected.expectedRevision
            : this.selected?.event.revision;
      const candidate = r.value.items.find((i) => i.event.id === targetId);
      this.selected =
        candidate && (expected === undefined || candidate.event.revision === expected)
          ? candidate
          : null;
      this.drawEvents();
      if (candidate && expected !== undefined && candidate.event.revision !== expected) {
        this.status.textContent =
          'Ereignis seit Auswahl geändert. Aktuelles Ereignis ausdrücklich erneut auswählen.';
        return false;
      }
      this.status.textContent = 'Zeitwahl treffen, Vorschau prüfen und ausdrücklich bestätigen.';
      return true;
    } catch (e) {
      if (this.current(o, epoch) && n === this.reading) this.report((e as Error).message);
      return false;
    } finally {
      if (this.current(o, epoch) && n === this.reading) {
        this.loading = false;
        this.refresh.disabled = false;
        this.calculate.disabled =
          !this.recovery.hidden || !this.page || this.readVersion !== this.reading;
      }
    }
  }
  private drawEvents() {
    const page = this.page,
      o = this.owner,
      epoch = this.epoch,
      n = this.readVersion;
    if (!page) return;
    this.next.disabled = !page.next;
    this.prev.disabled = !this.cursor;
    this.eventList.replaceChildren();
    if (this.preselected)
      this.eventList.append(
        node('p', 'Aus der Agenda ausgewählt: ' + (this.preselected.title ?? 'Kalenderereignis')),
      );
    for (const item of page.items) {
      const b = button(
        item.event.name +
          ' · ' +
          calendarDate(page.calendar, item.startMs) +
          (item.state === 'active' ? ' · jetzt aktiv' : ''),
        () => {
          if (!b.isConnected || !this.current(o, epoch) || n !== this.reading) return;
          this.selected = item;
          this.preselected = null;
          this.invalidate();
          this.drawEvents();
        },
      );
      b.dataset.eventId = item.event.id;
      b.setAttribute('aria-pressed', String(this.selected?.event.id === item.event.id));
      this.eventList.append(b);
    }
    if (!page.items.length)
      this.eventList.append(
        node(
          'p',
          'Keine passenden zukünftigen oder aktiven Ereignisse. In der Agenda eine Frist anlegen.',
        ),
      );
  }
  private parameters(): TimeRequest {
    const o = this.owner,
      page = this.page;
    if (!o || !page) throw new Error('Gruppe und Kalender laden.');
    const base = {
      sceneId: o.scene.id,
      expectedCalendarRevision: page.calendar.revision,
      reason: this.reason.value || 'Warten am Spieltisch',
    };
    if (this.mode.value === 'duration')
      return {
        ...base,
        kind: 'duration',
        amount: this.amount.value,
        unit: this.unit.value as AgendaUnit,
      };
    if (this.mode.value === 'next-day') return { ...base, kind: 'next-day' };
    if (this.mode.value === 'event') {
      const target = this.selected
        ? {
            eventId: this.selected.event.id,
            expectedRevision: this.selected.event.revision,
            title: this.selected.event.name,
          }
        : this.preselected;
      if (!target) throw new Error('Kalenderereignis auswählen.');
      return {
        ...base,
        kind: 'event',
        eventId: target.eventId,
        expectedRevision: target.expectedRevision,
        phase: this.phase.value as 'start' | 'end',
        reason:
          this.reason.value ||
          'Warten bis ' +
            (this.phase.value === 'end' ? 'Ende' : 'Beginn') +
            ': ' +
            (target.title ?? 'Kalenderereignis'),
      };
    }
    const p = Object.fromEntries(
      [...this.dateFields].map(([id, n]) => [id, n.value]),
    ) as ReturnType<typeof calendarParts>;
    return { ...base, kind: 'instant', instantMs: String(calendarInstant(page.calendar, p)) };
  }
  private async preview() {
    const o = this.owner,
      epoch = this.epoch,
      n = ++this.request;
    if (
      !o ||
      this.busy ||
      this.loading ||
      !this.recovery.hidden ||
      this.readVersion !== this.reading
    )
      return;
    this.result = null;
    this.confirm.disabled = true;
    try {
      const r = await window.campaign.previewTime(o.workspace.token, this.parameters());
      if (!this.current(o, epoch) || n !== this.request) return;
      if (!r.ok) throw new Error(r.error);
      this.result = r.value;
      const p = r.value;
      this.summary.replaceChildren(
        node('h3', p.sceneTitle),
        node('p', 'Von ' + calendarDate(p.calendar, p.from)),
        node('strong', 'Bis ' + calendarDate(p.calendar, p.to)),
        node('p', 'Wartedauer: ' + formatDuration(p.durationMs, p.calendar.daySeconds)),
      );
      if (p.journeyNotice) this.summary.append(node('p', p.journeyNotice));
      if (p.events.length) {
        const events = node('section');
        events.append(
          node(
            'h4',
            p.eventCount === undefined
              ? 'Ereignisbeginne in dieser Zeit · höchstens 40 angezeigt'
              : BigInt(p.eventCount) > BigInt(p.events.length)
                ? 'Ereignisbeginne: erste ' +
                  p.events.length +
                  ' von ' +
                  p.eventCount +
                  ' in dieser Zeit'
                : 'Ereignisbeginne in dieser Zeit: ' + p.eventCount,
          ),
        );
        for (const e of p.events)
          events.append(node('p', calendarDate(p.calendar, e.instantMs) + ' · ' + e.name));
        this.summary.append(events);
      }
      this.confirm.disabled = false;
      this.status.textContent = 'Vorschau bereit. Die Gruppenposition bleibt am aktuellen Ort.';
    } catch (e) {
      if (this.current(o, epoch) && n === this.request) this.report((e as Error).message);
    }
  }
  private async recover() {
    const o = this.owner,
      epoch = this.epoch;
    if (this.busy || !this.current(o, epoch)) return;
    this.busy = true;
    this.recovery.disabled = true;
    try {
      if (await this.recoverWrite()) {
        if (!this.current(o, epoch)) return;
        if ((await this.read(undefined, true)) && this.current(o, epoch)) {
          this.recovery.hidden = true;
          this.calculate.disabled = !this.page || this.readVersion !== this.reading;
          this.status.textContent = 'Auftrag geklärt. Eingaben bleiben; neue Zeitvorschau prüfen.';
        }
      }
    } catch (e) {
      if (this.current(o, epoch)) this.report((e as Error).message);
    } finally {
      if (this.current(o, epoch)) {
        this.busy = false;
        this.recovery.disabled = false;
      }
    }
  }
  private async apply() {
    const p = this.result,
      o = this.owner,
      epoch = this.epoch;
    if (!p || !this.current(o, epoch) || this.busy || this.loading) return;
    const current = () => this.current(o, epoch) && this.result === p;
    this.busy = true;
    this.confirm.disabled = true;
    this.calculate.disabled = true;
    this.refresh.disabled = true;
    for (const input of this.dialog.querySelectorAll<HTMLInputElement>('input,select'))
      input.disabled = true;
    try {
      const applied = await this.execute(p.action, current);
      if (!current()) return;
      if (applied) {
        this.reset();
        this.tell('Gruppenzeit bestätigt: ' + calendarDate(p.calendar, p.to));
      } else {
        this.result = null;
        this.recovery.hidden = false;
        this.status.textContent =
          'Zeit nicht bestätigt. Speicherstatus prüfen; die Zeitwahl bleibt erhalten.';
      }
    } catch (e) {
      if (this.current(o, epoch)) {
        this.result = null;
        this.recovery.hidden = false;
        this.report((e as Error).message + ' Speicherstatus prüfen; Zeitwahl bleibt erhalten.');
      }
    } finally {
      if (this.current(o, epoch)) {
        this.busy = false;
        this.calculate.disabled =
          !this.recovery.hidden || !this.page || this.readVersion !== this.reading;
        this.refresh.disabled = !this.recovery.hidden;
        for (const input of this.dialog.querySelectorAll<HTMLInputElement>('input,select'))
          input.disabled = false;
      }
    }
  }
}
