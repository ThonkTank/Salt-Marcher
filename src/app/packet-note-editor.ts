import { mountNoteEditor } from './note-editor-mount';
import { noteSearchTerms } from './note-search-terms';
import { scrollTextareaToOffset } from './textarea-position';

export interface PreparationPacketEditor {
  open: (id: string, current: () => boolean) => Promise<boolean>;
  finish: (current: () => boolean) => Promise<boolean>;
}
interface EditSession {
  current: () => boolean;
  ownerCurrent: () => boolean;
  editor: PreparationPacketEditor;
  refresh: () => Promise<boolean>;
  hint?: string;
}

/** Borrows the one Preparation editor; the packet remains its reading context. */
export class PacketNoteEditor {
  readonly host = document.createElement('section');
  private content = document.createElement('div');
  private status = document.createElement('p');
  private back = document.createElement('button');
  private restore: (() => void) | null = null;
  private session: EditSession | null = null;
  private epoch = 0;
  private working = false;
  private scroll = 0;
  private outerScroll = 0;
  get active() {
    return this.session !== null;
  }
  get busy() {
    return this.working;
  }

  constructor(
    private reading: HTMLElement,
    private scrollHost: HTMLElement,
    private changed: () => void,
  ) {
    this.host.id = 'packet-note-editor';
    this.host.hidden = true;
    const head = document.createElement('div');
    head.className = 'packet-note-edit-head';
    this.back.id = 'packet-note-return';
    this.back.type = 'button';
    this.back.textContent = 'Zur Spielabendmappe';
    this.status.id = 'packet-note-status';
    this.status.setAttribute('role', 'status');
    this.content.id = 'packet-note-content';
    head.append(this.back, this.status);
    this.host.append(head, this.content);
    this.back.onclick = () => void this.leave();
  }
  private current(epoch: number) {
    return this.epoch === epoch && !!this.session?.current();
  }
  private controls() {
    this.back.disabled = this.working;
    this.changed();
  }
  feedback(message: string, error = false) {
    if (this.session?.current() && !this.host.hidden) {
      this.status.textContent = message;
      this.status.dataset.error = String(error);
    }
  }
  reset() {
    this.epoch++;
    this.session = null;
    this.working = false;
    const restore = this.restore;
    this.restore = null;
    restore?.();
    this.host.hidden = true;
    this.reading.hidden = false;
    this.controls();
  }
  async open(id: string, session: EditSession) {
    if (this.session || this.working || !session.current()) return;
    const epoch = ++this.epoch;
    this.session = session;
    this.scroll = this.scrollHost.scrollTop;
    this.outerScroll = this.reading.closest('dialog')?.scrollTop ?? 0;
    this.working = true;
    this.host.hidden = false;
    this.reading.hidden = true;
    this.content.hidden = true;
    this.status.textContent = 'Originalnotiz wird geöffnet…';
    this.status.dataset.error = 'false';
    this.controls();
    try {
      this.restore = mountNoteEditor(this.content, () => this.reset());
      if (!(await session.editor.open(id, () => this.current(epoch))))
        throw Error(
          'Originalnotiz kann gerade nicht geöffnet werden. Zur Mappe zurückkehren oder Speicherstatus prüfen.',
        );
      if (!this.current(epoch)) return;
      this.content.hidden = false;
      this.status.textContent =
        'Änderungen gelten auch für andere Verwendungen dieser Originalnotiz.';
      const terms = noteSearchTerms(session.hint ?? '');
      let focused = false;
      for (const id of ['note-gm', 'note-read-aloud']) {
        const area = document.getElementById(id) as HTMLTextAreaElement;
        if (area.disabled) continue;
        for (const term of terms) {
          const at = area.value.toLocaleLowerCase().indexOf(term.toLocaleLowerCase());
          if (at < 0) continue;
          area.setSelectionRange(at, at + term.length);
          area.focus({ preventScroll: true });
          area.scrollIntoView({ block: 'center' });
          scrollTextareaToOffset(area, at, {
            viewport: this.host,
            header: this.host.querySelector<HTMLElement>('.packet-note-edit-head')!,
          });
          focused = true;
          break;
        }
        if (focused) break;
      }
      if (!focused) {
        const title = document.getElementById('note-title') as HTMLInputElement;
        if (!title.disabled) title.focus({ preventScroll: true });
        else this.back.focus();
        this.host.scrollTop = 0;
      }
    } catch (error) {
      if (this.current(epoch)) this.feedback((error as Error).message, true);
    } finally {
      if (this.epoch === epoch) {
        this.working = false;
        this.controls();
      }
    }
  }
  async leave(refresh = true): Promise<boolean> {
    const session = this.session,
      epoch = this.epoch;
    if (!session || this.working || !this.current(epoch)) return false;
    this.working = true;
    this.controls();
    try {
      if (!(await session.editor.finish(() => this.current(epoch))))
        throw Error(
          'Eingabe noch nicht übernommen. Original bleibt geöffnet; Speicherstatus prüfen.',
        );
      if (!this.current(epoch)) return false;
      const restore = this.restore;
      this.restore = null;
      restore?.();
      this.host.hidden = true;
      this.reading.hidden = false;
      if (refresh && (await session.refresh()) && this.epoch === epoch && session.ownerCurrent()) {
        this.scrollHost.scrollTop = this.scroll;
        const dialog = this.reading.closest('dialog');
        if (dialog) dialog.scrollTop = this.outerScroll;
      }
      if (this.epoch !== epoch || !session.ownerCurrent()) return false;
      this.session = null;
      return true;
    } catch (error) {
      if (this.current(epoch)) this.feedback((error as Error).message, true);
      return false;
    } finally {
      if (this.epoch === epoch) {
        this.working = false;
        this.controls();
      }
    }
  }
}
