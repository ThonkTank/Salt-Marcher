import type { GroupView } from './groups-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
type GroupChoice = { kind: 'edit' | 'bind' } | { kind: 'npc' | 'places'; id: string };
/** Reads the existing group owner; opening a roster has no world effect. */
export async function showLocationGroup(
  token: string,
  id: string,
  targetTitle: string,
): Promise<GroupChoice | null> {
  const dialog = node('dialog'),
    status = node('p'),
    content = node('div');
  dialog.id = 'location-group-roster';
  dialog.className = 'location-group-roster';
  dialog.setAttribute('aria-label', 'Figurengruppe am Ort');
  status.setAttribute('role', 'status');
  status.textContent = 'Gruppe wird gelesen…';
  dialog.append(status, content);
  document.body.append(dialog);
  return new Promise((resolve) => {
    let closed = false;
    const finish = (value: GroupChoice | null) => {
      if (closed) return;
      closed = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    const button = (title: string, choice: GroupChoice | null) => {
      const b = node('button', title);
      b.type = 'button';
      b.onclick = () => finish(choice);
      return b;
    };
    dialog.prepend(button('Zur Ortsmappe', null));
    dialog.oncancel = (e) => {
      e.preventDefault();
      finish(null);
    };
    dialog.showModal();
    void window.campaign
      .groupView(token, id)
      .then((result) => {
        if (closed) return;
        if (!result.ok) throw new Error(result.error);
        const group: GroupView = result.value;
        if (group.id !== id) throw new Error('Gruppenkennung hat sich geändert.');
        status.textContent =
          group.title +
          ' · ' +
          group.actors.length +
          ' Figuren · ' +
          (group.locationTitle ?? 'Gruppenstandort');
        const actions = node('div');
        actions.className = 'toolbar';
        actions.append(
          button('Gruppenbereich öffnen…', { kind: 'edit' }),
          button('Gruppenort für „' + targetTitle + '“ vorbereiten…', { kind: 'bind' }),
        );
        content.append(
          actions,
          node(
            'p',
            'Ortswechsel wird erst im Gruppenbereich bestätigt und versetzt alle enthaltenen NSCs. Einzelstandorte und HP stammen aus dem aktuellen Weltstand.',
          ),
        );
        const list = node('div'),
          more = node('button', 'Weitere 25 Figuren');
        list.id = 'location-group-members';
        more.type = 'button';
        let count = 0;
        const show = () => {
          const end = Math.min(count + 25, group.actors.length);
          for (; count < end; count++) {
            const actor = group.actors[count]!,
              row = node('article');
            row.dataset.actorId = actor.id;
            row.className = 'location-group-member';
            row.append(
              node('h4', actor.name),
              node(
                'p',
                actor.hp +
                  ' / ' +
                  actor.maxHp +
                  ' HP' +
                  (actor.tempHp ? ' · ' + actor.tempHp + ' temporär' : '') +
                  (actor.conditions ? ' · ' + actor.conditions : '') +
                  (actor.concentrating ? ' · Konzentration' : ''),
              ),
              node('p', actor.locationTitle ?? 'Standort nicht gelesen'),
            );
            if (actor.unavailable) row.append(node('p', 'Weltprofil nicht verfügbar'));
            else
              row.append(
                button('Weltprofil: ' + actor.name + '…', { kind: 'npc', id: actor.id }),
                button('Schauplätze: ' + actor.name + '…', { kind: 'places', id: actor.id }),
              );
            list.append(row);
          }
          more.hidden = count >= group.actors.length;
        };
        more.onclick = show;
        content.append(list, more);
        if (!group.actors.length)
          list.append(node('p', 'Noch keine Figuren. Im Gruppenbereich Kreaturen hinzufügen.'));
        show();
      })
      .catch((e) => {
        if (!closed) status.textContent = (e as Error).message;
      });
  });
}
