import type { DungeonView, DungeonAction } from '../atlas/dungeon-contracts';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
export function drawDungeonContents(
  data: DungeonView,
  send: (action: DungeonAction) => void,
  openCombat: (id: string) => void,
) {
  const list = el('dungeon-content-contexts');
  list.replaceChildren();
  if (!data.sceneId) return;
  for (const c of data.contents ?? []) {
    const card = document.createElement('article'),
      heading = document.createElement('h3'),
      status = document.createElement('p'),
      publicText = document.createElement('pre'),
      details = document.createElement('details'),
      summary = document.createElement('summary'),
      notes = document.createElement('pre');
    heading.textContent = c.name + ' · ' + c.kind;
    status.textContent =
      (c.known ? 'Für die Gruppe bekannt' : 'Noch nicht für die Gruppe bestätigt') +
      ' · ' +
      (c.visible ? 'aktuell wahrnehmbar' : 'außer aktueller Sicht') +
      (c.referenceTitle ? ' · ' + c.referenceTitle : '') +
      (c.problem ? ' · ' + c.problem : '');
    publicText.textContent = c.publicText;
    summary.textContent = 'Private Bedienung / Lösung / Suchhinweise';
    notes.textContent = [
      c.gmNotes,
      c.search.method,
      c.search.dc === null ? '' : 'Such-DC ' + c.search.dc,
      c.search.notes,
    ]
      .filter(Boolean)
      .join('\n\n');
    details.append(summary, notes);
    card.append(heading, status, publicText, details);
    if (c.reason) {
      const reason = document.createElement('p');
      reason.textContent = c.reason;
      card.append(reason);
    }
    const discover = document.createElement('button');
    discover.textContent = c.known
      ? 'Für Gruppe wieder verbergen'
      : 'Entdeckung für Gruppe bestätigen';
    discover.onclick = () =>
      send({
        kind: 'content-discovery',
        sceneId: data.sceneId!,
        featureId: c.id,
        expectedRevision: c.revision,
        known: !c.known,
      });
    const close = document.createElement('button');
    close.textContent = 'Kontext schließen / Reise fortsetzen';
    close.onclick = () =>
      send({ kind: 'content-dismiss', sceneId: data.sceneId!, featureId: c.id });
    card.append(discover, close);
    if (c.kind === 'encounter') {
      const bind = document.createElement('button');
      bind.textContent = c.groupId
        ? 'Vorhandene NPC-Gruppe gebunden'
        : 'NPC-Gruppe einmalig binden';
      bind.disabled = !!c.groupId || !c.pose;
      bind.onclick = () =>
        send({
          kind: 'content-bind',
          sceneId: data.sceneId!,
          featureId: c.id,
          expectedRevision: c.revision,
        });
      const begin = document.createElement('button');
      begin.textContent = c.combatId
        ? 'Kampf mit aktuellen Actors öffnen / beginnen'
        : 'Kampf mit vorhandenen Actors beginnen';
      begin.disabled = !c.pose || !!c.problem || (!!c.groupId && !c.aliveActors);
      begin.onclick = () =>
        send({
          kind: 'content-combat',
          sceneId: data.sceneId!,
          featureId: c.id,
          expectedRevision: c.revision,
          expectedGroupRevision: c.groupRevision,
        });
      card.append(bind, begin);
      if (c.groupId) {
        const actors = document.createElement('p');
        actors.textContent = c.aliveActors + ' lebende Actors · persistente NPC-Gruppe';
        card.append(actors);
      }
      if (c.combatId) {
        const open = document.createElement('button');
        open.textContent = 'Zum zugehörigen Kampf';
        open.onclick = () => openCombat(c.combatId!);
        card.append(open);
      }
    }
    if (c.kind === 'loot') {
      const items = document.createElement('div');
      for (const item of c.items) {
        const row = document.createElement('fieldset'),
          legend = document.createElement('legend'),
          quantity = document.createElement('input'),
          recipient = document.createElement('select'),
          allocate = document.createElement('button'),
          available = Math.max(0, item.quantity - item.allocated);
        legend.textContent = item.name + ' · ' + available + ' verfügbar';
        quantity.type = 'number';
        quantity.min = '1';
        quantity.max = String(available);
        quantity.value = '1';
        quantity.setAttribute('aria-label', item.name + ' Menge');
        for (const r of data.contentRecipients ?? []) {
          const o = document.createElement('option');
          o.value = r.id;
          o.textContent = r.name;
          recipient.append(o);
        }
        allocate.textContent = 'Aus vorhandenem Loot übergeben';
        allocate.disabled = !available || !c.known || c.treasureRevision === null;
        allocate.onclick = () => {
          const r = data.contentRecipients?.find((r) => r.id === recipient.value);
          if (!r || !item.currentDefinition) return;
          send({
            kind: 'content-allocate',
            sceneId: data.sceneId!,
            featureId: c.id,
            expectedRevision: c.revision,
            treasureRevision: c.treasureRevision!,
            definitionRevision: item.currentDefinition.revision,
            itemId: item.id,
            quantity: Number(quantity.value),
            characterId: r.id,
            membershipRevision: r.membershipRevision,
          });
        };
        row.append(legend, quantity, recipient, allocate);
        items.append(row);
      }
      card.append(items);
    }
    list.append(card);
  }
}
