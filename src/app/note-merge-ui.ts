import { checkedNoteMerge, type NoteMergePreview } from './note-merge-contracts';
import type {
  NoteRow,
  Preparation,
  PreparationAPI,
  PreparationCommand,
} from './preparation-contracts';
import { editTextareaText } from './key-reading-model';

export interface NoteMergeOwner {
  token: string;
  campaignId: string;
  sourceId: string | null;
  notes: NoteRow[];
  current: () => boolean;
}
interface Draft {
  version: 1;
  sourceId: string;
  targetId: string;
  readAloud: string;
  gmNotes: string;
  edited: boolean;
  command: PreparationCommand | null;
}
interface Options {
  api: Pick<PreparationAPI, 'noteMergePreview' | 'changePreparation' | 'reconcilePreparation'>;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  prepare: () => Promise<NoteMergeOwner | null>;
  done: (id: string, data: Preparation, owner: NoteMergeOwner) => Promise<void>;
  tell: (text: string, error?: boolean) => void;
}
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
};
const unwrap = <T>(r: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw Error(r.error);
  return r.value;
};
const joined = (a: string, b: string, title: string) =>
  !b ? a : !a ? b : a + (a.includes('\r\n') ? '\r\n\r\n' : '\n\n') + 'Aus „' + title + '“:\n' + b;

/** One explicit merge, with a durable local draft and manual receipt reconciliation. */
export class NoteMergeUI {
  private epoch = 0;
  private campaignId = '';
  private owner: NoteMergeOwner | null = null;
  private draft: Draft | null = null;
  private preview: NoteMergePreview | null = null;
  private busy = false;
  private persisted = true;
  private loadError = false;
  private composing = false;
  private recovery = node('section');
  private raw = node('textarea');
  readonly preserve = node('button', 'Originalvermerk sichern und neue Prüfung ermöglichen');
  readonly dialog = node('dialog');
  readonly resume = node('button', 'Gesicherte Zusammenführung öffnen…');
  private heading = node('h2', 'NSC-Notizen zusammenführen');
  private source = node('p');
  readonly target = node('select');
  readonly publicText = node('textarea');
  readonly privateText = node('textarea');
  private originals = node('div');
  private uses = node('ul');
  private textLimit = node('p');
  readonly status = node('p');
  readonly reviewed = node('input');
  readonly confirm = node('button', 'Texte und Verweise zusammenführen');
  readonly refresh = node('button', 'Originale und Verweise erneut prüfen');
  readonly check = node('button', 'Status der Zusammenführung prüfen');
  readonly close = node('button', 'Schließen · Entwurf behalten');
  readonly discard = node('button', 'Entwurf verwerfen');
  constructor(
    button: HTMLButtonElement,
    host: HTMLElement,
    private options: Options,
  ) {
    this.dialog.id = 'note-merge-dialog';
    this.dialog.className = 'note-merge-dialog';
    this.resume.id = 'note-merge-resume';
    this.resume.type = 'button';
    this.resume.hidden = true;
    host.prepend(this.resume);
    this.target.id = 'note-merge-target';
    this.publicText.id = 'note-merge-read-aloud';
    this.privateText.id = 'note-merge-gm';
    this.confirm.id = 'note-merge-confirm';
    this.check.id = 'note-merge-check';
    this.reviewed.id = 'note-merge-reviewed';
    this.publicText.rows = 4;
    this.privateText.rows = 8;
    this.publicText.maxLength = this.privateText.maxLength = 2_000_000;
    this.status.setAttribute('role', 'status');
    this.textLimit.setAttribute('role', 'status');
    this.reviewed.type = 'checkbox';
    const label = (text: string, field: HTMLElement) => {
      const l = node('label', text);
      l.append(field);
      return l;
    };
    const details = node('details');
    details.append(node('summary', 'Beide Originaltexte lesen'), this.originals);
    const help = node(
      'p',
      'Raum-/Keyverweise und Besuchsquellen sowie Textverweise in Notizen und Orten und freie Beziehungen wechseln zum verbleibenden Original. Die Quellnotiz bleibt unverändert im Papierkorb lesbar. Spielwerte und Familien werden nicht still zusammengelegt.',
    );
    const actions = node('div');
    actions.className = 'actions';
    for (const b of [this.refresh, this.confirm, this.check, this.close, this.discard]) {
      b.type = 'button';
      actions.append(b);
    }
    this.raw.readOnly = true;
    this.raw.rows = 8;
    this.raw.id = 'note-merge-recovery-text';
    this.preserve.type = 'button';
    this.recovery.append(
      node('h3', 'Unlesbarer Originalvermerk'),
      node(
        'p',
        'Dieser lokale Entwurf wird nicht gesendet. Sichere den vollständigen Vermerk; prüfe anschließend die gespeicherten Originale, bevor du neu zusammenführst.',
      ),
      this.raw,
      this.preserve,
    );
    this.recovery.hidden = true;
    this.dialog.append(
      this.heading,
      this.recovery,
      this.source,
      label('Verbleibendes Original', this.target),
      details,
      help,
      this.uses,
      label('Zusammengeführter Vorlesetext', this.publicText),
      label('Zusammengeführte GM-Notizen', this.privateText),
      label('Texte und aufgeführte Verweise geprüft', this.reviewed),
      this.textLimit,
      this.status,
      actions,
    );
    document.body.append(this.dialog);
    button.onclick = this.resume.onclick = () => {
      void this.open();
    };
    this.target.onchange = () => {
      if (!this.draft) return;
      this.draft.targetId = this.target.value;
      this.preview = null;
      this.reviewed.checked = false;
      void this.refreshPreview();
    };
    for (const [area, field] of [
      [this.publicText, 'readAloud'],
      [this.privateText, 'gmNotes'],
    ] as const) {
      const input = () => {
        if (!this.draft || this.draft.command) return;
        this.draft[field] = editTextareaText(this.draft[field], area.value);
        this.draft.edited = true;
        this.reviewed.checked = false;
        this.persist();
        this.sync();
      };
      area.oninput = input;
      area.addEventListener('compositionstart', () => {
        this.composing = true;
        this.reviewed.checked = false;
        this.sync();
      });
      area.addEventListener('compositionend', () => {
        this.composing = false;
        input();
      });
    }
    this.preserve.onclick = () => {
      if (!this.loadError) return;
      try {
        const raw = this.options.storage.getItem(this.key());
        if (raw !== null)
          this.options.storage.setItem(this.key() + ':recovery:' + crypto.randomUUID(), raw);
        this.options.storage.removeItem(this.key());
        this.loadError = false;
        this.recovery.hidden = true;
        this.resume.hidden = true;
        this.dialog.close();
        this.sync();
        this.options.tell(
          'Originalvermerk lokal gesichert. Prüfe die gespeicherten Notizen und Verweise, bevor du eine neue Zusammenführung beginnst.',
        );
      } catch (e) {
        this.feedback(e);
      }
    };
    this.reviewed.onchange = () => this.sync();
    this.confirm.onclick = () => {
      void this.submit();
    };
    this.check.onclick = () => {
      void this.checkPending();
    };
    this.refresh.onclick = () => {
      void this.refreshPreview();
    };
    this.close.onclick = () => {
      if (!this.busy && !this.composing && this.persist()) this.dialog.close();
    };
    this.discard.onclick = () => {
      if (this.busy || this.composing || this.loadError || this.draft?.command) return;
      try {
        this.options.storage.removeItem(this.key());
        this.draft = null;
        this.persisted = true;
        this.resume.hidden = true;
        this.dialog.close();
      } catch (e) {
        this.feedback(e);
      }
    };
    this.dialog.addEventListener('cancel', (event) => {
      if (this.busy || this.composing || !this.persist()) event.preventDefault();
    });
    this.sync();
  }
  private key() {
    return 'note-merge:' + this.campaignId;
  }
  activate(campaignId: string) {
    this.epoch++;
    this.owner = null;
    this.preview = null;
    this.busy = false;
    this.draft = null;
    this.campaignId = campaignId;
    this.loadError = false;
    this.persisted = true;
    this.composing = false;
    this.recovery.hidden = true;
    this.raw.value = '';
    if (this.dialog.open) this.dialog.close();
    if (campaignId)
      try {
        const raw = this.options.storage.getItem(this.key());
        if (raw) {
          const d = JSON.parse(raw) as Draft;
          if (
            d.version !== 1 ||
            typeof d.sourceId !== 'string' ||
            !d.sourceId ||
            typeof d.targetId !== 'string' ||
            [d.readAloud, d.gmNotes].some((s) => typeof s !== 'string' || s.length > 8_000_000) ||
            typeof d.edited !== 'boolean' ||
            !Object.hasOwn(d, 'command')
          )
            throw Error(
              'Gesicherte Zusammenführung ist nicht lesbar. Originalvermerk bleibt erhalten.',
            );
          if (d.command !== null) {
            if (
              !d.command ||
              typeof d.command !== 'object' ||
              typeof d.command.commandId !== 'string' ||
              !d.command.commandId ||
              typeof d.command.token !== 'string' ||
              !d.command.token ||
              d.command.campaignId !== campaignId ||
              d.command.change.kind !== 'note-merge' ||
              d.command.change.id !== d.sourceId ||
              d.command.change.targetId !== d.targetId
            )
              throw Error('Gesicherter Auftrag gehört nicht zu dieser Zusammenführung.');
            checkedNoteMerge(d.command.change);
          }
          this.draft = d;
        }
      } catch (e) {
        this.loadError = true;
        try {
          this.raw.value = this.options.storage.getItem(this.key()) ?? '';
        } catch {}
        this.options.tell((e as Error).message, true);
      }
    this.resume.hidden = !this.draft && !this.loadError;
    this.sync();
  }
  hasPending() {
    return this.loadError || !!this.draft?.command || (!this.persisted && !!this.draft);
  }
  private valid(epoch = this.epoch) {
    return this.epoch === epoch && !!this.owner?.current();
  }
  private feedback(error: unknown) {
    this.status.textContent = (error as Error).message;
    this.options.tell(this.status.textContent, true);
  }
  private persist() {
    if (!this.draft) return true;
    try {
      this.options.storage.setItem(this.key(), JSON.stringify(this.draft));
      this.persisted = true;
      this.resume.hidden = false;
      return true;
    } catch (e) {
      this.persisted = false;
      this.feedback(e);
      return false;
    }
  }
  private sync() {
    const pending = !!this.draft?.command,
      tooLong =
        !!this.draft &&
        [this.draft.readAloud, this.draft.gmNotes].some((s) => s.length > 2_000_000);
    this.textLimit.textContent = tooLong
      ? 'Ein zusammengeführtes Textfeld überschreitet 2.000.000 Zeichen. Kürze den Entwurf vor der Bestätigung; beide Originale bleiben erhalten.'
      : '';
    this.confirm.disabled =
      this.busy ||
      this.composing ||
      this.loadError ||
      !this.persisted ||
      tooLong ||
      pending ||
      !this.preview ||
      !!this.preview.blockers.length ||
      !this.reviewed.checked;
    this.target.disabled = this.busy || this.composing || pending || this.loadError;
    this.publicText.disabled = this.privateText.disabled = this.busy || pending || this.loadError;
    this.refresh.disabled =
      this.busy || this.composing || this.loadError || pending || !this.target.value;
    this.check.hidden = !pending;
    this.check.disabled = this.busy;
    this.discard.disabled = this.busy || this.composing || pending || this.loadError;
    this.close.disabled = this.busy || this.composing;
    this.reviewed.disabled = this.busy || this.composing || pending || this.loadError;
  }
  async open() {
    if (this.busy) return;
    if (this.loadError) {
      this.recovery.hidden = false;
      if (!this.dialog.open) this.dialog.showModal();
      this.status.textContent =
        'Der unlesbare Originalvermerk bleibt gesperrt, bis du ihn ausdrücklich gesichert hast.';
      this.sync();
      return;
    }
    const epoch = this.epoch;
    try {
      const owner = await this.options.prepare();
      if (epoch !== this.epoch || !owner?.current() || owner.campaignId !== this.campaignId) return;
      this.owner = owner;
      if (!this.draft) {
        if (!owner.sourceId) return;
        this.draft = {
          version: 1,
          sourceId: owner.sourceId,
          targetId: '',
          readAloud: '',
          gmNotes: '',
          edited: false,
          command: null,
        };
      }
      const source = owner.notes.find((n) => n.note.id === this.draft!.sourceId)?.note;
      this.source.textContent = 'Quelle: ' + (source?.title ?? this.draft.sourceId);
      this.target.replaceChildren();
      const blank = node('option', 'Original wählen…');
      blank.value = '';
      this.target.append(blank);
      for (const n of owner.notes
        .filter((r) => !r.trashed && r.note.kind === 'npc' && r.note.id !== this.draft!.sourceId)
        .map((r) => r.note)) {
        const option = node(
          'option',
          n.title +
            (owner.notes.filter((other) => other.note.title === n.title).length > 1
              ? ' · ' + n.id
              : ''),
        );
        option.value = n.id;
        this.target.append(option);
      }
      this.target.value = this.draft.targetId;
      this.publicText.value = this.draft.readAloud;
      this.privateText.value = this.draft.gmNotes;
      this.reviewed.checked = false;
      if (!this.dialog.open) this.dialog.showModal();
      this.persist();
      this.sync();
      if (this.draft.command) {
        this.status.textContent =
          'Die letzte Antwort ist noch ungeklärt. Status prüfen; die Zusammenführung wird nicht erneut gesendet.';
        return;
      }
      if (this.draft.targetId) await this.refreshPreview();
    } catch (e) {
      if (epoch === this.epoch) this.feedback(e);
    } finally {
      this.sync();
    }
  }
  async refreshPreview() {
    if (
      this.busy ||
      this.loadError ||
      this.draft?.command ||
      !this.owner ||
      !this.draft ||
      !this.draft.targetId
    )
      return;
    const epoch = this.epoch;
    this.busy = true;
    this.reviewed.checked = false;
    this.sync();
    try {
      const preview = unwrap(
        await this.options.api.noteMergePreview(
          this.owner.token,
          this.draft.sourceId,
          this.draft.targetId,
        ),
      );
      if (!this.valid(epoch)) return;
      this.preview = preview;
      if (!this.draft.edited) {
        this.draft.readAloud = joined(
          preview.target.readAloud,
          preview.source.readAloud,
          preview.source.title,
        );
        this.draft.gmNotes = joined(
          preview.target.gmNotes,
          preview.source.gmNotes,
          preview.source.title,
        );
      }
      this.publicText.value = this.draft.readAloud;
      this.privateText.value = this.draft.gmNotes;
      this.originals.replaceChildren();
      for (const n of [preview.source, preview.target]) {
        const pre = node('pre', n.readAloud + '\n\n' + n.gmNotes);
        this.originals.append(node('h3', n.title), pre);
      }
      this.uses.replaceChildren();
      for (const use of preview.uses)
        this.uses.append(
          node(
            'li',
            { key: 'Raum-/Keyverweis', visit: 'Besuchsquelle', note: 'Notiz', location: 'Ort' }[
              use.kind
            ] +
              ': ' +
              use.title,
          ),
        );
      if (!preview.uses.length)
        this.uses.append(node('li', 'Keine eingehenden Vorbereitungsverweise.'));
      this.status.textContent = preview.blockers.length
        ? preview.blockers.join(' ')
        : 'Originale und ' +
          preview.uses.length +
          ' Verweisstellen geladen. Prüfe den zusammengeführten Text; Widersprüche bleiben deine redaktionelle Entscheidung.';
      this.persist();
    } catch (e) {
      if (this.valid(epoch)) {
        this.preview = null;
        this.feedback(e);
      }
    } finally {
      if (epoch === this.epoch) {
        this.busy = false;
        this.sync();
      }
    }
  }
  async submit() {
    if (this.confirm.disabled || !this.owner || !this.draft || !this.preview) return;
    const epoch = this.epoch,
      p = this.preview;
    const command: PreparationCommand = {
      commandId: crypto.randomUUID(),
      token: this.owner.token,
      campaignId: this.owner.campaignId,
      change: {
        kind: 'note-merge',
        id: p.source.id,
        expectedRevision: p.source.revision,
        targetId: p.target.id,
        expectedTargetRevision: p.target.revision,
        basis: p.basis,
        readAloud: this.draft.readAloud,
        gmNotes: this.draft.gmNotes,
      },
    };
    try {
      if (command.change.kind === 'note-merge') checkedNoteMerge(command.change);
    } catch (e) {
      this.feedback(e);
      return;
    }
    this.draft.command = command;
    if (!this.persist()) {
      this.draft.command = null;
      this.sync();
      return;
    }
    this.busy = true;
    this.sync();
    try {
      const data = unwrap(await this.options.api.changePreparation(command));
      if (this.valid(epoch)) await this.finish(p.target.id, data);
    } catch (e) {
      if (this.valid(epoch))
        this.feedback(
          Error((e as Error).message + ' Status prüfen; kein automatischer Neuversuch.'),
        );
    } finally {
      if (epoch === this.epoch) {
        this.busy = false;
        this.sync();
      }
    }
  }
  async checkPending() {
    if (this.busy || !this.owner || !this.draft?.command) return;
    const epoch = this.epoch,
      command = this.draft.command;
    this.busy = true;
    this.sync();
    try {
      const result = unwrap(await this.options.api.reconcilePreparation(command, this.owner.token));
      if (!this.valid(epoch)) return;
      if (result.outcome === 'applied') {
        await this.finish((command.change as { targetId: string }).targetId, result.data);
        return;
      }
      this.draft.command = null;
      this.preview = null;
      this.reviewed.checked = false;
      this.persist();
      this.status.textContent =
        result.outcome === 'conflict'
          ? 'Nicht zusammengeführt: Originale oder Verweise wurden geändert. Eingaben bleiben erhalten; Originale erneut prüfen.'
          : 'Nicht zusammengeführt. Eingaben bleiben erhalten. Originale erneut prüfen; eine erneute Bestätigung ist ein neuer Auftrag.';
    } catch (e) {
      if (this.valid(epoch)) this.feedback(e);
    } finally {
      if (epoch === this.epoch) {
        this.busy = false;
        this.sync();
      }
    }
  }
  private async finish(id: string, data: Preparation) {
    this.options.storage.removeItem(this.key());
    this.draft = null;
    this.preview = null;
    this.resume.hidden = true;
    this.dialog.close();
    this.busy = false;
    try {
      await this.options.done(id, data, this.owner!);
      this.options.tell(
        'NSC-Notizen zusammengeführt. Das verbleibende Original ist geöffnet; die Quelle liegt im Papierkorb.',
      );
    } catch (e) {
      this.options.tell(
        'Die Zusammenführung ist bestätigt. Das Original erneut öffnen: ' + (e as Error).message,
        true,
      );
    }
  }
}
