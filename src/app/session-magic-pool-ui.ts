import { budgetRarities, budgetRarity } from './atlas/dungeon-budget-contracts';
import type { SessionGenerationRequest } from './session-contracts';

export function magicPoolPicker(
  tell: (text: string, error?: boolean) => void,
  onEnable: () => void,
) {
  const picked = new Map<string, { definitionId: string; revision: number; name: string }>();
  let token: string | null = null,
    request = 0,
    contextVersion = 0,
    next: number | null = null,
    signature = '';
  const get = <T extends HTMLElement>(id: string) =>
      document.getElementById('session-magic-pool-' + id) as T,
    mode = get<HTMLInputElement>('enabled');
  for (const rarity of budgetRarities) {
    const o = document.createElement('option');
    o.value = o.textContent = rarity;
    get('rarity').append(o);
  }
  function render() {
    const scope = contextVersion,
      root = get('selected');
    root.replaceChildren();
    const summary = document.createElement('p');
    summary.textContent = picked.size + ' Gegenstände gewählt';
    root.append(summary);
    for (const [id, d] of picked) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = d.name + ' entfernen';
      b.onclick = () => {
        if (scope !== contextVersion) return;
        picked.delete(id);
        render();
        const box = get('results').querySelector<HTMLInputElement>(
          'input[value="' + CSS.escape(id) + '"]',
        );
        if (box) box.checked = false;
      };
      root.append(b);
    }
  }
  async function search(after = 0) {
    const owner = token,
      scope = contextVersion,
      epoch = ++request;
    if (!owner) return;
    const text = get<HTMLInputElement>('search').value,
      rarity = get<HTMLSelectElement>('rarity').value,
      key = JSON.stringify([text, rarity]);
    if (key !== signature) {
      after = 0;
      signature = key;
    }
    get<HTMLButtonElement>('find').disabled = get<HTMLButtonElement>('next').disabled = true;
    get('status').textContent = 'Katalog wird geladen…';
    try {
      const result = await window.campaign.itemDefinitions({
        search: text,
        category: '',
        magic: 'yes',
        rarity,
        attunement: '',
        sort: 'name',
        direction: 'asc',
        after,
        includeTrashed: false,
      });
      if (owner !== token || epoch !== request) return;
      if (!result.ok) throw new Error(result.error);
      const page = result.value,
        root = get('results');
      if (!after) root.replaceChildren();
      for (const d of page.items) {
        if (!budgetRarity(d.rarity)) continue;
        const label = document.createElement('label');
        label.className = 'check-label';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.value = d.id;
        box.checked = picked.has(d.id);
        box.onchange = () => {
          if (owner !== token || scope !== contextVersion) return;
          if (box.checked) {
            if (picked.size >= 100) {
              box.checked = false;
              tell('Höchstens 100 Gegenstände im Pool.', true);
              return;
            }
            picked.set(d.id, {
              definitionId: d.id,
              revision: d.revision,
              name: d.name,
            });
            mode.checked = true;
            onEnable();
          } else picked.delete(d.id);
          render();
        };
        label.append(box, document.createTextNode(d.name + ' · ' + d.rarity));
        root.append(label);
      }
      next = page.next;
      get('next').hidden = next === null;
      get('status').textContent =
        page.total +
        ' Katalogtreffer · ' +
        page.sourceStatus.message +
        (page.problems.length ? ' · ' + page.problems.join(' · ') : '');
    } catch (error) {
      if (owner === token && epoch === request) tell((error as Error).message, true);
    } finally {
      if (owner === token && epoch === request)
        get<HTMLButtonElement>('find').disabled = get<HTMLButtonElement>('next').disabled = false;
    }
  }
  mode.onchange = () => {
    if (mode.checked) onEnable();
  };
  get('find').onclick = () => void search();
  get('next').onclick = () => {
    if (next !== null) void search(next);
  };
  get('clear').onclick = () => {
    picked.clear();
    for (const box of get('results').querySelectorAll<HTMLInputElement>('input'))
      box.checked = false;
    render();
  };
  get('search').onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void search();
    }
  };
  function context(owner: string | null) {
    token = owner;
    contextVersion++;
    request++;
    get<HTMLButtonElement>('find').disabled = get<HTMLButtonElement>('next').disabled = !owner;
    picked.clear();
    signature = '';
    next = null;
    mode.checked = false;
    get<HTMLInputElement>('search').value = '';
    get<HTMLSelectElement>('rarity').value = '';
    get('results').replaceChildren();
    get('status').textContent = 'Suche Gegenstände und wähle sie für diesen Spielabend.';
    get('next').hidden = true;
    render();
  }
  render();
  return {
    selection: (): SessionGenerationRequest['magicPool'] =>
      mode.checked
        ? [...picked.values()].map(({ definitionId, revision }) => ({
            definitionId,
            revision,
          }))
        : undefined,
    disable: () => {
      mode.checked = false;
    },
    context,
    restore: (
      selection: SessionGenerationRequest['magicPool'],
      names: readonly { definitionId: string; revision: number; name: string }[],
    ) => {
      context(token);
      for (const item of selection ?? []) {
        const name = names.find(
          (d) => d.definitionId === item.definitionId && d.revision === item.revision,
        )?.name;
        picked.set(item.definitionId, {
          ...item,
          name: name ?? 'Gespeicherter Gegenstand',
        });
      }
      mode.checked = selection !== undefined;
      render();
    },
  };
}
