export const chaseDraftFields = [
  'chase-name',
  'chase-side',
  'chase-speed',
  'chase-complication',
  'chase-outcome',
] as const;
export interface ChaseWorkingDraft {
  version: 1;
  writeId: string;
  chaseId: string;
  sceneId: string;
  revision: number;
  fields: Partial<Record<(typeof chaseDraftFields)[number], string>>;
  rows: { participantId: string; distance?: string; exhaustion?: string }[];
}
const id = (v: unknown) => typeof v === 'string' && !!v && v.length <= 1000;
export function checkedChaseDraft(d: ChaseWorkingDraft): ChaseWorkingDraft {
  if (
    !d ||
    typeof d !== 'object' ||
    Array.isArray(d) ||
    Object.keys(d).some(
      (k) =>
        !['version', 'writeId', 'chaseId', 'sceneId', 'revision', 'fields', 'rows'].includes(k),
    ) ||
    d.version !== 1 ||
    ![d.writeId, d.chaseId, d.sceneId].every(id) ||
    !Number.isSafeInteger(d.revision) ||
    d.revision < 1 ||
    !d.fields ||
    typeof d.fields !== 'object' ||
    Array.isArray(d.fields) ||
    Object.keys(d.fields).some(
      (k) => !chaseDraftFields.includes(k as (typeof chaseDraftFields)[number]),
    ) ||
    Object.values(d.fields).some((v) => typeof v !== 'string' || v.length > 10000) ||
    !Array.isArray(d.rows) ||
    d.rows.length > 1000 ||
    new Set(d.rows.map((r) => r?.participantId)).size !== d.rows.length ||
    d.rows.some(
      (r) =>
        !r ||
        typeof r !== 'object' ||
        Array.isArray(r) ||
        !id(r.participantId) ||
        Object.keys(r).some((k) => !['participantId', 'distance', 'exhaustion'].includes(k)) ||
        [r.distance, r.exhaustion].some(
          (v) => v !== undefined && (typeof v !== 'string' || v.length > 1000),
        ),
    )
  )
    throw new Error('Verfolgungsentwurf beschädigt. Rohwerte bleiben erhalten.');
  return d;
}
