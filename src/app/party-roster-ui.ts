import type { LiveView, LiveAction } from './live-contracts';
import { partyIdentityPrefixes } from './party-overview';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  return el;
};
export class PartyRosterPanel {
  private basis: LiveView | null = null;
  private selected = new Set<string>();
  private busy = false;
  private valid: () => boolean = () => false;
  private search = node('input');
  private list = node('div');
  private count = node('p');
  private status = node('p');
  private apply = node('button', 'Übernehmen');
  private reload = node('button', 'Neu lesen');
  private clear = node('button', 'Leeren');
  constructor(
    private root: HTMLElement,
    private save: (
      action: Extract<LiveAction, { kind: 'scene-roster' }>,
      current: () => boolean,
    ) => Promise<void>,
    private reread: () => Promise<void>,
    private dismiss: () => void,
  ) {
    root.id = 'party-membership-editor';
    root.hidden = true;
    root.className = 'party-membership-editor';
    const head = node('div'),
      close = node('button', 'Zurück'),
      label = node('label', 'Figuren suchen (Name, Spieler oder ID)'),
      footer = node('div');
    head.className = footer.className = 'toolbar';
    head.append(node('h3', 'Aktives Szenenroster'), close);
    const frame = root.parentElement?.querySelector('.party-window-heading');
    if (frame) {
      head.style.display = 'none';
      close.id = 'party-roster-back';
      close.textContent = '←';
      close.setAttribute('aria-label', 'Zur Partyübersicht');
      frame.append(close);
    }
    this.search.type = 'search';
    this.search.id = 'party-membership-search';
    label.htmlFor = this.search.id;
    label.hidden = true;
    this.search.setAttribute('aria-label', label.textContent!);
    this.search.placeholder = 'Name, Spieler oder ID';
    this.search.maxLength = 1000;
    this.list.className = 'party-membership-list';
    this.list.id = 'party-membership-list';
    this.count.id = 'party-membership-count';
    this.status.id = 'party-membership-status';
    this.status.setAttribute('role', 'status');
    this.apply.id = 'party-membership-apply';
    this.reload.id = 'party-membership-reload';
    this.clear.id = 'party-membership-clear';
    for (const b of [close, this.apply, this.reload, this.clear]) b.type = 'button';
    footer.append(this.apply, this.reload);
    const selection = node('div');
    selection.className = 'toolbar party-membership-selection';
    selection.append(this.count, this.clear);
    root.append(head, label, this.search, selection, this.list, this.status, footer);
    this.search.oninput = () => this.draw();
    this.clear.onclick = () => {
      if (this.available()) {
        this.selected.clear();
        for (const box of this.list.querySelectorAll<HTMLInputElement>('input'))
          box.checked = false;
        this.updateCount();
      }
    };
    close.onclick = () => {
      if (!this.busy) {
        this.close();
        this.dismiss();
      }
    };
    this.reload.onclick = () => {
      if (!this.busy)
        void this.reread().catch((e) => {
          this.status.textContent = e.message;
        });
    };
    this.apply.onclick = () => {
      if (!this.available() || !this.basis?.scene || this.basis.focusRevision === null) return;
      const b = this.basis,
        action: Extract<LiveAction, { kind: 'scene-roster' }> = {
          kind: 'scene-roster',
          sceneId: b.scene!.id,
          expectedRosterRevision: b.rosterRevision,
          expectedFocusRevision: b.focusRevision!,
          expectedSceneMembershipRevision: b.scene!.membershipRevision,
          memberIds: [...this.selected],
        };
      this.busy = true;
      this.lock();
      void this.save(action, () => this.valid() && !this.root.hidden)
        .catch((e) => {
          this.status.textContent = e.message;
        })
        .finally(() => {
          this.busy = false;
          this.lock();
        });
    };
  }
  open(basis: LiveView, current: () => boolean) {
    this.basis = structuredClone(basis);
    this.valid = current;
    this.selected = new Set(basis.scene?.members ?? []);
    this.search.value = '';
    this.status.textContent = '';
    this.root.hidden = false;
    this.draw();
    this.search.focus();
  }
  close() {
    this.root.hidden = true;
    this.basis = null;
    this.selected.clear();
  }
  private available() {
    return !this.busy && !this.root.hidden && this.valid();
  }
  lock(blocked = false) {
    const stale = !this.valid();
    for (const input of this.root.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      'input,button',
    ))
      input.disabled = this.busy || blocked;
    this.apply.disabled = this.busy || blocked || stale;
    this.clear.disabled = this.busy || blocked || stale;
    for (const input of this.list.querySelectorAll<HTMLInputElement>('input'))
      input.disabled = this.busy || blocked || stale;
    if (stale && !this.root.hidden)
      this.status.textContent =
        'Party oder Fokus geändert. Auswahl neu lesen; bisherige Auswahl bleibt sichtbar.';
  }
  private updateCount() {
    const total =
      this.basis?.roster.filter(
        (c) =>
          !c.archived && (!c.active || c.sceneId === null || c.sceneId === this.basis!.focusId),
      ).length ?? 0;
    this.count.textContent =
      this.selected.size +
      ' ausgewählt · ' +
      this.list.querySelectorAll('input').length +
      ' / ' +
      total +
      ' sichtbar';
  }
  private draw() {
    this.list.replaceChildren();
    const b = this.basis;
    if (!b) return;
    const eligible = b.roster.filter(
        (c) => !c.archived && (!c.active || c.sceneId === null || c.sceneId === b.focusId),
      ),
      prefixes = partyIdentityPrefixes(eligible.map((c) => c.id)),
      query = this.search.value.trim().toLocaleLowerCase('de-DE'),
      rows = eligible.filter(
        (c) =>
          !query ||
          [c.id, c.profile.name, c.profile.playerName ?? ''].some((text) =>
            text.toLocaleLowerCase('de-DE').includes(query),
          ),
      );
    this.count.textContent =
      this.selected.size + ' ausgewählt · ' + rows.length + ' / ' + eligible.length;
    for (const c of rows) {
      const row = node('label'),
        box = node('input'),
        text = node('span'),
        identity = node('strong', c.profile.name),
        details = node(
          'small',
          (c.profile.playerName || 'Spieler offen') +
            ' · ' +
            (c.sceneId === b.focusId && c.active
              ? 'In dieser Szene'
              : c.active
                ? 'Ohne Szene'
                : 'Inaktiv') +
            ' · ' +
            prefixes.get(c.id),
        );
      row.className = 'party-membership-row';
      row.dataset.characterId = c.id;
      row.title = c.id;
      box.type = 'checkbox';
      box.value = c.id;
      box.checked = this.selected.has(c.id);
      box.onchange = () => {
        if (!this.available()) return;
        if (box.checked) this.selected.add(c.id);
        else this.selected.delete(c.id);
        this.updateCount();
      };
      text.append(identity, details);
      row.append(box, text);
      this.list.append(row);
    }
    if (!rows.length)
      this.list.textContent =
        'Keine passenden Figuren. Auswahl außerhalb des Filters bleibt erhalten.';
    this.lock();
  }
}
