import { decodeStored } from './stored-payload';
import { checkedRow } from './sqlite-connection';
import * as shape from './stored-shapes';
import { checkedHealth } from '../runtime/progression';
import { validateEncounterPlanInput } from '../catalog/encounter-contracts';
import { rawCreature } from '../../features/catalog/creature-catalog';
import type { PreparedGroup } from '../campaign/session-contracts';

export function checkedPreparedGroupValue(value: unknown): PreparedGroup {
  const g = shape.prepared_group(value),
    id = (v: unknown) => typeof v === 'string' && !!v.trim() && v.length <= 1000;
  if (
    !g ||
    !id(g.id) ||
    !Number.isSafeInteger(g.revision) ||
    g.revision < 1 ||
    typeof g.title !== 'string' ||
    g.title.length > 1000 ||
    typeof g.notes !== 'string' ||
    g.notes.length > 2000000 ||
    typeof g.sourceEncounterId !== 'string' ||
    g.sourceEncounterId.length > 1000 ||
    !Number.isSafeInteger(g.sourceRevision) ||
    g.sourceRevision < 0 ||
    (g.locationId !== null && !id(g.locationId)) ||
    !g.plan ||
    !Array.isArray(g.plan.entries) ||
    !Array.isArray(g.plan.sources) ||
    !Array.isArray(g.actors) ||
    g.actors.some((a) => !a || !id(a.id)) ||
    new Set(g.actors.map((a) => a.id)).size !== g.actors.length
  )
    throw new Error('Gruppenzuordnung, Revision oder Figurenliste beschädigt.');
  validateEncounterPlanInput(g.plan);
  g.plan.sources.forEach(rawCreature);
  for (const a of g.actors) {
    checkedHealth(a);
    if (
      !g.plan.entries.some((e) => e.id === a.entryId && e.creatureId === a.creatureId) ||
      !Number.isSafeInteger(a.revision) ||
      a.revision < 1
    )
      throw new Error('Gruppenfigur widerspricht ihrer Eintragsbindung.');
  }
  return g;
}

export function checkedPreparedGroupRow(value: unknown): PreparedGroup {
  const row = checkedRow(value, { id: 'text', revision: 'integer', location_id: 'nullable-text' }),
    g = decodeStored(value, checkedPreparedGroupValue);
  if (g.id !== row.id || g.revision !== row.revision || g.locationId !== row.location_id)
    throw new Error('Gruppenzuordnung widersprüchlich.');
  return g;
}
