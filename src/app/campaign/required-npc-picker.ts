import type { NpcPage } from './npc-data-contracts';

/** Small paged picker; retain identities only, not NPC prose or complete catalogs. */
export function requiredNpcPicker(hostId: string, tell: (text: string, error?: boolean) => void) {
  const host = document.getElementById(hostId)!,
    picked = new Map<string, string>();
  let token: string | null = null,
    request = 0,
    offset = 0;
  const selected = document.createElement('div'),
    search = document.createElement('input'),
    find = document.createElement('button'),
    rows = document.createElement('div'),
    paging = document.createElement('p'),
    previous = document.createElement('button'),
    next = document.createElement('button');
  search.placeholder = 'NPC suchen';
  search.setAttribute('aria-label', 'Verbindliche NPCs suchen');
  find.textContent = 'Suchen';
  previous.textContent = 'Zurück';
  next.textContent = 'Weitere NPCs';
  for (const b of [find, previous, next]) b.type = 'button';
  host.append(selected, search, find, rows, previous, next, paging);
  function renderSelected() {
    selected.replaceChildren();
    for (const [id, name] of picked) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = name + ' entfernen';
      b.addEventListener('click', () => {
        picked.delete(id);
        renderSelected();
        void load();
      });
      selected.append(b);
    }
    if (!picked.size) selected.textContent = 'Keine verbindlichen Gegner gewählt.';
  }
  async function load() {
    const owner = token,
      epoch = ++request;
    if (!owner) return;
    find.disabled = previous.disabled = next.disabled = true;
    try {
      const result = await window.campaign.npcs(owner, {
        text: search.value,
        lifecycle: 'active',
        factionId: null,
        locationId: null,
        offset,
      });
      if (owner !== token || epoch !== request) return;
      if (!result.ok) throw new Error(result.error);
      const page: NpcPage = result.value;
      rows.replaceChildren();
      for (const n of page.rows) {
        if (n.role !== 'hostile' || !n.creatureId) continue;
        const label = document.createElement('label');
        label.className = 'check-label';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.value = n.id;
        box.checked = picked.has(n.id);
        box.addEventListener('change', () => {
          if (box.checked) {
            if (picked.size >= 100) {
              box.checked = false;
              tell('Höchstens 100 verbindliche NPCs.', true);
              return;
            }
            picked.set(n.id, n.name);
          } else picked.delete(n.id);
          renderSelected();
        });
        label.append(box, document.createTextNode(n.name));
        rows.append(label);
      }
      paging.textContent = page.total
        ? 'NPCs ' +
          (offset + 1) +
          '–' +
          Math.min(offset + page.rows.length, page.total) +
          ' von ' +
          page.total
        : 'Keine NPCs gefunden.';
      previous.disabled = offset === 0;
      next.disabled = offset + page.rows.length >= page.total;
      if (!rows.childElementCount)
        rows.textContent = 'Diese Seite enthält keine aktiven feindlichen NPCs mit Statblock.';
    } catch (error) {
      if (owner === token && epoch === request) tell((error as Error).message, true);
    } finally {
      if (owner === token && epoch === request) find.disabled = false;
    }
  }
  find.addEventListener('click', () => {
    offset = 0;
    void load();
  });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      offset = 0;
      void load();
    }
  });
  previous.addEventListener('click', () => {
    offset = Math.max(0, offset - 50);
    void load();
  });
  next.addEventListener('click', () => {
    offset += 50;
    void load();
  });
  renderSelected();
  return {
    set: (entries: { id: string; name: string }[]) => {
      picked.clear();
      for (const e of entries) picked.set(e.id, e.name);
      renderSelected();
      void load();
    },
    ids: () => [...picked.keys()],
    context: (nextToken: string | null, reset = false) => {
      if (token !== nextToken || reset) {
        token = nextToken;
        request++;
        offset = 0;
        search.value = '';
        picked.clear();
        rows.replaceChildren();
        paging.textContent = '';
        renderSelected();
      }
      if (token) void load();
    },
  };
}
