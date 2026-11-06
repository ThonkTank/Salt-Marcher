import type { NpcBuildingAssignment } from './npc-places-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
export function chooseNpcBuilding(
  token: string,
  npcId: string,
  role: 'home' | 'work',
): Promise<NpcBuildingAssignment | null> {
  const dialog = node('dialog'),
    heading = node('h3', role === 'home' ? 'Wohnhaus wählen' : 'Arbeitsplatz wählen'),
    status = node('p'),
    search = node('input'),
    record = node('input'),
    list = node('div'),
    more = node('button', 'Weitere 40 Häuser'),
    cancel = node('button', 'Abbrechen');
  dialog.id = 'npc-building-picker';
  dialog.className = 'location-group-roster';
  heading.id = 'npc-building-heading';
  dialog.setAttribute('aria-labelledby', heading.id);
  search.type = 'search';
  search.id = 'npc-building-search';
  search.placeholder = 'Name des Hauses oder der Stadt';
  const searchLabel = node('label', 'Haus oder Stadt suchen');
  searchLabel.append(search);
  record.id = 'npc-building-record-name';
  record.maxLength = 1000;
  const label = node(
    'label',
    role === 'home' ? 'Neuer Haushaltsname (optional)' : 'Neuer Beruf (optional)',
  );
  label.append(record);
  more.type = cancel.type = 'button';
  more.hidden = true;
  list.id = 'npc-building-results';
  status.setAttribute('role', 'status');
  dialog.append(
    heading,
    status,
    searchLabel,
    label,
    node(
      'p',
      'Auswahl öffnet das Haus mit vorbereiteter Personenbindung im Stadtinspektor. Dort speichern oder weiter bearbeiten. Beim Stadtwechsel wird die bisherige Bindung gemeinsam mit der neuen gespeichert.',
    ),
    list,
    more,
    cancel,
  );
  document.body.append(dialog);
  return new Promise((resolve) => {
    let ended = false,
      request = 0,
      next: number | null = null,
      timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (choice: NpcBuildingAssignment | null) => {
      if (ended) return;
      ended = true;
      request++;
      if (timer) clearTimeout(timer);
      dialog.close();
      dialog.remove();
      resolve(choice);
    };
    cancel.onclick = () => finish(null);
    dialog.oncancel = (e) => {
      e.preventDefault();
      finish(null);
    };
    const load = async (offset: number) => {
      const n = ++request;
      if (!offset) list.replaceChildren(node('p', 'Häuser werden gelesen…'));
      more.hidden = true;
      try {
        const result = await window.campaign.npcBuildingChoices(token, npcId, {
          role,
          text: search.value,
          offset,
        });
        if (ended || n !== request) return;
        if (!result.ok) throw new Error(result.error);
        const data = result.value;
        status.textContent =
          data.name +
          (data.currentCityTitle
            ? ' · Bisherige Bindung in ' + data.currentCityTitle + ' · Alle Städte zur Wahl'
            : ' · Noch keine solche Gebäudebindung');
        if (!offset) list.replaceChildren();
        for (const item of data.items) {
          const b = node('button', item.title + ' · ' + item.cityTitle);
          b.type = 'button';
          b.dataset.buildingId = item.unitId;
          b.onclick = () =>
            finish({
              kind: 'assign',
              role,
              npcId,
              cityId: item.cityId,
              unitId: item.unitId,
              recordName: record.value,
              ...(data.currentBinding ? { from: data.currentBinding } : {}),
            });
          list.append(b);
        }
        if (!offset && !data.items.length)
          list.append(node('p', 'Keine passenden Häuser. Häuser zuerst im Stadtbereich zeichnen.'));
        next = data.next;
        more.hidden = next === null;
      } catch (e) {
        if (!ended && n === request) {
          status.textContent = (e as Error).message;
          list.replaceChildren();
        }
      }
    };
    search.oninput = () => {
      request++;
      if (timer) clearTimeout(timer);
      list.replaceChildren(node('p', 'Häuser werden gesucht…'));
      more.hidden = true;
      timer = setTimeout(() => {
        timer = null;
        void load(0);
      }, 180);
    };
    more.onclick = () => {
      if (next !== null) void load(next);
    };
    dialog.showModal();
    search.focus();
    void load(0);
  });
}
