import type {
  CityActivityPage,
  CityActivityQuery,
  CityActivitySite,
} from '../city-activity-contracts';
import { readCityHeader, readCitySite } from './city';
import { readLive, readLiveScene } from './live';
import { readNpcPlanLocation } from './npc-daily-places';
import { readNpc } from './npcs';
import { readNpcPlaces } from './npc-places';
import { readWorldCalendar } from './world';
import { calendarDate } from '../world-model';
import { dailyPlanAt, dailyTime } from '../npc-daily-plan';
export function readCityActivities(db: any, cam: string, q: CityActivityQuery): CityActivityPage {
  if (
    !q ||
    typeof q.cityId !== 'string' ||
    !q.cityId ||
    !(q.sceneId === null || typeof q.sceneId === 'string') ||
    typeof q.focusFallback !== 'boolean' ||
    !(q.unitId === null || typeof q.unitId === 'string') ||
    typeof q.text !== 'string' ||
    q.text.length > 1000 ||
    !Number.isSafeInteger(q.offset) ||
    q.offset < 0 ||
    q.offset > 1000000
  )
    throw new Error('Stadtaktivitäten: Auswahl prüfen.');
  const city = readCityHeader(db, cam, q.cityId);
  if (q.unitId && readCitySite(db, cam, q.cityId, q.unitId).unit.kind !== 'building')
    throw new Error('Für den Hausfilter ein Haus wählen.');
  const live = readLive(db, cam),
    sceneId = q.sceneId ?? (q.focusFallback ? live.focusId : null),
    scenes = live.scenes.map((s) => ({ id: s.id, title: s.title })),
    empty = (sceneTitle: string, date: string): CityActivityPage => ({
      cityId: city.id,
      cityRevision: city.revision,
      sceneId: null,
      sceneTitle,
      date,
      clockRevision: null,
      instantMs: null,
      scenes,
      rows: [],
      next: null,
    });
  if (sceneId && !scenes.some((s) => s.id === sceneId))
    return empty('Gewählte Gruppenuhr nicht mehr verfügbar', 'Eine andere Gruppenuhr auswählen.');
  if (!sceneId)
    return empty(
      q.focusFallback ? 'Noch keine aktive Gruppe' : 'Keine Gruppenuhr ausgewählt',
      scenes.length
        ? 'Eine Gruppenuhr auswählen.'
        : 'Zuerst eine Gruppe unter Welt und Spielabend anlegen.',
    );
  const scene = readLiveScene(db, cam, sceneId),
    calendar = readWorldCalendar(db, cam);
  const ids = db
    .prepare(
      `SELECT n.id FROM world_note n LEFT JOIN npc_record r ON r.campaign_id=n.campaign_id AND r.id=n.id
 WHERE n.campaign_id=@cam AND n.trashed=0 AND json_extract(n.payload,'$.kind')='npc' AND n.id IN(
 SELECT value FROM city_unit u,json_each(u.payload,'$.residentIds') WHERE u.campaign_id=@cam AND u.city_id=@city AND (@unit IS NULL OR u.id=@unit)
 UNION SELECT value FROM city_unit u,json_each(u.payload,'$.workerIds') WHERE u.campaign_id=@cam AND u.city_id=@city AND (@unit IS NULL OR u.id=@unit)) AND (
 instr(lower(json_extract(n.payload,'$.title')),lower(@text))>0
 OR EXISTS(SELECT 1 FROM json_each(r.payload,'$.dailyPlan') p WHERE instr(lower(coalesce(json_extract(p.value,'$.activity'),'')||char(10)||coalesce(json_extract(p.value,'$.notes'),'')),lower(@text))>0)
 OR EXISTS(SELECT 1 FROM json_each(r.payload,'$.dailyOverrides') o WHERE instr(lower(coalesce(json_extract(o.value,'$.label'),'')),lower(@text))>0 OR EXISTS(SELECT 1 FROM json_each(o.value,'$.slots') p WHERE instr(lower(coalesce(json_extract(p.value,'$.activity'),'')||char(10)||coalesce(json_extract(p.value,'$.notes'),'')),lower(@text))>0)))
 ORDER BY CASE
 WHEN @text<>'' AND lower(json_extract(n.payload,'$.title'))=lower(@text) THEN 0
 WHEN @text<>'' AND instr(lower(json_extract(n.payload,'$.title')),lower(@text))=1 THEN 1
 WHEN @text<>'' AND instr(lower(json_extract(n.payload,'$.title')),lower(@text))>0 THEN 2
 ELSE 3 END,json_extract(n.payload,'$.title') COLLATE NOCASE,n.id LIMIT 41 OFFSET @offset`,
    )
    .all({ cam, city: city.id, unit: q.unitId, text: q.text, offset: q.offset });
  const rows = ids.slice(0, 40).map((row: any) => {
    const npc = readNpc(db, cam, row.id),
      places = readNpcPlaces(db, cam, row.id, 0),
      plan = dailyPlanAt(
        npc.record.dailyPlan,
        scene.clock.instantMs,
        calendar.daySeconds,
        calendar.weekdays.length,
        npc.record.dailyOverrides,
      );
    const site = (role: 'home' | 'work'): CityActivitySite | null => {
        const s = places.sites.find((s) => s.kind === role);
        return s && s.kind !== 'dungeon'
          ? {
              cityId: s.cityId,
              unitId: s.unitId,
              title: s.title,
              detail: s.detail.slice(0, 600),
              available: s.available,
            }
          : null;
      },
      home = site('home'),
      work = site('work');
    return {
      id: npc.id,
      name: npc.name,
      defeated: npc.record.lifecycle === 'defeated',
      actualLocation: places.locationTitle,
      actualRoom: places.sites.find((s) => s.kind === 'dungeon')?.title ?? null,
      atCityLocation: npc.locationId === city.locationId,
      home,
      work,
      current: plan.current
        ? {
            activity: plan.current.activity,
            time: dailyTime(plan.current.startMinute) + '–' + dailyTime(plan.current.endMinute),
            place: plan.current.place,
            locationTarget:
              plan.current.place === 'location'
                ? readNpcPlanLocation(db, cam, plan.current.locationId!)
                : null,
            notes: plan.current.notes.slice(0, 600),
            target:
              plan.current.place === 'home' ? home : plan.current.place === 'work' ? work : null,
          }
        : null,
      next:
        plan.next && plan.nextInstantMs
          ? { activity: plan.next.activity, date: calendarDate(calendar, plan.nextInstantMs) }
          : null,
      overrideLabel: plan.overrideLabel,
      problem: plan.problem,
    };
  });
  return {
    cityId: city.id,
    cityRevision: city.revision,
    sceneId: scene.id,
    sceneTitle: scene.title,
    date: calendarDate(calendar, scene.clock.instantMs),
    clockRevision: scene.clock.revision,
    instantMs: scene.clock.instantMs,
    scenes,
    rows,
    next: ids.length > 40 ? q.offset + 40 : null,
  };
}
