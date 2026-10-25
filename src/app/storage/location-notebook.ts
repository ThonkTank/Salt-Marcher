import type {
  LocationMaterial,
  LocationMaterialsQuery,
  LocationMaterialsPage,
} from '../campaign/location-notebook-contracts';
import { calendarDate } from '../runtime/world-model';
import { calendarEvents } from './calendar-events';
import { readWorldCalendar } from './world';
import { readWorldSources } from './world-sources';
import { deskContent } from './scene-desk';
import { readNarrative } from './narrative';
import { readPreparedGroup } from './session';
import { readShop, shopRecord } from './items';
import { npcPositionReader, npcIdsAtLocation } from './npc-world';
function locationContent(db: any, cam: string, id: string) {
  const content = deskContent(db, cam, { kind: 'location', id });
  if (content.unavailable) throw new Error('Ort im Papierkorb. Material bleibt erhalten.');
  if (content.location?.id !== id) throw new Error('Ortsmaterialquelle beschädigt.');
  return content;
}
export function readLocationMaterials(
  db: any,
  cam: string,
  q: LocationMaterialsQuery,
): LocationMaterialsPage {
  if (
    !q ||
    (q.scope !== undefined && !['location', 'campaign'].includes(q.scope)) ||
    (q.scope === 'campaign' && !['npc', 'narrative', 'shop', 'group'].includes(q.kind)) ||
    !['directory', 'npc', 'narrative', 'group', 'shop', 'faction', 'event'].includes(q.kind) ||
    typeof q.text !== 'string' ||
    q.text.length > 1000 ||
    !Number.isSafeInteger(q.offset) ||
    q.offset < 0 ||
    q.offset > 1000000 ||
    (q.kind !== 'directory' &&
      (typeof q.locationId !== 'string' || !q.locationId || q.locationId.length > 1000))
  )
    throw new Error('Ortsmaterialsuche prüfen.');
  const location = q.kind === 'directory' ? null : locationContent(db, cam, q.locationId!),
    items: LocationMaterial[] = [],
    text = q.text.toLocaleLowerCase();
  const all = q.scope === 'campaign',
    placeName = (id: string | null | undefined) =>
      id ? deskContent(db, cam, { kind: 'location', id }).title : 'Ohne Ortsbindung';
  const add = (item: LocationMaterial) => {
    if ((item.title + '\n' + item.detail).toLocaleLowerCase().includes(text)) items.push(item);
  };
  if (q.kind === 'directory') {
    for (const row of db
      .prepare('SELECT id FROM location WHERE campaign_id=? AND trashed=0')
      .iterate(cam)) {
      const content = locationContent(db, cam, row.id);
      add({
        id: row.id,
        title: content.title,
        detail: content.location!.type === 'city' ? 'Stadt' : 'Interessanter Ort',
        ref: { kind: 'location', id: row.id },
      });
    }
  } else if (q.kind === 'event') {
    const calendar = readWorldCalendar(db, cam);
    for (const event of calendarEvents(db, cam))
      if (!event.trashed && event.locationId === q.locationId)
        add({
          id: event.id,
          title: event.name,
          detail:
            (event.repeatMs === null ? 'Einmaliges Ereignis' : 'Wiederkehrendes Ereignis') +
            ' · Ab ' +
            calendarDate(calendar, event.startMs),
        });
  } else if (q.kind === 'npc') {
    const ids = all
        ? db.prepare('SELECT id FROM world_note WHERE campaign_id=? AND trashed=0').iterate(cam)
        : [...npcIdsAtLocation(db, cam, q.locationId!)].map((id) => ({ id })),
      position = npcPositionReader(db, cam);
    for (const { id } of ids) {
      const content = deskContent(db, cam, { kind: 'note', id });
      if (content.note?.kind !== 'npc') {
        if (all) continue;
        throw new Error('Ortsmaterialquelle beschädigt.');
      }
      if (content.unavailable) continue;
      const locationId = all ? position(id).locationId : q.locationId;
      add({
        id,
        title: content.title,
        detail: all ? 'NSC · ' + placeName(locationId) : 'NSC am Ort',
        ...(all ? { locationId } : {}),
        ref: { kind: 'note', id },
      });
    }
  } else if (q.kind === 'narrative') {
    for (const row of db
      .prepare('SELECT id FROM world_note WHERE campaign_id=? AND trashed=0')
      .iterate(cam)) {
      const content = deskContent(db, cam, { kind: 'note', id: row.id });
      if (!['quest', 'rumor'].includes(content.note?.kind ?? '')) continue;
      const view = readNarrative(db, cam, row.id);
      if (!all && view.state.locationId !== q.locationId) continue;
      add({
        id: row.id,
        title: content.title,
        detail:
          (view.state.status === 'closed' ? 'Abgeschlossen' : 'Offen') +
          (all ? ' · ' + placeName(view.state.locationId) : ''),
        locationId: view.state.locationId ?? null,
        ref: { kind: 'note', id: row.id },
      });
    }
  } else if (q.kind === 'group') {
    const rows = all
      ? db.prepare('SELECT id FROM prepared_group WHERE campaign_id=?').iterate(cam)
      : db
          .prepare('SELECT id FROM prepared_group WHERE campaign_id=? AND location_id=?')
          .iterate(cam, q.locationId);
    for (const row of rows) {
      const group = readPreparedGroup(db, cam, row.id);
      add({
        id: group.id,
        title: group.title,
        detail: group.actors.length + ' Figuren' + (all ? ' · ' + placeName(group.locationId) : ''),
        locationId: group.locationId,
      });
    }
  } else if (q.kind === 'faction') {
    const source = readWorldSources(db, cam).sources.find(
      (entry) => entry.kind === 'location' && entry.id === q.locationId,
    );
    for (const id of source?.factionIds ?? []) {
      const content = deskContent(db, cam, { kind: 'note', id });
      if (content.note?.kind !== 'faction') throw new Error('Ortsmaterialquelle beschädigt.');
      if (!content.unavailable)
        add({ id, title: content.title, detail: 'Fraktion am Ort', ref: { kind: 'note', id } });
    }
  } else {
    let npcs: Set<string> | undefined;
    for (const row of db.prepare('SELECT id FROM shop WHERE campaign_id=?').iterate(cam)) {
      const shop = shopRecord(db, cam, row.id);
      if (
        shop.trashed ||
        (!all &&
          (shop.owner.kind === 'location'
            ? shop.owner.id !== q.locationId
            : !(npcs ??= npcIdsAtLocation(db, cam, q.locationId!)).has(shop.owner.id)))
      )
        continue;
      const view = readShop(db, cam, shop.id);
      if (!view.unavailable || all)
        add({
          id: shop.id,
          title: shop.name,
          detail:
            'Shop · ' +
            (all ? (shop.owner.kind === 'npc' ? 'NSC: ' : 'Ort: ') : '') +
            view.ownerName,
          ...(all ? { locationId: shop.owner.kind === 'location' ? shop.owner.id : null } : {}),
        });
    }
  }
  items.sort(
    (a, b) =>
      a.title.toLocaleLowerCase().localeCompare(b.title.toLocaleLowerCase()) ||
      a.id.localeCompare(b.id),
  );
  return {
    locationRevision: location?.revision ?? null,
    next: items.length > q.offset + 40 ? q.offset + 40 : null,
    items: items.slice(q.offset, q.offset + 40),
  };
}
