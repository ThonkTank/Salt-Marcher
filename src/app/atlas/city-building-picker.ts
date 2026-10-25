import type { CityBuildingChoice } from './city-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
export function chooseCityBuilding(
  token: string,
  title: string,
  excludeUnitId: string,
): Promise<CityBuildingChoice | null> {
  const dialog = node('dialog'),
    heading = node('h3', title),
    status = node('p'),
    search = node('input'),
    list = node('div'),
    more = node('button', 'Weitere 40 Häuser'),
    cancel = node('button', 'Abbrechen');
  dialog.id = 'city-building-picker';
  dialog.className = 'location-group-roster';
  heading.id = 'city-building-heading';
  dialog.setAttribute('aria-labelledby', heading.id);
  search.type = 'search';
  search.id = 'city-building-search';
  search.placeholder = 'Name des Hauses oder der Stadt';
  const label = node('label', 'Zielhaus oder Stadt suchen');
  label.append(search);
  list.id = 'city-building-results';
  status.setAttribute('role', 'status');
  more.type = cancel.type = 'button';
  more.hidden = true;
  dialog.append(
    heading,
    node(
      'p',
      'Wähle ein vorhandenes Haus. Danach prüfst du Quelle, Ziel und Mitglieder vor dem gemeinsamen Umzug.',
    ),
    status,
    label,
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
    const finish = (choice: CityBuildingChoice | null) => {
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
      more.hidden = true;
      if (!offset) list.replaceChildren(node('p', 'Häuser werden gelesen…'));
      try {
        const r = await window.campaign.cityBuildings(token, {
          text: search.value,
          offset,
          excludeUnitId,
        });
        if (ended || n !== request) return;
        if (!r.ok) throw new Error(r.error);
        if (!offset) list.replaceChildren();
        for (const item of r.value.items) {
          const b = node('button', item.title + ' · ' + item.cityTitle);
          b.type = 'button';
          b.dataset.buildingId = item.unitId;
          b.onclick = () => finish(item);
          list.append(b);
        }
        if (!offset && !r.value.items.length)
          list.append(node('p', 'Keine passenden Häuser. Häuser zuerst im Stadtbereich zeichnen.'));
        next = r.value.next;
        more.hidden = next === null;
        status.textContent = 'Häuser aller Städte · ' + list.childElementCount + ' angezeigt';
      } catch (e) {
        if (!ended && n === request) {
          list.replaceChildren();
          status.textContent = (e as Error).message;
        }
      }
    };
    search.oninput = () => {
      request++;
      if (timer) clearTimeout(timer);
      more.hidden = true;
      list.replaceChildren(node('p', 'Häuser werden gesucht…'));
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
export function confirmCityLifeMove(
  title: string,
  source: string,
  target: string,
  members: string[],
): Promise<boolean> {
  const dialog = node('dialog'),
    heading = node('h3', title),
    accept = node('button', 'Gemeinsam umziehen'),
    cancel = node('button', 'Abbrechen'),
    list = node('ul');
  dialog.id = 'city-life-move-confirm';
  dialog.className = 'location-group-roster';
  heading.id = 'city-life-move-heading';
  dialog.setAttribute('aria-labelledby', heading.id);
  for (const member of members) list.append(node('li', member));
  accept.type = cancel.type = 'button';
  accept.id = 'city-life-move-accept';
  dialog.append(
    heading,
    node('p', 'Von: ' + source),
    node('p', 'Nach: ' + target),
    node(
      'p',
      members.length +
        ' NSC ziehen gemeinsam mit diesem Eintrag um. Ihre aktuelle Position und andere Wohn- oder Arbeitsbindungen bleiben bestehen.',
    ),
    list,
    accept,
    cancel,
  );
  document.body.append(dialog);
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(ok);
    };
    accept.onclick = () => finish(true);
    cancel.onclick = () => finish(false);
    dialog.oncancel = (e) => {
      e.preventDefault();
      finish(false);
    };
    dialog.showModal();
    accept.focus();
  });
}
