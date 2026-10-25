import type { DeskContent, DeskEntry, SceneDeskAPI } from './scene-desk-contracts';
import type { NoteRow, PreparationAPI } from './preparation-contracts';
import { plainReferenceText } from './text-references';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
export interface VisitNoteContext {
  key: string;
  token: string;
  notes: NoteRow[];
  current: () => boolean;
  ids: () => readonly string[];
  change: (id: string, linked: boolean) => void;
  edit: (id: string, current: () => boolean) => Promise<void>;
}
type API = Pick<SceneDeskAPI, 'searchDesk' | 'deskContent'> & Pick<PreparationAPI, 'noteRoomUses'>;
/** Reads existing World notes while the existing visit writer owns only the ID selection. */
export class VisitNoteOrganizer {
  private owner: VisitNoteContext | null = null;
  private epoch = 0;
  private searchRequest = 0;
  private detailRequest = 0;
  private selectedPage = 0;
  private next: number | null = null;
  private loading = false;
  private locked = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private known = new Map<string, DeskEntry>();
  private entries: DeskEntry[] = [];
  private shown: DeskContent | null = null;
  private search = node('input');
  private find = node('button', 'Suchen');
  private more = node('button', 'Weitere 40 Notizen');
  private status = node('p');
  private selected = node('section');
  private list = node('div');
  private detail = node('section');
  private counter = node('p');
  constructor(
    private root: HTMLElement,
    private api: API,
  ) {
    this.root.classList.add('visit-note-organizer');
    this.search.type = 'search';
    this.search.id = 'visit-note-search';
    this.search.maxLength = 1000;
    this.search.placeholder = 'Namen oder Notizinhalt suchen';
    this.find.type = this.more.type = 'button';
    this.find.id = 'visit-note-find';
    this.more.id = 'visit-note-more';
    this.more.hidden = true;
    const label = node('label', 'Notizen für diesen Besuch suchen');
    label.htmlFor = this.search.id;
    const tools = node('div');
    tools.className = 'toolbar';
    tools.append(this.search, this.find);
    this.status.id = 'visit-note-search-status';
    this.status.setAttribute('role', 'status');
    this.selected.id = 'visit-note-selected';
    this.list.id = 'visit-note-results';
    this.detail.id = 'visit-note-detail';
    this.detail.setAttribute('aria-label', 'Notizvorschau');
    this.counter.id = 'visit-note-selection-summary';
    const columns = node('div'),
      index = node('section');
    columns.className = 'visit-note-columns';
    index.append(this.list, this.more);
    columns.append(index, this.detail);
    this.root.replaceChildren(this.counter, this.selected, label, tools, this.status, columns);
    this.search.oninput = () => {
      if (this.timer) clearTimeout(this.timer);
      this.invalidateSearch();
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.load(false);
      }, 180);
    };
    this.search.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.find.click();
      }
    };
    this.find.onclick = () => {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.invalidateSearch();
      void this.load(false);
    };
    this.more.onclick = () => {
      if (!this.loading && this.next !== null) void this.load(true);
    };
  }
  context(next: VisitNoteContext | null) {
    const changed = next?.key !== this.owner?.key;
    this.owner = next;
    if (changed) {
      this.epoch++;
      this.searchRequest++;
      this.detailRequest++;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.search.value = '';
      this.entries = [];
      this.next = null;
      this.loading = false;
      this.shown = null;
      this.known.clear();
      this.selectedPage = 0;
      this.list.replaceChildren();
      this.selected.replaceChildren();
      this.counter.textContent = '';
      this.detail.replaceChildren(node('p', 'Eine Notiz auswählen, um sie hier zu lesen.'));
      this.status.textContent = '';
    }
    if (!next) return;
    for (const row of next.notes)
      if (
        !this.known.get(row.note.id)?.revision ||
        row.note.revision > this.known.get(row.note.id)!.revision!
      )
        this.known.set(row.note.id, {
          revision: row.note.revision,
          ref: { kind: 'note', id: row.note.id },
          title: row.note.title,
          label: {
            note: 'Notiz',
            npc: 'NSC',
            faction: 'Fraktion',
            quest: 'Quest',
            rumor: 'Gerücht',
            rule: 'Regelreferenz',
          }[row.note.kind],
          unavailable: row.trashed,
        });
    this.drawSelected();
    this.sync();
    if (changed) void this.load(false);
  }
  lock(on: boolean) {
    this.locked = on;
    this.sync();
  }
  private current(epoch: number) {
    return this.epoch === epoch && !!this.owner?.current();
  }
  private invalidateSearch() {
    this.searchRequest++;
    this.loading = false;
    this.entries = [];
    this.next = null;
    this.list.replaceChildren();
    this.status.textContent = 'Notizen werden gesucht…';
    this.sync();
  }
  private sync() {
    const blocked = this.locked || !this.owner?.current();
    this.search.disabled = blocked;
    this.find.disabled = blocked || this.loading;
    this.more.disabled = blocked || this.loading;
    this.more.hidden = this.next === null;
    for (const box of this.list.querySelectorAll<HTMLInputElement>('input[type=checkbox]')) {
      box.checked = !!this.owner?.ids().includes(box.value);
      box.disabled = blocked || box.dataset.unavailable === 'true';
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('button[data-owner-action]'))
      button.disabled = blocked || button.dataset.unavailable === 'true';
    const toggle = this.detail.querySelector<HTMLButtonElement>('[data-note-toggle]');
    if (toggle && this.shown) {
      const linked = !!this.owner?.ids().includes(this.shown.ref.id);
      toggle.textContent = linked
        ? 'Verknüpfung zu diesem Besuch lösen'
        : 'Mit diesem Besuch verknüpfen';
      toggle.disabled = blocked || (!!this.shown.unavailable && !linked);
    }
  }
  private toggle(id: string, linked: boolean) {
    if (this.locked || !this.owner?.current()) return;
    this.owner.change(id, linked);
    this.drawSelected();
    this.sync();
  }
  private drawSelected() {
    this.selected.replaceChildren();
    const ids = this.owner?.ids() ?? [];
    this.counter.textContent =
      ids.length +
      ' Notizen mit diesem Besuch verknüpft · bleiben unabhängig von der Suche erhalten.';
    this.selectedPage = Math.min(this.selectedPage, Math.max(0, Math.ceil(ids.length / 40) - 1));
    for (const id of ids.slice(this.selectedPage * 40, (this.selectedPage + 1) * 40)) {
      const entry = this.known.get(id),
        row = node('div'),
        read = node('button', entry?.title ?? 'Nicht geladene Notiz'),
        remove = node('button', 'Lösen');
      read.type = remove.type = 'button';
      read.dataset.ownerAction = remove.dataset.ownerAction = '';
      remove.setAttribute('aria-label', 'Verknüpfung lösen: ' + (entry?.title ?? id));
      const epoch = this.epoch;
      read.onclick = () => {
        if (this.current(epoch) && read.isConnected) void this.preview(id);
      };
      remove.onclick = () => {
        if (this.current(epoch) && remove.isConnected) this.toggle(id, false);
      };
      row.append(
        read,
        node(
          'span',
          entry?.unavailable ? 'Quelle nicht verfügbar' : (entry?.label ?? 'Weltverweis'),
        ),
        remove,
      );
      this.selected.append(row);
    }
    if (ids.length > 40) {
      const pages = node('div'),
        prev = node('button', 'Vorige Verknüpfungen'),
        next = node('button', 'Weitere Verknüpfungen'),
        epoch = this.epoch;
      prev.type = next.type = 'button';
      prev.disabled = this.selectedPage === 0;
      next.disabled = (this.selectedPage + 1) * 40 >= ids.length;
      prev.onclick = () => {
        if (this.current(epoch) && this.selectedPage > 0) {
          this.selectedPage--;
          this.drawSelected();
          this.sync();
        }
      };
      next.onclick = () => {
        if (this.current(epoch) && (this.selectedPage + 1) * 40 < ids.length) {
          this.selectedPage++;
          this.drawSelected();
          this.sync();
        }
      };
      pages.append(
        prev,
        node('span', `${this.selectedPage + 1} / ${Math.ceil(ids.length / 40)}`),
        next,
      );
      this.selected.append(pages);
    }
  }
  private async load(append: boolean) {
    if (!this.owner?.current() || this.loading || (append && this.next === null)) return;
    const epoch = this.epoch,
      request = ++this.searchRequest,
      query = this.search.value,
      offset = append ? this.next! : 0;
    this.loading = true;
    this.sync();
    this.status.textContent = 'Notizen werden gesucht…';
    try {
      const r = await this.api.searchDesk(this.owner.token, 'note', query, offset);
      if (!this.current(epoch) || request !== this.searchRequest || query !== this.search.value)
        return;
      if (!r.ok) throw Error(r.error);
      this.entries = append ? [...this.entries, ...r.value.entries] : r.value.entries;
      this.next = r.value.next;
      this.list.replaceChildren();
      for (const entry of this.entries) {
        this.known.set(entry.ref.id, entry);
        const card = node('article'),
          label = node('label'),
          box = node('input'),
          read = node('button', 'Lesen');
        box.type = 'checkbox';
        box.value = entry.ref.id;
        box.dataset.unavailable = String(!!entry.unavailable);
        box.setAttribute('aria-label', entry.title + ' mit Besuch verknüpfen');
        label.append(box, node('strong', entry.title), node('span', entry.label));
        read.type = 'button';
        read.dataset.ownerAction = '';
        read.dataset.unavailable = String(!!entry.unavailable);
        read.setAttribute('aria-label', 'Notiz lesen: ' + entry.title);
        const active = () =>
          this.current(epoch) && request === this.searchRequest && card.isConnected;
        box.onchange = () => {
          if (active() && !box.disabled) this.toggle(entry.ref.id, box.checked);
        };
        read.onclick = () => {
          if (active() && !read.disabled) void this.preview(entry.ref.id);
        };
        card.append(label, read);
        if (entry.preview && 'parts' in entry.preview) {
          const excerpt = node('p', entry.preview.owner + ': ');
          for (const part of entry.preview.parts)
            excerpt.append(node(part.matched ? 'mark' : 'span', part.text));
          card.append(excerpt);
        }
        this.list.append(card);
      }
      this.status.textContent =
        (r.value.notice ? r.value.notice + ' ' : '') +
        this.entries.length +
        ' Notizen angezeigt' +
        (this.next !== null ? ' · weitere Treffer verfügbar.' : '.');
      this.drawSelected();
    } catch (error) {
      if (this.current(epoch) && request === this.searchRequest)
        this.status.textContent =
          'Notizsuche fehlgeschlagen: ' +
          (error as Error).message +
          ' Suche ausdrücklich erneut ausführen.';
    } finally {
      if (this.current(epoch) && request === this.searchRequest) {
        this.loading = false;
        this.sync();
      }
    }
  }
  private async preview(id: string) {
    if (this.locked || !this.owner?.current()) return;
    const epoch = this.epoch,
      request = ++this.detailRequest,
      token = this.owner.token;
    this.shown = null;
    this.detail.replaceChildren(node('p', 'Notiz wird gelesen…'));
    try {
      const r = await this.api.deskContent(token, { kind: 'note', id });
      if (!this.current(epoch) || request !== this.detailRequest) return;
      if (!r.ok) throw Error(r.error);
      if (
        r.value.ref.kind !== 'note' ||
        r.value.ref.id !== id ||
        !r.value.note ||
        r.value.note.id !== id
      )
        throw Error('Notiz gehört zu einer anderen Quelle.');
      const n = r.value.note;
      this.shown = r.value;
      this.known.set(id, r.value);
      const title = node('h4', n.title),
        toggle = node('button'),
        edit = node('button', 'Notiz bearbeiten…');
      toggle.type = edit.type = 'button';
      toggle.dataset.noteToggle = '';
      edit.dataset.ownerAction = '';
      edit.dataset.unavailable = String(!!r.value.unavailable);
      const valid = () =>
        this.current(epoch) && request === this.detailRequest && this.shown === r.value;
      toggle.onclick = () => {
        if (valid() && !toggle.disabled) this.toggle(id, !this.owner!.ids().includes(id));
      };
      edit.onclick = () => {
        if (valid() && !edit.disabled)
          void this.owner!.edit(id, valid).catch((error) => {
            if (valid()) this.status.textContent = (error as Error).message;
          });
      };
      this.detail.replaceChildren(
        title,
        node('p', r.value.label + ' · aktuelle Notiz · Revision ' + r.value.revision),
        toggle,
        edit,
      );
      if (r.value.unavailable)
        this.detail.append(
          node(
            'p',
            'Quelle nicht verfügbar. Eine bestehende Verknüpfung kann ausdrücklich gelöst werden.',
          ),
        );
      for (const [heading, text] of [
        ['Zum Vorlesen', n.readAloud],
        ['GM-Notizen', n.gmNotes],
      ])
        if (text) this.detail.append(node('h5', heading), node('pre', plainReferenceText(text!)));
      const uses = node('p', 'Raumverweise werden geladen…');
      this.detail.append(uses);
      this.drawSelected();
      this.sync();
      try {
        const rooms = await this.api.noteRoomUses(token, id, 0);
        if (!valid()) return;
        if (!rooms.ok) throw Error(rooms.error);
        uses.textContent =
          (rooms.value.entries.length
            ? 'Verwendet in Räumen: ' +
              rooms.value.entries
                .slice(0, 4)
                .map((e) => e.title + ' · Raum ' + e.number)
                .join('; ') +
              (rooms.value.next !== null || rooms.value.entries.length > 4
                ? ' · weitere Räume'
                : '')
            : 'Keine gespeicherten Raumverweise.') +
          (rooms.value.notice ? ' ' + rooms.value.notice : '');
      } catch {
        if (valid()) uses.textContent = 'Raumverweise konnten gerade nicht gelesen werden.';
      }
    } catch (error) {
      if (this.current(epoch) && request === this.detailRequest) {
        this.shown = null;
        this.detail.replaceChildren(
          node('p', 'Notiz konnte nicht gelesen werden: ' + (error as Error).message),
        );
      }
    }
  }
}
