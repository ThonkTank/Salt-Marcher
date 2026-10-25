import type { NoteRoomUsesPage } from './preparation-contracts';
import type { Result } from './contracts';

export class NoteRoomUses {
  private generation = 0;
  private navigationGeneration = 0;
  private source: string | null = null;
  constructor(
    private host: HTMLElement,
    private read: (token: string, id: string, offset: number) => Promise<Result<NoteRoomUsesPage>>,
    private open: (
      id: string,
      current: () => boolean,
      restore: (keepViewport?: boolean) => void,
    ) => Promise<boolean>,
  ) {}
  private clear() {
    this.generation++;
    this.host.replaceChildren();
    this.host.hidden = true;
  }
  reset() {
    this.navigationGeneration++;
    this.source = null;
    this.clear();
  }
  /** Repainting the same source must not revoke a room opened from that source. */
  prepare(token: string | null, id: string | null) {
    const source = token && id ? JSON.stringify([token, id]) : null;
    if (source !== this.source) {
      this.navigationGeneration++;
      this.source = source;
    }
    this.clear();
  }
  show(
    token: string,
    id: string,
    sourceCurrent: () => boolean,
    focusId?: string,
    restoreThrough = 0,
    keepViewport = false,
  ) {
    this.prepare(token, id);
    const generation = this.generation,
      navigation = this.navigationGeneration,
      current = () => generation === this.generation && sourceCurrent(),
      navigationCurrent = () => navigation === this.navigationGeneration && sourceCurrent();
    this.host.hidden = false;
    const heading = document.createElement('h3');
    heading.textContent = 'Verwendet in Räumen';
    heading.tabIndex = -1;
    const help = document.createElement('p');
    help.className = 'muted';
    help.textContent =
      'Gespeicherte Verknüpfungen im Raum-Key. Raum öffnen, bearbeiten und hierher zurückkehren.';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const list = document.createElement('div');
    list.id = 'note-room-uses-list';
    list.className = 'selection-list';
    const more = document.createElement('button');
    more.type = 'button';
    more.hidden = true;
    this.host.append(heading, help, status, list, more);
    if (focusId && !keepViewport) heading.focus({ preventScroll: true });
    let pending = false,
      maxLoadedOffset = 0;
    const load = async (offset: number) => {
      if (pending || !current()) return;
      pending = true;
      more.disabled = true;
      status.textContent = 'Raumverweise werden geladen…';
      let restoreNext: number | null = null;
      try {
        const result = await this.read(token, id, offset);
        if (!current()) return;
        if (!result.ok) throw new Error(result.error);
        const page = result.value;
        status.textContent =
          page.notice ??
          (offset === 0 && !page.entries.length
            ? 'Keine gespeicherten Raum-Key-Verknüpfungen.'
            : '');
        for (const entry of page.entries) {
          const button = document.createElement('button');
          button.type = 'button';
          button.disabled = entry.unavailable;
          const title = document.createElement('strong');
          title.textContent = entry.title + (entry.number ? ' · Raum ' + entry.number : '');
          const place = document.createElement('span');
          place.className = 'muted';
          place.textContent = entry.place;
          const excerpt = document.createElement('span');
          excerpt.textContent = entry.excerpt || 'Verknüpfung im Raum-Key';
          button.append(title, place, excerpt);
          button.onclick = () => {
            if (entry.unavailable || !current() || !button.isConnected || pending) return;
            pending = true;
            button.disabled = true;
            void this.open(entry.id, navigationCurrent, (keepViewport = false) => {
              if (navigationCurrent())
                this.show(token, id, sourceCurrent, entry.id, maxLoadedOffset, keepViewport);
            })
              .then((opened) => {
                if (!opened && current())
                  status.textContent =
                    'Raum noch nicht geöffnet. Offene Eingaben zuerst speichern oder prüfen.';
              })
              .catch((error) => {
                if (current())
                  status.textContent =
                    'Raum konnte nicht geöffnet werden: ' + (error as Error).message;
              })
              .finally(() => {
                pending = false;
                if (current() && button.isConnected) button.disabled = entry.unavailable;
              });
          };
          list.append(button);
          if (entry.id === focusId && !keepViewport) {
            button.focus({ preventScroll: true });
            button.scrollIntoView({ block: 'center' });
          }
        }
        maxLoadedOffset = Math.max(maxLoadedOffset, offset);
        const next = page.next;
        more.hidden = next === null;
        more.textContent = 'Weitere Räume';
        more.onclick = () => {
          if (next !== null) void load(next);
        };
        if (next !== null && next <= restoreThrough) restoreNext = next;
      } catch (error) {
        if (current()) {
          status.textContent =
            'Raumverweise konnten nicht geladen werden: ' + (error as Error).message;
          more.hidden = false;
          more.textContent = 'Erneut laden';
          more.onclick = () => void load(offset);
        }
      } finally {
        pending = false;
        if (current()) more.disabled = false;
      }
      if (restoreNext !== null && current()) void load(restoreNext);
    };
    void load(0);
  }
}
