import { budgetRarities } from '../atlas/dungeon-budget-contracts';
import type { Preparation } from './preparation-contracts';
import type { SessionProposal, SessionAction } from './session-contracts';
import type { ItemInput } from '../catalog/item-input-contracts';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let opened: SessionProposal | null = null;
let save:
  | ((
      value: Omit<
        Extract<SessionAction, { kind: 'edit-proposal' }>,
        'kind' | 'planId' | 'runId' | 'index' | 'expectedRevision'
      >,
    ) => Promise<boolean>)
  | null = null;
type DraftItem = Omit<ItemInput, 'quantity'> & { quantity: string };
let items: DraftItem[] = [];
let catalogRequest = 0,
  catalogNext: number | null = null,
  catalogCurrent = () => true;
let generation = 0,
  busy = false;
export const proposalEditorOpen = () => !!opened;
export function closeProposalEditor() {
  generation++;
  catalogRequest++;
  opened = null;
  save = null;
  busy = false;
  el<HTMLDialogElement>('session-proposal-editor').close();
}
export function initProposalEditor() {
  const dialog = el<HTMLDialogElement>('session-proposal-editor');
  for (const r of budgetRarities) {
    const o = document.createElement('option');
    o.value = r;
    o.textContent = r;
    el('proposal-catalog-rarity').append(o);
  }
  el('proposal-catalog-find').onclick = () => void searchCatalog(0);
  el('proposal-catalog-next').onclick = () => {
    if (catalogNext !== null) void searchCatalog(catalogNext);
  };
  el('proposal-catalog-search').onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void searchCatalog(0);
    }
  };
  dialog.addEventListener('cancel', () => {
    generation++;
    catalogRequest++;
    opened = null;
    save = null;
    busy = false;
  });
  el('proposal-edit-cancel').onclick = closeProposalEditor;
  el('proposal-edit-has-reward').oninput = () => {
    el('proposal-edit-reward').hidden = !el<HTMLInputElement>('proposal-edit-has-reward').checked;
  };
  el('proposal-edit-item-add').onclick = () => {
    items.push({ name: '', quantity: '1', valueGold: '0', category: 'other' });
    renderItems();
  };
  el<HTMLFormElement>('proposal-edit-form').onsubmit = (e) => {
    e.preventDefault();
    if (!save || !opened || busy) return;
    const fn = save,
      g = generation,
      form = el<HTMLFormElement>('proposal-edit-form');
    busy = true;
    form.inert = true;
    void (async () => {
      try {
        const integer = (raw: string, label: string) => {
          if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))
            throw new Error(label + ' benötigt eine ganze Zahl.');
          return Number(raw);
        };
        const value = {
          title: el<HTMLInputElement>('proposal-edit-title').value,
          notes: el<HTMLTextAreaElement>('proposal-edit-notes').value,
          readAloud: el<HTMLTextAreaElement>('proposal-edit-public').value,
          locationId: el<HTMLSelectElement>('proposal-edit-location').value || null,
          noteIds: [
            ...el('proposal-edit-refs').querySelectorAll<HTMLInputElement>('input:checked'),
          ].map((c) => c.value),
          reward: el<HTMLInputElement>('proposal-edit-has-reward').checked
            ? {
                poolXp: integer(el<HTMLInputElement>('proposal-edit-xp').value, 'Story-XP'),
                items: items.map((item) => ({
                  ...structuredClone(item),
                  quantity: integer(item.quantity, 'Menge'),
                })),
              }
            : null,
        };
        if ((await fn(value)) && g === generation) closeProposalEditor();
      } catch (e) {
        if (g === generation) el('proposal-edit-status').textContent = (e as Error).message;
      } finally {
        if (g === generation) {
          busy = false;
          form.inert = false;
        }
      }
    })();
  };
}
function renderItems() {
  const root = el('proposal-edit-items');
  root.replaceChildren();
  for (const [index, item] of items.entries()) {
    const row = document.createElement('fieldset'),
      legend = document.createElement('legend');
    legend.textContent = 'Eintrag ' + (index + 1);
    row.append(legend);
    for (const [key, label, type] of [
      ['name', 'Name', 'text'],
      ['quantity', 'Menge', 'number'],
      ['valueGold', 'Gold pro Stück', 'text'],
    ] as const) {
      const wrap = document.createElement('label'),
        input = document.createElement('input');
      wrap.textContent = label;
      input.type = key === 'quantity' ? 'text' : type;
      if (key === 'quantity') input.inputMode = 'numeric';
      input.value = String(item[key]);
      input.disabled = !!item.reference && key !== 'quantity';
      if (item.reference && key === 'valueGold') wrap.hidden = true;
      input.setAttribute('aria-label', label);
      input.oninput = () => {
        item[key] = input.value;
      };
      wrap.append(input);
      row.append(wrap);
    }
    const wrap = document.createElement('label'),
      select = document.createElement('select');
    wrap.textContent = 'Kategorie';
    for (const [id, name] of [
      ['coins', 'Münzen'],
      ['equipment', 'Ausrüstung'],
      ['trade-goods', 'Handelsware'],
      ['magic', 'Magisch'],
      ['other', 'Sonstiges'],
    ] as const) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = name;
      select.append(o);
    }
    select.value = item.category;
    select.disabled = !!item.reference;
    select.oninput = () => {
      item.category = select.value as ItemInput['category'];
    };
    wrap.append(select);
    row.append(wrap);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Entfernen';
    remove.onclick = () => {
      items.splice(index, 1);
      renderItems();
    };
    row.append(remove);
    if (item.reference) {
      const info = document.createElement('p');
      info.textContent = 'Katalogreferenz · Revision ' + item.reference.revision;
      const detach = document.createElement('button');
      detach.type = 'button';
      detach.textContent = 'Als eigenen Eintrag bearbeiten';
      detach.onclick = () => {
        delete item.reference;
        renderItems();
      };
      row.append(info, detach);
    }
    root.append(row);
  }
}
export function openProposalEditor(
  proposal: SessionProposal,
  sources: Preparation,
  onSave: NonNullable<typeof save>,
  current = () => true,
) {
  generation++;
  catalogRequest++;
  busy = false;
  el<HTMLFormElement>('proposal-edit-form').inert = false;
  catalogCurrent = current;
  el<HTMLButtonElement>('proposal-catalog-find').disabled = false;
  el<HTMLButtonElement>('proposal-catalog-next').disabled = false;
  catalogNext = null;
  el('proposal-catalog-results').replaceChildren();
  el('proposal-catalog-status').textContent = '';
  el('proposal-catalog-next').hidden = true;
  opened = proposal;
  save = onSave;
  items = (proposal.reward?.items ?? []).map((item) => ({
    ...structuredClone(item),
    quantity: String(item.quantity),
  }));
  el<HTMLInputElement>('proposal-edit-title').value = proposal.title;
  el<HTMLTextAreaElement>('proposal-edit-notes').value = proposal.notes;
  el<HTMLTextAreaElement>('proposal-edit-public').value = proposal.readAloud;
  const locations = el<HTMLSelectElement>('proposal-edit-location');
  locations.replaceChildren();
  for (const l of [
    { id: '', name: 'Ohne Ort' },
    ...sources.locations
      .filter((l) => !l.trashed)
      .map((l) => ({ id: l.document.id, name: l.document.name })),
  ]) {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = l.name;
    locations.append(o);
  }
  if (
    proposal.locationId &&
    !sources.locations.some((l) => l.document.id === proposal.locationId && !l.trashed)
  ) {
    const o = document.createElement('option');
    o.value = proposal.locationId;
    o.textContent = 'Ort nicht mehr verfügbar';
    locations.append(o);
  }
  locations.value = proposal.locationId ?? '';
  const refs = el('proposal-edit-refs');
  refs.replaceChildren();
  const notes: { id: string; title: string }[] = sources.notes
    .filter((n) => !n.trashed)
    .map((n) => ({ id: n.note.id, title: n.note.title }));
  for (const id of proposal.noteIds)
    if (!notes.some((n) => n.id === id))
      notes.push({
        id,
        title:
          'Nicht mehr verfügbar: ' +
          (sources.notes.find((n) => n.note.id === id)?.note.title ?? id),
      });
  for (const note of notes) {
    const l = document.createElement('label'),
      c = document.createElement('input');
    c.type = 'checkbox';
    c.value = note.id;
    c.checked = proposal.noteIds.includes(note.id);
    l.className = 'check-label';
    l.append(c, document.createTextNode(note.title));
    refs.append(l);
  }
  el<HTMLInputElement>('proposal-edit-has-reward').checked = !!proposal.reward;
  el('proposal-edit-reward').hidden = !proposal.reward;
  el<HTMLInputElement>('proposal-edit-xp').value = String(proposal.reward?.poolXp ?? 0);
  el('proposal-edit-status').textContent = '';
  renderItems();
  el<HTMLDialogElement>('session-proposal-editor').showModal();
}

async function searchCatalog(after: number) {
  const owner = opened,
    request = ++catalogRequest;
  if (!owner || !catalogCurrent()) return;
  const status = el('proposal-catalog-status');
  status.textContent = 'Katalog wird geladen…';
  el<HTMLButtonElement>('proposal-catalog-find').disabled = true;
  el<HTMLButtonElement>('proposal-catalog-next').disabled = true;
  try {
    const response = await window.campaign.itemDefinitions({
      search: el<HTMLInputElement>('proposal-catalog-search').value,
      category: '',
      magic: el<HTMLSelectElement>('proposal-catalog-magic').value as '' | 'yes',
      rarity: el<HTMLSelectElement>('proposal-catalog-rarity').value,
      attunement: '',
      sort: 'name',
      direction: 'asc',
      after,
      includeTrashed: false,
    });
    if (opened !== owner || request !== catalogRequest || !catalogCurrent() || busy) return;
    if (!response.ok) throw new Error(response.error);
    const page = response.value,
      root = el('proposal-catalog-results');
    if (!after) root.replaceChildren();
    for (const d of page.items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = d.name + (d.magic ? ' · ' + (d.rarity || 'Seltenheit unbekannt') : '');
      button.onclick = () => {
        if (opened !== owner || request !== catalogRequest || !catalogCurrent() || busy) return;
        items.push({
          name: d.name,
          quantity: '1',
          category: d.category,
          valueGold:
            d.unitCopper === null
              ? '0'
              : String(BigInt(d.unitCopper) / 100n) +
                '.' +
                String(BigInt(d.unitCopper) % 100n).padStart(2, '0'),
          reference: {
            kind: 'authored',
            definitionId: d.id,
            revision: d.revision,
          },
        });
        renderItems();
        status.textContent = d.name + ' zur geplanten Belohnung ergänzt.';
      };
      root.append(button);
    }
    catalogNext = page.next;
    el('proposal-catalog-next').hidden = catalogNext === null;
    status.textContent =
      page.total + ' Treffer' + (page.problems.length ? ' · ' + page.problems.join(' ') : '');
  } catch (error) {
    if (opened === owner && request === catalogRequest && catalogCurrent())
      status.textContent = (error as Error).message;
  } finally {
    if (opened === owner && request === catalogRequest) {
      el<HTMLButtonElement>('proposal-catalog-find').disabled = false;
      el<HTMLButtonElement>('proposal-catalog-next').disabled = false;
    }
  }
}
