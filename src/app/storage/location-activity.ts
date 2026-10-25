import type {
  LocationActivityPage,
  LocationActivityQuery,
  LocationVisit,
} from '../campaign/location-activity-contracts';
import type { NpcDailySlot } from '../campaign/npc-contracts';
import { deskContent } from './scene-desk';
import { readLive, readLiveScene } from './live';
import { readWorldCalendar } from './world';
import { readNpc } from './npcs';
import { readNpcPlaces } from './npc-places';
import { readCityHeader } from './city';
import { calendarDate } from '../runtime/world-model';
import { checkedNpcSchedule, dailyPlanAt, dailyTime } from '../campaign/npc-daily-plan';
export function readLocationActivities(
  db: any,
  cam: string,
  q: LocationActivityQuery,
): LocationActivityPage {
  if (
    !q ||
    typeof q.locationId !== 'string' ||
    !q.locationId ||
    q.locationId.length > 1000 ||
    !(q.sceneId === null || (typeof q.sceneId === 'string' && !!q.sceneId)) ||
    typeof q.focusFallback !== 'boolean' ||
    typeof q.text !== 'string' ||
    q.text.length > 1000 ||
    !Number.isSafeInteger(q.offset) ||
    q.offset < 0 ||
    q.offset > 1000000
  )
    throw new Error('Ortsbesuche: Auswahl prüfen.');
  const location = deskContent(db, cam, { kind: 'location', id: q.locationId });
  if (location.unavailable || !location.location) throw new Error('Ort nicht verfügbar.');
  const live = readLive(db, cam),
    scenes = live.scenes.map((s) => ({ id: s.id, title: s.title })),
    sceneId = q.sceneId ?? (q.focusFallback ? live.focusId : null),
    base = { locationId: q.locationId, locationRevision: location.revision, scenes },
    empty = (sceneTitle: string, date: string): LocationActivityPage => ({
      ...base,
      sceneId: null,
      sceneTitle,
      date,
      rows: [],
      next: null,
    });
  if (sceneId && !scenes.some((s) => s.id === sceneId))
    return empty('Gewählte Gruppenuhr nicht mehr verfügbar', 'Eine andere Gruppenuhr auswählen.');
  if (!sceneId)
    return empty(
      'Gruppenuhr auswählen',
      scenes.length
        ? 'Eine verfügbare Gruppenuhr wählen.'
        : 'Zuerst eine Gruppe unter Welt und Spielabend anlegen.',
    );
  const scene = readLiveScene(db, cam, sceneId),
    calendar = readWorldCalendar(db, cam);
  // Select only IDs before reading canonical profiles. Home/work refer to the existing house bindings.
  const ids = db
    .prepare(
      `WITH slots AS (
 SELECT r.id npc_id,p.value slot FROM npc_record r,json_each(r.payload,'$.dailyPlan') p WHERE r.campaign_id=@cam
 UNION ALL SELECT r.id npc_id,p.value slot FROM npc_record r,json_each(r.payload,'$.dailyOverrides') o,json_each(o.value,'$.slots') p WHERE r.campaign_id=@cam
 ),houses AS (
 SELECT value npc_id,'home' role FROM city_unit u JOIN city_document c ON c.campaign_id=u.campaign_id AND c.id=u.city_id,json_each(u.payload,'$.residentIds') WHERE u.campaign_id=@cam AND c.location_id=@location AND u.kind='building'
 UNION SELECT value npc_id,'work' role FROM city_unit u JOIN city_document c ON c.campaign_id=u.campaign_id AND c.id=u.city_id,json_each(u.payload,'$.workerIds') WHERE u.campaign_id=@cam AND c.location_id=@location AND u.kind='building'
 ) SELECT n.id FROM world_note n WHERE n.campaign_id=@cam AND n.trashed=0 AND json_extract(n.payload,'$.kind')='npc' AND EXISTS(
 SELECT 1 FROM slots s WHERE s.npc_id=n.id AND (
 json_extract(s.slot,'$.place')='location' AND json_extract(s.slot,'$.locationId')=@location
 OR EXISTS(SELECT 1 FROM houses h WHERE h.npc_id=n.id AND h.role=json_extract(s.slot,'$.place'))
 ) AND (instr(lower(json_extract(n.payload,'$.title')),lower(@text))>0 OR instr(lower(coalesce(json_extract(s.slot,'$.activity'),'')||char(10)||coalesce(json_extract(s.slot,'$.notes'),'')),lower(@text))>0))
 ORDER BY CASE WHEN @text<>'' AND lower(json_extract(n.payload,'$.title'))=lower(@text) THEN 0 ELSE 1 END,json_extract(n.payload,'$.title') COLLATE NOCASE,n.id LIMIT 41 OFFSET @offset`,
    )
    .all({ cam, location: q.locationId, text: q.text, offset: q.offset });
  const rows = ids.slice(0, 40).map((row: any) => {
    const npc = readNpc(db, cam, row.id),
      places = readNpcPlaces(db, cam, row.id, 0),
      houses = new Map<'home' | 'work', NonNullable<LocationVisit['house']>>();
    for (const site of places.sites)
      if (
        site.kind !== 'dungeon' &&
        readCityHeader(db, cam, site.cityId).locationId === q.locationId
      )
        houses.set(site.kind, {
          cityId: site.cityId,
          unitId: site.unitId,
          title: site.title,
          detail: site.detail.slice(0, 600),
          available: site.available,
        });
    const matches = (slot: NpcDailySlot) =>
        slot.place === 'location'
          ? slot.locationId === q.locationId
          : slot.place !== 'other' && houses.has(slot.place),
      visit = (slot: NpcDailySlot): LocationVisit => ({
        activity: slot.activity,
        time: dailyTime(slot.startMinute) + '–' + dailyTime(slot.endMinute),
        notes: slot.notes.slice(0, 600),
        house:
          slot.place === 'home' || slot.place === 'work' ? (houses.get(slot.place) ?? null) : null,
      });
    let current: LocationVisit | null = null,
      next: (LocationVisit & { date: string }) | null = null,
      problem: string | null = null,
      overrideLabel: string | null = null;
    try {
      const plan = npc.record.dailyPlan ?? [],
        overrides = npc.record.dailyOverrides ?? [];
      checkedNpcSchedule(plan, overrides, calendar.daySeconds, calendar.weekdays.length);
      // Keep even empty overrides: a rest day cancels the previous night's carry and the regular plan.
      const projection = dailyPlanAt(
        plan.filter(matches),
        scene.clock.instantMs,
        calendar.daySeconds,
        calendar.weekdays.length,
        overrides.map((o) => ({ ...o, slots: o.slots.filter(matches) })),
      );
      problem = projection.problem;
      overrideLabel = projection.overrideLabel;
      current = projection.current ? visit(projection.current) : null;
      next =
        projection.next && projection.nextInstantMs
          ? { ...visit(projection.next), date: calendarDate(calendar, projection.nextInstantMs) }
          : null;
    } catch (e) {
      problem = (e as Error).message;
    }
    return {
      id: npc.id,
      name: npc.name,
      defeated: npc.record.lifecycle === 'defeated',
      actualLocation: places.locationTitle,
      actualRoom: places.sites.find((s) => s.kind === 'dungeon')?.title ?? null,
      atLocation: npc.locationId === q.locationId,
      current,
      next,
      overrideLabel,
      problem,
    };
  });
  return {
    ...base,
    sceneId: scene.id,
    sceneTitle: scene.title,
    date: calendarDate(calendar, scene.clock.instantMs),
    rows,
    next: ids.length > 40 ? q.offset + 40 : null,
  };
}
