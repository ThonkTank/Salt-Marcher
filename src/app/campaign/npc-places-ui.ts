import { chooseNpcBuilding } from './npc-building-ui';
import type { NpcPlaceChoice } from './npc-places-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
export async function chooseNpcPlace(token: string, id: string): Promise<NpcPlaceChoice | null> {
  const dialog = node('dialog'),
    status = node('p', 'Schauplätze werden gelesen…'),
    list = node('div'),
    more = node('button', 'Weitere 40 Schauplätze'),
    close = node('button', 'Zurück');
  dialog.id = 'npc-places';
  dialog.className = 'location-group-roster';
  dialog.setAttribute('aria-label', 'NSC-Schauplätze');
  status.setAttribute('role', 'status');
  list.id = 'npc-places-list';
  more.type = close.type = 'button';
  more.hidden = true;
  const actions = node('div');
  actions.className = 'toolbar';
  for (const [role, title] of [
    ['home', 'Wohnhaus wählen / wechseln…'],
    ['work', 'Arbeitsplatz wählen / wechseln…'],
  ] as const) {
    const b = node('button', title);
    b.type = 'button';
    b.dataset.npcBinding = role;
    actions.append(b);
  }
  dialog.append(
    close,
    status,
    actions,
    node(
      'p',
      'Wohn- und Arbeitsorte sind Bindungen der Stadt. Der Dungeonraum ist die aktuelle Feinposition. Öffnen bewegt weder NSC noch Gruppe.',
    ),
    list,
    more,
  );
  document.body.append(dialog);
  return new Promise((resolve) => {
    let closed = false,
      next: number | null = null,
      busy = false;
    const finish = (site: NpcPlaceChoice | null) => {
      if (closed) return;
      closed = true;
      dialog.close();
      dialog.remove();
      resolve(site);
    };
    close.onclick = () => finish(null);
    dialog.oncancel = (e) => {
      e.preventDefault();
      finish(null);
    };
    for (const b of actions.querySelectorAll<HTMLButtonElement>('button'))
      b.onclick = () => {
        b.disabled = true;
        void chooseNpcBuilding(token, id, b.dataset.npcBinding as 'home' | 'work')
          .then((choice) => {
            if (choice && !closed) finish(choice);
          })
          .finally(() => {
            b.disabled = false;
          });
      };
    const load = async (offset: number) => {
      if (busy) return;
      busy = true;
      more.disabled = true;
      try {
        const result = await window.campaign.npcPlaces(token, id, offset);
        if (closed) return;
        if (!result.ok) throw new Error(result.error);
        const page = result.value;
        if (page.npcId !== id) throw new Error('NSC-Auswahl geändert.');
        status.textContent = page.name + ' · Weltstandort: ' + page.locationTitle;
        for (const site of page.sites) {
          const row = node('article'),
            button = node('button', site.title + ' · ' + site.detail);
          row.className = 'location-group-member';
          row.dataset.siteId = site.id;
          button.type = 'button';
          button.disabled = !site.available;
          button.onclick = () => finish(site);
          row.append(button);
          if (!site.available)
            row.append(
              node('p', 'Schauplatz derzeit nicht verfügbar. Die Bindung bleibt erhalten.'),
            );
          list.append(row);
        }
        if (!offset && !page.sites.length)
          list.append(
            node(
              'p',
              'Noch keine Schauplätze gebunden. Wohnhaus oder Arbeitsplatz hier auswählen; Häuser zuvor im Stadtbereich zeichnen.',
            ),
          );
        next = page.next;
        more.hidden = next === null;
      } catch (e) {
        if (!closed) status.textContent = (e as Error).message;
      } finally {
        busy = false;
        more.disabled = false;
      }
    };
    more.onclick = () => {
      if (next !== null) void load(next);
    };
    dialog.showModal();
    void load(0);
  });
}
