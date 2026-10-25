// Device-local calculator inputs, never party facts or calculated results.
export interface DayItineraryDraft {
  enabled: boolean;
  selected: {
    id: string;
    revision: number;
    name: string;
    count: string;
    restBefore?: 'short' | 'long';
  }[];
  manual: { load: string; reward: string; separate: boolean };
}
export interface DayDraft {
  version: 1;
  source: 'active' | 'custom';
  mode: 'budget' | 'progress';
  // Retain the comparison rows while displaying the active party. Optional for
  // older drafts; the flag distinguishes an intentionally empty plan.
  hasCustomRows?: boolean;
  rows: { level: string; count: string }[];
  itinerary: DayItineraryDraft;
}
export const dayDraftKey = (campaignId: string) =>
  'dungeon-editor:day-draft:v1:' + encodeURIComponent(campaignId);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length <= 1000;
export function readDayDraft(raw: string): DayDraft {
  if (raw.length > 100000) throw new Error('Rechnerentwurf zu groß.');
  const d: unknown = JSON.parse(raw);
  if (
    !object(d) ||
    d.version !== 1 ||
    !['active', 'custom'].includes(String(d.source)) ||
    !['budget', 'progress'].includes(String(d.mode)) ||
    (d.hasCustomRows !== undefined && typeof d.hasCustomRows !== 'boolean') ||
    !Array.isArray(d.rows) ||
    d.rows.length > 20 ||
    !d.rows.every((r) => object(r) && text(r.level) && text(r.count)) ||
    !object(d.itinerary)
  )
    throw new Error('Rechnerentwurf nicht lesbar.');
  const i = d.itinerary,
    m = i.manual;
  if (
    typeof i.enabled !== 'boolean' ||
    !object(m) ||
    !text(m.load) ||
    !text(m.reward) ||
    typeof m.separate !== 'boolean' ||
    !Array.isArray(i.selected) ||
    i.selected.length > 20 ||
    !i.selected.every(
      (p) =>
        object(p) &&
        text(p.id) &&
        p.id.length > 0 &&
        text(p.name) &&
        text(p.count) &&
        Number.isSafeInteger(p.revision) &&
        Number(p.revision) > 0 &&
        (p.restBefore === undefined || p.restBefore === 'short' || p.restBefore === 'long'),
    )
  )
    throw new Error('Rechnerentwurf nicht lesbar.');
  return d as unknown as DayDraft;
}
