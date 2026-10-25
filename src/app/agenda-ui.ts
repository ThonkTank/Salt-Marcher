import type { WorkspaceGeometry } from './contracts';
import type { Preparation } from './preparation-contracts';
import type { CalendarEvent } from './world-contracts';
import type { AgendaPage, AgendaCursor, AgendaItem, AgendaBasis } from './agenda-contracts';
import {
  agendaCountdown,
  agendaDuration,
  agendaUnitLabels,
  calendarInstant,
  calendarParts,
  durationInput,
  type AgendaUnit,
} from './agenda-model';
import { calendarDate } from './world-model';
import { saveAgendaEvent, agendaWritePending, recoverAgendaEvent } from './world-ui';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const filterField = (text: string, control: HTMLElement) => {
  const label = node('label', text);
  label.className = 'agenda-filter-field';
  label.append(control);
  return label;
};
const button = (text: string, fn: () => void) => {
  const n = node('button', text);
  n.type = 'button';
  n.onclick = fn;
  return n;
};
export class CampaignAgenda {
  private dialog = node('dialog');
  private list = node('div');
  private document = node('div');
  private search = node('input');
  private horizon = node('select');
  private location = node('select');
  private past = node('input');
  private includeTrash = node('input');
  private locations: Preparation['locations'] = [];
  private caption = node('p');
  private status = node('p');
  private date = node('p');
  private form = node('form');
  private fields = new Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();
  private preview = node('p');
  private submit = node('button', 'Ereignis speichern');
  private trash = node('button', 'Ereignis in den Papierkorb');
  private token: string | null = null;
  private data: AgendaPage | null = null;
  private cursor: AgendaCursor | null = null;
  private stack: (AgendaCursor | null)[] = [];
  private selected: CalendarEvent | null = null;
  private draft: CalendarEvent | null = null;
  private originalDate = '';
  private request = 0;
  private busy = false;
  private place: { id: string; title: string } | null = null;
  private pinnedEventId: string | undefined;
  private back = button('Zur Ortsmappe', () => void this.backToPlace());
  private timer: ReturnType<typeof setTimeout> | null = null;
  private prev = button('Vorige Seite', () => {
    if (this.canLeave() && this.stack.length) {
      this.cursor = this.stack.pop()!;
      void this.load();
    }
  });
  private next = button('Nächste Seite', () => {
    if (this.canLeave() && this.data?.next) {
      this.stack.push(this.cursor);
      this.cursor = this.data.next;
      void this.load();
    }
  });
  private refresh = button('Zeit und Agenda aktualisieren', () => {
    if (this.canLeave()) {
      this.pinnedEventId = undefined;
      this.cursor = null;
      this.stack = [];
      void this.load();
    }
  });
  constructor(
    private workspace: () => WorkspaceGeometry | null,
    private drain: () => Promise<boolean>,
    private tell: (s: string, error?: boolean) => void,
    private navigate: (kind: 'live' | 'calendar') => Promise<void>,
    private wait: (target: {
      eventId: string;
      expectedRevision: number;
      phase: 'start' | 'end';
      sceneId: string;
      title?: string;
    }) => Promise<void>,
    private openPlace: (id: string) => Promise<void> = async () => {},
  ) {
    this.dialog.id = 'campaign-agenda';
    this.dialog.className = 'campaign-agenda';
    this.dialog.setAttribute('aria-labelledby', 'agenda-heading');
    const heading = node('h2', 'Kalender und Fristen');
    heading.id = 'agenda-heading';
    this.list.id = 'agenda-list';
    this.document.id = 'agenda-document';
    this.status.id = 'agenda-status';
    this.status.setAttribute('role', 'status');
    this.date.id = 'agenda-current-date';
    this.search.id = 'agenda-search';
    this.search.type = 'search';
    this.search.placeholder = 'Ereignis oder GM-Notiz suchen';
    this.search.setAttribute('aria-label', 'Kalenderereignisse durchsuchen');
    this.horizon.id = 'agenda-horizon';
    this.horizon.setAttribute('aria-label', 'Zeitraum');
    for (const [id, title] of [
      ['1', 'Nächster Tag'],
      ['2', 'Nächste zwei Tage'],
      ['5', 'Nächste fünf Tage'],
      ['10', 'Nächste zehn Tage'],
      ['', 'Alle bevorstehenden Ereignisse'],
    ] as const)
      this.horizon.add(new Option(title, id));
    this.horizon.value = '5';
    this.location.id = 'agenda-location-filter';
    this.location.setAttribute('aria-label', 'Ereignisorte');
    this.location.add(new Option('Alle Orte', 'all'));
    this.location.add(new Option('Aktueller Gruppenort und globale Ereignisse', 'current'));
    this.includeTrash.type = 'checkbox';
    this.includeTrash.id = 'agenda-trash';
    const trashLabel = node('label', ' Auch Papierkorb (alle Zeiträume)');
    trashLabel.prepend(this.includeTrash);
    this.past.type = 'checkbox';
    this.past.id = 'agenda-past';
    const pastLabel = node('label', ' Auch abgelaufene Einzelereignisse');
    pastLabel.prepend(this.past);
    const head = node('div');
    head.className = 'toolbar';
    head.append(
      heading,
      this.back,
      this.refresh,
      button('Schließen', () => this.close()),
    );
    const body = node('div');
    body.className = 'agenda-columns';
    const nav = node('section');
    nav.className = 'agenda-nav';
    const pages = node('div');
    pages.className = 'toolbar';
    pages.append(this.prev, this.next);
    nav.append(
      filterField('Suche', this.search),
      filterField('Zeitraum', this.horizon),
      filterField('Orte', this.location),
      pastLabel,
      trashLabel,
      this.caption,
      this.list,
      pages,
    );
    body.append(nav, this.document);
    this.dialog.append(head, this.date, this.status, body);
    document.body.append(this.dialog);
    this.buildForm();
    for (const id of ['agenda-open', 'live-agenda-open', 'world-agenda-open'])
      document.getElementById(id)!.onclick = () =>
        void this.open().catch((e) => this.report(e.message));
    this.search.oninput = () => {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      if (!this.canLeave()) return;
      const token = this.token,
        n = ++this.request;
      this.pinnedEventId = undefined;
      this.cursor = null;
      this.stack = [];
      this.selected = null;
      this.draft = null;
      this.form.remove();
      this.list.replaceChildren(node('p', 'Ereignisse werden gesucht…'));
      this.document.replaceChildren();
      this.prev.disabled = this.next.disabled = true;
      this.refresh.disabled = false;
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.current(token) && n === this.request) void this.load();
      }, 180);
    };
    this.horizon.onchange =
      this.location.onchange =
      this.past.onchange =
      this.includeTrash.onchange =
        () => {
          if (this.canLeave()) {
            this.pinnedEventId = undefined;
            this.cursor = null;
            this.stack = [];
            void this.load();
          }
        };
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      this.close();
    });
  }
  reset() {
    this.request++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.token = null;
    this.data = null;
    this.locations = [];
    this.place = null;
    this.pinnedEventId = undefined;
    this.draft = null;
    this.selected = null;
    this.busy = false;
    for (const input of this.form.querySelectorAll<HTMLInputElement>(
      'input,select,textarea,button',
    ))
      input.disabled = false;
    this.form.remove();
    this.list.replaceChildren();
    this.document.replaceChildren();
    this.dialog.close();
  }
  private current(token = this.token) {
    return !!token && this.token === token && this.workspace()?.token === token && this.dialog.open;
  }
  private report(message: string) {
    this.status.textContent = message;
    this.tell(message, true);
  }
  private close() {
    if (this.canLeave()) this.reset();
  }
  private dirty() {
    if (!this.draft) return false;
    if (!this.draft.revision) return true;
    try {
      return JSON.stringify(this.collect().event) !== JSON.stringify(this.selected);
    } catch {
      return true;
    }
  }
  private canLeave() {
    if (this.draft && this.token && agendaWritePending(this.draft.id, this.token)) {
      this.status.firstChild!.textContent =
        'Speicherauftrag ungeklärt. Zuerst den ursprünglichen Auftrag prüfen.';
      return false;
    }
    if (this.busy) {
      this.status.textContent = 'Ereignis wird gespeichert.';
      return false;
    }
    if (this.dirty()) {
      this.status.textContent =
        'Offene Ereignisangaben zuerst speichern oder ausdrücklich verwerfen.';
      return false;
    }
    return true;
  }
  private async open(place?: { id: string; title: string }, eventId?: string) {
    const w = this.workspace();
    if (!w || !this.canLeave()) return;
    this.reset();
    const n = this.request;
    try {
      if (!(await this.drain()) || this.request !== n || this.workspace()?.token !== w.token)
        return;
      const preparation = await window.campaign.preparation(w.token, '');
      if (this.request !== n || this.workspace()?.token !== w.token) return;
      if (!preparation.ok) throw new Error(preparation.error);
      this.locations = preparation.value.locations;
      this.token = w.token;
      this.place = place ?? null;
      this.pinnedEventId = eventId;
      this.back.hidden = !place;
      this.search.value = '';
      this.horizon.value = place ? '' : '5';
      this.location.querySelector('[value=place]')?.remove();
      if (place) this.location.add(new Option('Nur ' + place.title, 'place'));
      this.location.value = place ? 'place' : 'all';
      this.past.checked = !!place;
      this.includeTrash.checked = false;
      this.cursor = null;
      this.stack = [];
      this.dialog.showModal();
      await this.load();
      return this.current(w.token) && this.request === n + 1 && !!this.data;
    } catch (e) {
      if (this.request === n && this.workspace()?.token === w.token)
        this.report((e as Error).message);
    }
  }
  private async load() {
    const token = this.token,
      n = ++this.request;
    if (!token || !this.current(token)) return;
    const sceneId = this.data?.scene?.id ?? null;
    this.data = null;
    this.draft = null;
    this.form.remove();
    this.list.replaceChildren();
    this.document.replaceChildren();
    this.prev.disabled = this.next.disabled = true;
    this.refresh.disabled = true;
    try {
      const r = await window.campaign.agenda(token, {
        sceneId,
        search: this.search.value,
        location: this.location.value === 'current' ? 'current' : 'all',
        ...(this.location.value === 'place' && this.place ? { locationId: this.place.id } : {}),
        ...(this.pinnedEventId ? { eventId: this.pinnedEventId } : {}),
        horizonDays:
          !this.includeTrash.checked && this.horizon.value ? Number(this.horizon.value) : null,
        includePast: this.past.checked || this.includeTrash.checked,
        includeTrash: this.includeTrash.checked,
        after: this.cursor,
      });
      if (!this.current(token) || n !== this.request) return;
      if (!r.ok) throw new Error(r.error);
      this.data = r.value;
      this.date.textContent =
        calendarDate(r.value.calendar, r.value.scene?.instantMs ?? '0') +
        (r.value.scene
          ? ' · ' +
            r.value.scene.title +
            (r.value.scene.locationTitle ? ' · ' + r.value.scene.locationTitle : '')
          : ' · Kampagnenbeginn, keine fokussierte Gruppe');
      this.selected =
        r.value.items.find((i) => i.event.id === this.selected?.id)?.event ??
        r.value.items[0]?.event ??
        null;
      this.draft = null;
      this.drawList();
      this.drawDocument();
      this.status.textContent =
        'Countdowns verwenden die bestätigte Gruppenzeit. Lesen und Planen bewegen die Uhr nicht.';
    } catch (e) {
      if (this.current(token) && n === this.request) this.report((e as Error).message);
    } finally {
      if (this.current(token) && n === this.request) this.refresh.disabled = false;
    }
  }
  private control(text: string, fn: () => void) {
    const token = this.token,
      n = this.request,
      b = button(text, () => {
        if (b.isConnected && this.current(token) && this.request === n) fn();
      });
    return b;
  }
  private drawList() {
    const data = this.data;
    if (!data) return;
    this.caption.textContent =
      data.total +
      ' passende Ereignisse · ' +
      data.items.length +
      ' auf dieser Seite' +
      (this.pinnedEventId
        ? ' · Einzelansicht. „Zeit und Agenda aktualisieren“ öffnet die Liste.'
        : '');
    this.prev.disabled = !this.stack.length;
    this.next.disabled = !data.next;
    this.list.replaceChildren();
    for (const item of data.items) {
      const b = this.control(item.event.name + (item.event.trashed ? ' · Papierkorb' : ''), () => {
        if (this.canLeave()) {
          this.selected = item.event;
          this.draft = null;
          this.drawList();
          this.drawDocument();
        }
      });
      b.dataset.eventId = item.event.id;
      b.setAttribute('aria-pressed', String(item.event.id === this.selected?.id));
      b.append(
        node('small', this.countdown(item)),
        node('small', item.event.locationId ? item.locationTitle : 'Überall'),
      );
      this.list.append(b);
    }
    if (!data.items.length)
      this.list.append(
        node(
          'p',
          'Keine Ereignisse im gewählten Zeitraum. Lege die nächste Frist an oder ändere den Filter.',
        ),
      );
  }
  private countdown(item: AgendaItem) {
    const data = this.data;
    if (!data) return '';
    return item.state === 'active'
      ? 'Jetzt aktiv · noch ' +
          agendaCountdown(
            data.calendar,
            String(BigInt(item.endMs) - BigInt(data.scene?.instantMs ?? '0')),
          )
      : item.state === 'past'
        ? 'Abgelaufen'
        : 'In ' +
          agendaCountdown(
            data.calendar,
            String(BigInt(item.startMs) - BigInt(data.scene?.instantMs ?? '0')),
          );
  }
  private drawDocument() {
    this.form.remove();
    this.document.replaceChildren();
    const data = this.data;
    if (!data) return;
    const actions = node('div');
    actions.className = 'toolbar';
    actions.append(
      this.control('Neue Frist / Ereignis', () => {
        if (this.canLeave()) this.edit(null);
      }),
      this.control('Gruppenzeit am Spieltisch öffnen', () => void this.go('live')),
      this.control('Kalenderregeln bearbeiten…', () => void this.go('calendar')),
    );
    this.document.append(actions);
    const event = this.selected,
      item = data.items.find((i) => i.event.id === event?.id);
    if (!event || !item) {
      this.document.append(
        node('h3', 'Die nächste Wendung vorbereiten'),
        node(
          'p',
          'Wann trifft die Verstärkung ein? Wann öffnet der Markt? Lege ein Ereignis relativ zur Gruppenzeit oder an einem Datum des Kampagnenkalenders an.',
        ),
      );
      return;
    }
    this.document.append(
      node('h3', event.name),
      node('p', this.countdown(item)),
      node(
        'p',
        calendarDate(data.calendar, item.startMs) +
          ' bis ' +
          calendarDate(data.calendar, item.endMs),
      ),
      node(
        'p',
        event.locationId
          ? item.locationTitle + (item.locationAvailable ? '' : ' · nicht verfügbar')
          : 'Überall',
      ),
      node('pre', event.notes),
    );
    if (event.repeatMs)
      this.document.append(
        node(
          'p',
          'Wiederholung alle ' +
            agendaCountdown(data.calendar, event.repeatMs) +
            ' · gezeigt wird die aktuelle oder nächste Ausführung.',
        ),
      );
    this.document.append(
      this.control('Ereignis bearbeiten', () => {
        if (this.canLeave()) this.edit(event);
      }),
    );
    if (data.scene && !event.trashed && item.state !== 'past') {
      const wait = node('div');
      wait.className = 'toolbar';
      for (const phase of ['start', 'end'] as const) {
        const b = this.control(
          phase === 'start' ? 'Bis zum Beginn warten…' : 'Bis zum Ende warten…',
          () => {
            if (!this.canLeave()) return;
            const token = this.token,
              sceneId = data.scene!.id;
            this.reset();
            if (this.workspace()?.token === token)
              void this.wait({
                eventId: event.id,
                expectedRevision: event.revision,
                phase,
                sceneId,
                title: event.name,
              }).catch((e) => this.tell(e.message, true));
          },
        );
        b.disabled = phase === 'start' && item.state === 'active';
        wait.append(b);
      }
      this.document.append(wait);
    }
  }
  private async go(kind: 'live' | 'calendar') {
    if (!this.canLeave()) return;
    const token = this.token;
    this.reset();
    if (this.workspace()?.token === token)
      try {
        await this.navigate(kind);
      } catch (e) {
        this.tell((e as Error).message, true);
      }
  }
  private field(
    id: string,
    title: string,
    tag: 'input' | 'select' | 'textarea' = 'input',
    options?: [string, string][],
  ) {
    const label = node('label', title),
      input = node(tag);
    input.id = 'agenda-' + id;
    if (input instanceof HTMLInputElement)
      input.type = ['name', 'year'].includes(id) ? 'text' : 'number';
    if (options && input instanceof HTMLSelectElement)
      for (const [id, name] of options) input.add(new Option(name, id));
    label.append(input);
    this.fields.set(id, input);
    return label;
  }
  private buildForm() {
    this.form.id = 'agenda-event-form';
    const units = Object.entries(agendaUnitLabels) as [string, string][];
    this.form.append(
      node('h3', 'Ereignis vorbereiten'),
      this.field('name', 'Name'),
      this.field('start-mode', 'Beginn', 'select', [
        ['relative', 'Relativ zur bestätigten Gruppenzeit'],
        ['absolute', 'Datum im Kampagnenkalender'],
      ]),
    );
    const relative = node('div');
    relative.id = 'agenda-relative';
    relative.className = 'toolbar';
    relative.append(
      this.field('offset', 'Beginnt in'),
      this.field('offset-unit', 'Einheit', 'select', units),
    );
    const absolute = node('div');
    absolute.id = 'agenda-absolute';
    absolute.className = 'agenda-date-fields';
    for (const [id, label] of [
      ['year', 'Jahr'],
      ['month', 'Monat'],
      ['day', 'Tag'],
      ['hour', 'Stunde'],
      ['minute', 'Minute'],
    ] as const)
      absolute.append(this.field(id, label, id === 'month' ? 'select' : 'input'));
    this.form.append(relative, absolute);
    const durations = node('div');
    durations.className = 'toolbar';
    durations.append(
      this.field('duration', 'Dauer'),
      this.field('duration-unit', 'Einheit', 'select', units),
      this.field('repeat', 'Wiederholung alle (leer: einmalig)'),
      this.field('repeat-unit', 'Einheit', 'select', units),
    );
    this.form.append(
      durations,
      this.field('location', 'Ereignisort', 'select'),
      this.field('notes', 'GM-Notizen', 'textarea'),
    );
    this.preview.id = 'agenda-event-preview';
    this.form.append(this.preview);
    const controls = node('div');
    controls.className = 'toolbar';
    this.submit.type = 'submit';
    this.trash.type = 'button';
    this.trash.onclick = () => {
      if (
        !this.busy &&
        this.draft?.revision &&
        this.token &&
        !agendaWritePending(this.draft.id, this.token)
      ) {
        this.draft.trashed = !this.draft.trashed;
        void this.save();
      }
    };
    controls.append(
      this.submit,
      button('Eingaben verwerfen', () => {
        if (this.busy) return;
        if (this.draft && this.token && agendaWritePending(this.draft.id, this.token)) {
          this.canLeave();
          return;
        }
        this.draft = null;
        this.drawDocument();
        this.status.textContent = 'Ereignisangaben verworfen.';
      }),
      this.trash,
    );
    this.form.append(controls);
    this.form.oninput = this.form.onchange = () => this.drawPreview();
    this.form.onsubmit = (e) => {
      e.preventDefault();
      void this.save();
    };
    for (const id of ['offset', 'duration', 'repeat']) {
      const input = this.fields.get(id) as HTMLInputElement;
      input.min = '0';
      input.step = '0.001';
    }
    for (const id of ['day', 'hour', 'minute']) {
      const input = this.fields.get(id) as HTMLInputElement;
      input.min = id === 'day' ? '1' : '0';
      input.step = '1';
    }
    const notes = this.fields.get('notes') as HTMLTextAreaElement;
    notes.rows = 6;
  }
  private value(id: string) {
    return this.fields.get(id)!.value;
  }
  private set(id: string, value: string) {
    this.fields.get(id)!.value = value;
  }
  private dateFields() {
    const integer = (id: string) => {
      const value = this.value(id);
      return (id === 'year' ? /^-?\d+$/ : /^\d+$/).test(value) ? String(BigInt(value)) : value;
    };
    return {
      year: integer('year'),
      month: integer('month'),
      day: integer('day'),
      hour: integer('hour'),
      minute: integer('minute'),
    };
  }
  private edit(event: CalendarEvent | null) {
    const data = this.data;
    if (!data) return;
    this.draft = event
      ? structuredClone(event)
      : {
          id: crypto.randomUUID(),
          revision: 0,
          name: '',
          startMs: data.scene?.instantMs ?? '0',
          durationMs: '3600000',
          repeatMs: null,
          locationId: this.place?.id ?? data.scene?.locationId ?? null,
          notes: '',
          trashed: false,
        };
    const draft = this.draft;
    this.trash.hidden = !draft.revision;
    this.trash.textContent = draft.trashed
      ? 'Ereignis wiederherstellen'
      : 'Ereignis in den Papierkorb';
    this.set('name', draft.name);
    this.set('notes', draft.notes);
    this.set('start-mode', event || !data.scene ? 'absolute' : 'relative');
    (this.fields.get('month') as HTMLSelectElement).replaceChildren(
      ...data.calendar.months.map((m, i) => new Option(m.name, String(i))),
    );
    const parts = calendarParts(data.calendar, draft.startMs);
    for (const [id, value] of Object.entries(parts)) this.set(id, value);
    this.originalDate = JSON.stringify(parts);
    this.set('offset', '1');
    this.set('offset-unit', 'hour');
    const duration = durationInput(data.calendar, draft.durationMs);
    this.set('duration', duration.value);
    this.set('duration-unit', duration.unit);
    const repeat = draft.repeatMs
      ? durationInput(data.calendar, draft.repeatMs)
      : { value: '', unit: 'day' };
    this.set('repeat', repeat.value);
    this.set('repeat-unit', repeat.unit);
    const locations = this.fields.get('location') as HTMLSelectElement;
    locations.replaceChildren(new Option('Überall', ''));
    for (const row of this.locations)
      if (!row.trashed) locations.add(new Option(row.document.name, row.document.id));
    if (
      draft.locationId &&
      !this.locations.some((row) => row.document.id === draft.locationId && !row.trashed)
    )
      locations.add(
        new Option(
          data.items.find((i) => i.event.id === draft.id)?.locationTitle ?? 'Gebundener Ort',
          draft.locationId,
        ),
      );
    this.set('location', draft.locationId ?? '');
    this.document.replaceChildren(this.form);
    this.drawPreview();
  }
  private collect() {
    const data = this.data,
      draft = this.draft;
    if (!data || !draft) throw new Error('Ereignis wählen.');
    const relative = this.value('start-mode') === 'relative';
    if (relative && !data.scene)
      throw new Error('Für relative Fristen eine Gruppe am Spieltisch fokussieren.');
    const start = relative
      ? BigInt(data.scene!.instantMs) +
        agendaDuration(data.calendar, this.value('offset'), this.value('offset-unit') as AgendaUnit)
      : JSON.stringify(this.dateFields()) === this.originalDate
        ? BigInt(draft.startMs)
        : calendarInstant(data.calendar, this.dateFields());
    const duration = agendaDuration(
        data.calendar,
        this.value('duration'),
        this.value('duration-unit') as AgendaUnit,
      ),
      repeat = this.value('repeat')
        ? agendaDuration(
            data.calendar,
            this.value('repeat'),
            this.value('repeat-unit') as AgendaUnit,
          )
        : null;
    if (!this.value('name').trim() || duration <= 0n || (repeat !== null && repeat <= 0n))
      throw new Error('Name, positive Dauer und Wiederholung prüfen.');
    const notes =
        this.value('notes') === draft.notes.replace(/\r\n?/g, '\n')
          ? draft.notes
          : this.value('notes'),
      event = {
        ...draft,
        name: this.value('name'),
        startMs: String(start),
        durationMs: String(duration),
        repeatMs: repeat === null ? null : String(repeat),
        locationId: this.value('location') || null,
        notes,
      },
      basis: AgendaBasis = {
        calendarRevision: data.calendar.revision,
        sceneId: relative ? data.scene!.id : null,
        clockRevision: relative ? data.scene!.clockRevision : null,
        instantMs: relative ? data.scene!.instantMs : null,
      };
    return { event, basis };
  }
  private drawPreview() {
    if (!this.draft || !this.data) return;
    document.getElementById('agenda-relative')!.hidden = this.value('start-mode') !== 'relative';
    document.getElementById('agenda-absolute')!.hidden = this.value('start-mode') !== 'absolute';
    try {
      const { event } = this.collect();
      this.preview.textContent =
        'Vorschau: ' +
        calendarDate(this.data.calendar, event.startMs) +
        ' · Dauer ' +
        agendaCountdown(this.data.calendar, event.durationMs) +
        (event.repeatMs
          ? ' · wiederholt alle ' + agendaCountdown(this.data.calendar, event.repeatMs)
          : ' · einmalig');
      this.submit.disabled =
        this.busy ||
        (!!this.token && agendaWritePending(this.draft.id, this.token)) ||
        !this.dirty();
    } catch (e) {
      this.preview.textContent = (e as Error).message;
      this.submit.disabled = true;
    }
  }
  private async save() {
    const token = this.token,
      draft = this.draft,
      n = this.request;
    if (
      !token ||
      !draft ||
      !this.current(token) ||
      this.busy ||
      agendaWritePending(draft.id, token)
    )
      return;
    const owns = () => this.current(token) && this.request === n && this.draft === draft,
      unlock = () => {
        this.busy = false;
        for (const input of this.form.querySelectorAll<HTMLInputElement>(
          'input,select,textarea,button',
        ))
          input.disabled = false;
      };
    let value: ReturnType<CampaignAgenda['collect']>;
    try {
      value = this.collect();
    } catch (e) {
      this.report((e as Error).message);
      return;
    }
    this.busy = true;
    for (const button of this.form.querySelectorAll<HTMLButtonElement>('button'))
      button.disabled = true;
    try {
      const event = await saveAgendaEvent(
        value.event,
        value.event.revision || null,
        value.basis,
        token,
        owns,
      );
      if (!owns()) return;
      unlock();
      let unchanged = false;
      try {
        unchanged = JSON.stringify(this.collect().event) === JSON.stringify(value.event);
      } catch {}
      this.selected = event;
      if (!unchanged) {
        this.draft = { ...draft, revision: event.revision };
        this.drawPreview();
        this.status.textContent = 'Gesendete Fassung gespeichert. Spätere Eingaben bleiben offen.';
        return;
      }
      this.draft = null;
      // Read the confirmed identity directly, even outside the old filters or page.
      this.pinnedEventId = event.id;
      this.search.value = '';
      this.horizon.value = '';
      this.location.value = 'all';
      this.past.checked = true;
      this.includeTrash.checked = event.trashed;
      this.cursor = null;
      this.stack = [];
      await this.load();
      if (this.current(token) && this.request === n + 1)
        this.status.textContent =
          'Ereignis gespeichert. Gruppenzeit und Position bleiben unverändert.';
    } catch (e) {
      if (owns()) {
        this.report((e as Error).message + ' Eingaben bleiben erhalten.');
        if (agendaWritePending(draft.id, token))
          this.status.append(this.control('Speicherauftrag prüfen', () => void this.recover()));
        else
          this.status.append(
            this.control('Nur Zeitbasis und Vorschau aktualisieren', () => void this.rebase()),
          );
      }
    } finally {
      if (owns()) {
        unlock();
        this.drawPreview();
      }
    }
  }
  private async recover() {
    const token = this.token,
      draft = this.draft,
      n = this.request;
    if (!token || !draft || this.busy || !this.current(token)) return;
    this.busy = true;
    try {
      const event = await recoverAgendaEvent(draft.id, token);
      if (!this.current(token) || this.request !== n || this.draft !== draft) return;
      if (event) {
        this.draft = { ...draft, revision: event.revision };
        this.selected = event;
        this.status.textContent = 'Speicherauftrag bestätigt. Offene Eingaben bleiben erhalten.';
      } else
        this.status.textContent =
          'Speicherauftrag nicht übernommen. Offene Eingaben können erneut gespeichert werden.';
    } catch (e) {
      if (this.current(token) && this.request === n && this.draft === draft) {
        this.report((e as Error).message);
        this.status.append(this.control('Speicherauftrag prüfen', () => void this.recover()));
      }
    } finally {
      if (this.current(token) && this.request === n) {
        this.busy = false;
        this.drawPreview();
      }
    }
  }
  private async rebase() {
    if (this.busy || !this.data || !this.token || !this.draft) return;
    const token = this.token,
      n = this.request,
      draft = this.draft,
      base = this.data,
      current = () => this.current(token) && this.request === n && this.draft === draft;
    this.busy = true;
    this.drawPreview();
    try {
      const r = await window.campaign.agenda(token, {
        sceneId: base.scene?.id ?? null,
        search: '',
        location: 'all',
        horizonDays: 1,
        includePast: false,
        after: null,
      });
      if (!current()) return;
      if (!r.ok) throw new Error(r.error);
      if (r.value.calendar.revision !== base.calendar.revision)
        throw new Error(
          'Kalenderregeln geändert. Eingaben verwerfen und mit neuem Kalender öffnen.',
        );
      if (
        r.value.scene?.id !== base.scene?.id ||
        (r.value.scene && base.scene && r.value.scene.clockRevision < base.scene.clockRevision)
      )
        throw new Error('Zeitantwort gehört nicht zur gezeigten Gruppe oder ist älter.');
      this.data = { ...base, scene: r.value.scene };
      this.date.textContent = calendarDate(base.calendar, r.value.scene?.instantMs ?? '0');
      this.status.textContent =
        'Aktuelle Gruppenzeit gelesen. Neue Vorschau vor dem Speichern prüfen.';
    } catch (e) {
      if (current()) this.report((e as Error).message);
    } finally {
      if (current()) {
        this.busy = false;
        this.drawPreview();
      }
    }
  }

  async openMomentDraft(
    seed: { name: string; notes: string },
    place?: { id: string; title: string },
    current: () => boolean = () => true,
  ) {
    if (!current() || !(await this.open(place)) || !current() || !this.current() || !this.data)
      return;
    this.edit(null);
    this.set('name', seed.name);
    this.set('notes', seed.notes);
    this.drawPreview();
    this.fields.get('name')?.focus();
    this.status.textContent =
      'Chronikmoment übernommen. Zeitpunkt, Dauer und Notizen prüfen und die Frist ausdrücklich speichern.';
  }
  async openForLocation(id: string, title: string, eventId?: string, create = false) {
    if (!(await this.open({ id, title }, eventId))) return;
    if (this.current() && this.data && create) this.edit(null);
    if (this.current() && eventId && !this.selected)
      this.report(
        'Dieses Ereignis ist am Ort nicht mehr verfügbar. Zeit und Agenda aktualisieren.',
      );
  }
  private async backToPlace() {
    if (!this.canLeave() || !this.place) return;
    const place = this.place,
      token = this.token;
    this.reset();
    if (this.workspace()?.token === token)
      try {
        await this.openPlace(place.id);
      } catch (e) {
        this.tell((e as Error).message, true);
      }
  }
}
