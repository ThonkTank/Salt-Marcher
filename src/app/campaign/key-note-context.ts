import { mountNoteEditor } from './note-editor-mount';
interface NoteContextOptions {
  open: (id: string, current: () => boolean) => Promise<boolean>;
  flush: () => Promise<boolean>;
  beforeClose: () => Promise<boolean>;
  closed: () => Promise<void>;
  focusKey: () => void;
  tell: (text: string, error?: boolean) => void;
}
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
};

// The same note editor, draft, save controls and conflict handling have one
// home in Preparation. Temporarily show those controls beside the room key;
// never create a second note draft or an alternative persistence path.
export class KeyNoteContext {
  private panel = node('section');
  private content = node('div');
  private status = node('p');
  private heading = node('h3');
  private closeButton = node('button', 'Zum Raumtext');
  private restoreEditor: (() => void) | null = null;
  private epoch = 0;
  private pending: Promise<void> | null = null;
  private valid: () => boolean = () => false;
  constructor(
    private dialog: HTMLDialogElement,
    private options: NoteContextOptions,
  ) {
    this.panel.id = 'key-reference-panel';
    this.panel.hidden = true;
    this.panel.setAttribute('aria-labelledby', 'key-reference-heading');
    this.heading.id = 'key-reference-heading';
    this.closeButton.id = 'key-reference-return';
    this.closeButton.type = 'button';
    this.closeButton.onclick = () => {
      void this.close().catch((error) => this.options.tell(error.message, true));
    };
    const header = node('div');
    header.className = 'toolbar key-reference-head';
    header.append(this.heading, this.closeButton);
    this.status.id = 'key-reference-status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.panel.append(header, this.status, this.content);
    const editor = dialog.querySelector<HTMLElement>('.key-layout > section')!;
    editor.classList.add('key-main-editor');
    editor.before(this.panel);
    dialog.addEventListener('close', () => this.reset());
  }
  get active() {
    return !this.panel.hidden;
  }
  get ownsEditor() {
    const editor = document.getElementById('note-editor');
    return (
      this.active &&
      !this.content.hidden &&
      this.valid() &&
      !!editor &&
      this.content.contains(editor)
    );
  }
  setStatus(text: string, error = false) {
    if (!this.active) return;
    this.status.textContent = text;
    this.status.dataset.error = String(error);
  }
  reset() {
    this.epoch++;
    this.pending = null;
    this.valid = () => false;
    this.restoreEditor?.();
    this.restoreEditor = null;
    this.panel.hidden = true;
    this.dialog.classList.remove('has-key-reference');
    this.closeButton.disabled = false;
  }
  async open(id: string, label: string, current: () => boolean) {
    this.reset();
    const epoch = this.epoch,
      valid = () => this.epoch === epoch && current() && this.dialog.open;
    this.valid = valid;
    this.heading.textContent = label;
    this.panel.hidden = false;
    this.dialog.classList.add('has-key-reference');
    this.content.hidden = true;
    this.setStatus('Notiz wird gelesen…');
    this.restoreEditor = mountNoteEditor(this.content, () => this.reset());
    const task = (async () => {
      try {
        const opened = await this.options.open(id, valid);
        if (!valid()) return;
        if (!opened) {
          this.setStatus(
            'Notiz kann gerade nicht geöffnet werden. Die Verknüpfung bleibt erhalten.',
            true,
          );
          return;
        }
        this.content.hidden = false;
        if (this.status.dataset.error !== 'true')
          this.setStatus('Änderungen werden automatisch gespeichert.');
        document.getElementById('note-editor')!.focus({ preventScroll: true });
        this.panel.scrollIntoView({ block: 'nearest' });
      } catch (error) {
        if (valid()) {
          this.setStatus((error as Error).message, true);
          this.options.tell((error as Error).message, true);
        }
      } finally {
        if (this.epoch === epoch) this.pending = null;
      }
    })();
    this.pending = task;
    await task;
  }
  async flush() {
    const epoch = this.epoch;
    await this.pending;
    if (this.epoch !== epoch) return false;
    if (!this.active) return true;
    const saved = await this.options.flush();
    return this.epoch === epoch && saved;
  }
  private async close() {
    const epoch = this.epoch;
    if (!this.active || this.closeButton.disabled) return;
    this.closeButton.disabled = true;
    try {
      if (!(await this.options.beforeClose()) || this.epoch !== epoch || !this.valid()) return;
      this.reset();
      const closedEpoch = this.epoch;
      await this.options.closed();
      if (this.epoch === closedEpoch && this.dialog.open) this.options.focusKey();
    } finally {
      if (this.epoch === epoch) this.closeButton.disabled = false;
    }
  }
}
