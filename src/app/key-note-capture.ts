import {
  normalizedNoteTitle,
  type KeyNoteChoice,
  type KeyNoteChoices,
  type KeyNoteCaptureAPI,
  type KeyNoteCaptureCommand,
} from './key-note-capture-contracts';
import { campaignLocalId } from '../features/campaign/campaign-contracts';
type Source = Pick<KeyNoteCaptureCommand, 'token' | 'campaignId' | 'room'> & {
  title: string;
  current: () => boolean;
};
interface Options {
  prepare: () => Promise<Source | null>;
  api: KeyNoteCaptureAPI;
  roomUses?: (
    token: string,
    id: string,
  ) => Promise<import('./contracts').Result<import('./preparation-contracts').NoteRoomUsesPage>>;
  opened: (command: KeyNoteCaptureCommand, current: () => boolean) => Promise<void>;
  focusKey: () => void;
  tell: (text: string, error?: boolean) => void;
}
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};

/** A short capture form until creation; subsequent edits use the existing Preparation editor. */
export class KeyNoteCapture {
  private dialog = node('dialog');
  private form = node('form');
  private heading = node('h2', 'Notiz zum Raum');
  private kind = node('select');
  private title = node('input');
  private gm = node('textarea');
  private help = node('p');
  private status = node('p');
  private uses = node('p');
  private existing = node('div');
  private choiceStatus = node('p');
  private newNote = node('button', 'Eigenständige neue Notiz');
  private gmLabel = node('label', 'Notizen für die Spielleitung');
  private chosen: KeyNoteChoice | null = null;
  private explicitNew = '';
  private choices: KeyNoteChoices = { entries: [], more: false };
  private lookupQuery = '';
  private lookupSequence = 0;
  private lookupPending: Promise<boolean> | null = null;
  private submit = node('button', 'Anlegen und verknüpfen');
  private check = node('button', 'Status prüfen');
  private cancel = node('button', 'Abbrechen');
  private epoch = 0;
  private source: Source | null = null;
  private command: KeyNoteCaptureCommand | null = null;
  private pending = false;
  private applied = false;
  private composing = false;
  private conflict = false;
  constructor(private options: Options) {
    this.dialog.id = 'key-note-capture-dialog';
    this.dialog.setAttribute('aria-labelledby', 'key-note-capture-heading');
    this.heading.id = 'key-note-capture-heading';
    this.kind.id = 'key-note-kind';
    this.title.id = 'key-note-title';
    this.gm.id = 'key-note-gm';
    this.title.required = true;
    this.title.maxLength = 1000;
    this.gm.rows = 7;
    this.gm.maxLength = 2_000_000;
    for (const [id, label] of [
      ['note', 'Notiz'],
      ['rumor', 'Gerücht'],
      ['npc', 'NSC'],
      ['faction', 'Fraktion'],
      ['quest', 'Quest'],
    ]) {
      const option = node('option', label);
      option.value = id!;
      this.kind.append(option);
    }
    const rule = node('option', 'Regel (vorhanden)');
    rule.value = 'rule';
    rule.disabled = true;
    this.kind.append(rule);
    this.submit.id = 'key-note-submit';
    this.check.id = 'key-note-status-check';
    this.cancel.id = 'key-note-cancel';
    this.submit.type = 'submit';
    this.check.type = this.cancel.type = 'button';
    this.status.id = 'key-note-capture-status';
    this.status.setAttribute('role', 'status');
    this.form.append(this.heading, this.help);
    for (const [label, field] of [
      ['Art', this.kind],
      ['Name oder Titel', this.title],
      ['Notizen für die Spielleitung', this.gm],
    ] as const) {
      const l = field === this.gm ? this.gmLabel : node('label', label);
      l.htmlFor = field.id;
      this.form.append(l, field);
    }
    this.existing.id = 'key-note-existing';
    this.choiceStatus.id = 'key-note-choices-status';
    this.choiceStatus.setAttribute('role', 'status');
    this.newNote.type = 'button';
    this.newNote.id = 'key-note-new';
    this.gmLabel.htmlFor = this.gm.id;
    this.uses.id = 'key-note-selected-uses';
    this.title.after(this.choiceStatus, this.existing, this.uses, this.newNote);
    this.title.oninput = () => {
      if (this.command || this.pending) return;
      this.chosen = null;
      this.explicitNew = '';
      void this.lookup();
    };
    this.gm.oninput = () => this.controls();
    this.newNote.onclick = () => {
      if (this.pending || this.command) return;
      this.chosen = null;
      this.uses.textContent = '';
      if (this.kind.value === 'rule') this.kind.value = 'note';
      this.explicitNew = normalizedNoteTitle(this.title.value);
      this.status.textContent =
        'Eigenständige neue Notiz gewählt. Vorhandene Notizen bleiben getrennt.';
      this.controls();
      this.title.focus();
    };
    const actions = node('div');
    actions.className = 'actions';
    actions.append(this.cancel, this.check, this.submit);
    this.form.append(this.status, actions);
    this.dialog.append(this.form);
    document.body.append(this.dialog);
    this.form.onsubmit = (event) => {
      event.preventDefault();
      if (!this.composing) void this.save();
    };
    this.check.onclick = () => void this.reconcile();
    this.cancel.onclick = () => this.close();
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.close();
    });
    this.form.addEventListener('compositionstart', () => {
      this.composing = true;
    });
    this.form.addEventListener('compositionend', () => {
      this.composing = false;
    });
  }
  get active() {
    return this.dialog.open;
  }
  reset() {
    this.epoch++;
    this.lookupSequence++;
    this.lookupPending = null;
    this.source = null;
    this.command = null;
    this.pending = false;
    this.applied = false;
    this.composing = false;
    this.conflict = false;
    this.dialog.close();
  }
  private current(epoch: number) {
    return this.epoch === epoch && !!this.source?.current();
  }
  private controls() {
    const locked = this.pending || !!this.command;
    for (const field of [this.title, this.gm]) {
      field.disabled = this.pending;
      field.readOnly = !!this.command || (field === this.title && !!this.chosen);
    }
    this.kind.disabled = locked || !!this.chosen;
    this.cancel.disabled = this.pending;
    this.newNote.disabled = locked;
    this.newNote.hidden =
      !this.chosen && !this.choices.entries.length && !this.choices.notice && !this.choices.more;
    for (const button of this.existing.querySelectorAll('button')) {
      button.disabled = locked;
      button.setAttribute('aria-pressed', String(this.chosen?.id === button.dataset.noteId));
    }
    this.check.hidden = !this.command || this.applied;
    this.check.disabled = this.pending;
    this.submit.disabled = this.pending || (!!this.command && !this.applied);
    this.submit.textContent = this.applied
      ? 'Gespeicherte Notiz öffnen'
      : this.chosen
        ? this.gm.value
          ? 'Verknüpfen und ergänzen'
          : 'Verknüpfen und öffnen'
        : 'Anlegen und verknüpfen';
    this.gmLabel.textContent = this.chosen
      ? 'Ergänzung zur vorhandenen Notiz'
      : 'Notizen für die Spielleitung';
    this.cancel.textContent = this.conflict
      ? 'Eingabe verwerfen'
      : this.applied
        ? 'Zum Raum'
        : 'Abbrechen';
  }
  private async lookup(): Promise<boolean> {
    const query = this.title.value,
      epoch = this.epoch,
      seq = ++this.lookupSequence;
    this.uses.textContent = '';
    this.lookupQuery = query;
    this.choiceStatus.textContent = query.trim() ? 'Vorhandene Notizen werden gesucht…' : '';
    this.existing.replaceChildren();
    this.choices = { entries: [], more: false };
    const request = (async () => {
      try {
        const result = await this.options.api.keyNoteChoices(this.source!.token, query);
        if (!this.current(epoch) || seq !== this.lookupSequence || query !== this.title.value)
          return false;
        if (!result.ok) throw Error(result.error);
        this.choices = result.value;
        this.choiceStatus.textContent =
          result.value.notice ??
          (result.value.entries.length
            ? 'Vorhandene Notiz wählen oder bewusst eine eigenständige neue Notiz anlegen.'
            : 'Keine passende vorhandene Notiz.');
        if (result.value.more)
          this.choiceStatus.textContent += ' Weitere Treffer: Namen genauer eingeben.';
        for (const candidate of result.value.entries) {
          const button = node('button');
          button.type = 'button';
          button.dataset.noteId = candidate.id;
          button.append(
            node('strong', candidate.title),
            node(
              'span',
              {
                note: 'Notiz',
                npc: 'NSC',
                rumor: 'Gerücht',
                quest: 'Quest',
                faction: 'Fraktion',
                rule: 'Regel',
              }[candidate.kind],
            ),
            node('span', candidate.preview || 'Noch kein GM-Text.'),
          );
          button.onclick = () => {
            if (this.pending || this.command || !this.current(epoch) || seq !== this.lookupSequence)
              return;
            this.chosen = candidate;
            this.explicitNew = '';
            this.title.value = candidate.title;
            this.kind.value = candidate.kind;
            this.lookupQuery = candidate.title;
            this.status.textContent =
              'Vorhandene Notiz gewählt. Der bisherige Inhalt bleibt erhalten; deine Eingabe wird unten angehängt.';
            for (const b of this.existing.querySelectorAll('button'))
              b.setAttribute('aria-pressed', String(b === button));
            this.controls();
            this.gm.focus();
            void this.showUses(candidate, epoch);
          };
          this.existing.append(button);
        }
        this.controls();
        return true;
      } catch (error) {
        if (this.current(epoch) && seq === this.lookupSequence) {
          this.choiceStatus.textContent =
            'Vorhandene Notizen konnten nicht geprüft werden: ' + (error as Error).message;
          this.controls();
        }
        return false;
      }
    })();
    this.lookupPending = request;
    return request;
  }
  private async showUses(candidate: KeyNoteChoice, epoch: number) {
    if (!this.options.roomUses || !this.source) return;
    this.uses.textContent = 'Raumverweise werden geladen…';
    try {
      const result = await this.options.roomUses(this.source.token, candidate.id);
      if (!this.current(epoch) || this.chosen !== candidate || this.command) return;
      if (!result.ok) throw Error(result.error);
      const page = result.value;
      this.uses.textContent =
        (page.entries.length
          ? 'Bisher verknüpft: ' +
            page.entries
              .slice(0, 3)
              .map((r) => r.title + ' · Raum ' + r.number)
              .join('; ') +
            (page.next !== null || page.entries.length > 3 ? ' · weitere Räume' : '')
          : 'Bisher keine Raumverweise.') + (page.notice ? ' ' + page.notice : '');
    } catch {
      if (this.current(epoch) && this.chosen === candidate && !this.command)
        this.uses.textContent =
          'Raumverweise gerade nicht verfügbar. Name, Art und Textvorschau bleiben zur Auswahl sichtbar.';
    }
  }
  async open(selection: string) {
    if (this.active) return;
    const epoch = ++this.epoch;
    const source = await this.options.prepare();
    if (epoch !== this.epoch || !source?.current()) return;
    this.source = source;
    this.chosen = null;
    this.explicitNew = '';
    this.lookupQuery = '';
    this.lookupPending = null;
    this.choices = { entries: [], more: false };
    this.command = null;
    this.pending = false;
    this.applied = false;
    this.composing = false;
    this.conflict = false;
    this.title.value = selection.trim().split('\n')[0]?.slice(0, 100) ?? '';
    this.gm.value = selection;
    this.kind.value = 'note';
    this.status.textContent = '';
    this.help.textContent =
      source.title +
      ' · ' +
      (selection
        ? 'Markierten GM-Text übernommen. Der Raumtext bleibt erhalten.'
        : 'Neue Notiz direkt mit diesem Raum verknüpfen.');
    this.controls();
    this.dialog.showModal();
    this.title.focus();
    this.title.select();
    void this.lookup();
  }
  private close() {
    if (this.pending || this.composing) return;
    if (this.command && !this.applied && !this.conflict) {
      this.status.textContent =
        'Speicherstatus noch offen. Erst Status prüfen; die Eingabe bleibt erhalten.';
      return;
    }
    this.reset();
    this.options.focusKey();
  }
  private async reveal(epoch: number) {
    if (!this.command || !this.current(epoch)) return;
    this.applied = true;
    this.controls();
    this.dialog.close();
    try {
      await this.options.opened(this.command, () => this.current(epoch));
      if (this.current(epoch)) {
        this.source = null;
        this.command = null;
      }
    } catch (error) {
      if (this.current(epoch)) {
        this.status.textContent =
          'Notiz und Verknüpfung gespeichert. Anzeige konnte nicht geöffnet werden: ' +
          (error as Error).message;
        this.dialog.showModal();
      }
    }
  }
  private async save() {
    if (this.pending || this.composing || !this.source?.current()) return;
    const epoch = this.epoch;
    if (this.applied) {
      await this.reveal(epoch);
      return;
    }
    if (this.command || !this.title.value.trim() || !this.form.reportValidity()) return;
    if (!this.chosen) {
      const query = this.title.value;
      const ok = await (query === this.lookupQuery && this.lookupPending
        ? this.lookupPending
        : this.lookup());
      if (!this.current(epoch) || this.pending || this.command || query !== this.title.value)
        return;
      if (!ok) {
        this.status.textContent =
          'Vorhandene Notizen erst erfolgreich prüfen. Deine Eingabe bleibt erhalten.';
        return;
      }
      if (
        this.choices.entries.some(
          (n) => normalizedNoteTitle(n.title) === normalizedNoteTitle(query),
        ) &&
        this.explicitNew !== normalizedNoteTitle(query)
      ) {
        this.status.textContent =
          'Diesen Namen gibt es bereits. Vorhandene Notiz wählen oder ausdrücklich eigenständig neu anlegen.';
        return;
      }
    }
    if (!this.current(epoch) || this.pending || this.command) return;
    const source = this.source;
    this.command = {
      commandId: crypto.randomUUID(),
      token: source.token,
      campaignId: source.campaignId,
      room: structuredClone(source.room),
      ...(this.chosen
        ? { reuseRevision: this.chosen.revision }
        : {
            ...(this.explicitNew === normalizedNoteTitle(this.title.value)
              ? { allowSameTitle: true }
              : {}),
          }),
      note: {
        version: 1,
        id: campaignLocalId(this.chosen?.id ?? crypto.randomUUID()),
        revision: 1,
        kind: this.kind.value as KeyNoteCaptureCommand['note']['kind'],
        title: this.title.value,
        readAloud: '',
        gmNotes: this.gm.value,
        relations: [],
        creatureId: null,
        deleted: false,
      },
    };
    this.pending = true;
    this.controls();
    this.status.textContent = 'Notiz und Verknüpfung werden gespeichert…';
    try {
      const result = await this.options.api.captureKeyNote(this.command);
      if (!this.current(epoch)) return;
      if (!result.ok) throw new Error(result.error);
      this.pending = false;
      await this.reveal(epoch);
    } catch (error) {
      if (this.current(epoch)) {
        this.status.textContent =
          (error as Error).message +
          ' Eingabe bleibt erhalten. Status prüfen, bevor du erneut speicherst.';
        this.options.tell(
          'Notizauftrag noch nicht bestätigt. Eingabe bleibt im Notizfenster.',
          true,
        );
      }
    } finally {
      if (this.current(epoch)) {
        this.pending = false;
        this.controls();
      }
    }
  }
  private async reconcile() {
    if (this.pending || !this.command || !this.source?.current()) return;
    const epoch = this.epoch;
    this.pending = true;
    this.controls();
    try {
      const result = await this.options.api.keyNoteCaptureStatus(this.command, this.source.token);
      if (!this.current(epoch)) return;
      if (!result.ok) throw new Error(result.error);
      if (result.value.outcome === 'applied') {
        this.pending = false;
        this.applied = true;
        this.status.textContent = result.value.targetChanged
          ? 'Angelegt; der aktuelle Stand wurde inzwischen verändert. Die gespeicherte Notiz kann geöffnet werden.'
          : 'Notiz und Verknüpfung sind gespeichert.';
      } else if (result.value.outcome === 'not-applied') {
        this.command = null;
        this.chosen = null;
        this.status.textContent =
          'Nicht gespeichert. Auswahl und Eingabe prüfen, dann ausdrücklich erneut speichern.';
        void this.lookup();
      } else {
        this.conflict = true;
        this.status.textContent =
          'Raum oder Notizziel hat sich geändert. Text zum Sichern markieren und kopieren; danach die Eingabe ausdrücklich verwerfen. Kein automatisches Anlegen.';
      }
    } catch (error) {
      if (this.current(epoch))
        this.status.textContent = 'Status konnte nicht geprüft werden: ' + (error as Error).message;
    } finally {
      if (this.current(epoch)) {
        this.pending = false;
        this.controls();
      }
    }
  }
}
