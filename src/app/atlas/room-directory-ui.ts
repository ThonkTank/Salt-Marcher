import type { RoomDirectoryPage, RoomSummary } from '../contracts';
/** A list page owns no author content. Cursor invalidation is an explicit retry. */
export class RoomDirectoryView {
  private request = 0;
  private token: string | null = null;
  private text = '';
  private rows: RoomSummary[] = [];
  private next: RoomDirectoryPage['next'] = null;
  private selected: string | null = null;
  private summary: { total: number; unreadable: number } | null = null;
  private problems: { number: string; message: string }[] = [];
  constructor(
    private readonly root: HTMLElement,
    private readonly open: (id: string) => void,
    private readonly api = window.campaign,
  ) {}
  context(
    token: string | null,
    text: string,
    selected: string | null,
    problems: { number: string; message: string }[] = [],
    refresh = false,
  ) {
    this.selected = selected;
    this.problems = problems;
    if (token === this.token && text === this.text && this.rows.length && !refresh) {
      this.draw();
      return;
    }
    const previous = this.token;
    this.token = token;
    this.text = text;
    this.rows = [];
    this.next = null;
    this.summary = null;
    this.request++;
    if (previous && previous !== token) void this.api.cancelRoomDirectory(previous).catch(() => {});
    if (token) void this.load(false);
    else this.root.replaceChildren();
  }
  private async load(more: boolean) {
    const token = this.token,
      text = this.text,
      n = ++this.request;
    if (!token) return;
    const cursor = more ? this.next : undefined;
    if (!more) {
      this.rows = [];
      this.next = null;
      this.summary = null;
    }
    this.draw();
    const hint = this.root.ownerDocument.createElement('p');
    hint.textContent = 'Räume werden gesucht …';
    hint.setAttribute('role', 'status');
    this.root.append(hint);
    try {
      const result = await this.api.roomDirectory(token, {
        text,
        limit: 40,
        ...(cursor ? { cursor } : {}),
      });
      if (n !== this.request || token !== this.token || text !== this.text) return;
      if (!result.ok) throw new Error(result.error);
      if (result.value.token !== token)
        throw new Error('Raumsuche gehört zu einer früheren Kampagne.');
      this.rows = more ? [...this.rows, ...result.value.items] : result.value.items;
      this.next = result.value.next;
      this.summary = { total: result.value.total, unreadable: result.value.unreadable };
      this.draw();
    } catch (e) {
      if (n !== this.request || token !== this.token) return;
      this.root.replaceChildren();
      const message = this.root.ownerDocument.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = (e as Error).message;
      const retry = this.root.ownerDocument.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Suche aktualisieren';
      retry.onclick = () => void this.load(false);
      this.root.append(message, retry);
    }
  }
  private draw() {
    const doc = this.root.ownerDocument;
    this.root.replaceChildren();
    for (const r of this.rows) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = `${r.number}. ${r.name}`;
      button.setAttribute('aria-pressed', String(r.id === this.selected));
      button.onclick = () => this.open(r.id);
      this.root.append(button);
    }
    if (this.problems.length) {
      const warning = doc.createElement('p');
      warning.setAttribute('role', 'alert');
      warning.textContent =
        `${this.problems.length} Räume ohne verfügbare Kartengeometrie. ` +
        this.problems
          .slice(0, 5)
          .map((p) => `Raum ${p.number}: ${p.message}`)
          .join(' · ') +
        (this.problems.length > 5
          ? ' Weitere betroffene Räume lassen sich über das Verzeichnis einzeln prüfen.'
          : '');
      this.root.append(warning);
    }
    if (this.summary) {
      const status = doc.createElement('p');
      status.textContent =
        `${this.rows.length} von ${this.summary.total} Räumen angezeigt` +
        (this.summary.unreadable
          ? ` · ${this.summary.unreadable} Raumtexte konnten nicht durchsucht werden.`
          : '');
      status.setAttribute('role', 'status');
      this.root.append(status);
    }
    if (this.next) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.id = 'rooms-more';
      button.textContent = 'Weitere Räume';
      button.onclick = () => void this.load(true);
      this.root.append(button);
    }
  }
}
