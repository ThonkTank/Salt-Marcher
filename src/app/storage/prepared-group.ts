import { createHash } from 'node:crypto';
import type { PreparedGroup } from '../session-contracts';

export function checkedPreparedGroupRow(row: any): PreparedGroup {
  if (!row || createHash('sha256').update(row.payload).digest('hex') !== row.checksum)
    throw new Error('Spielabend-Inhalt fehlt oder ist beschädigt.');
  const g = JSON.parse(row.payload) as PreparedGroup,
    id = (v: unknown) => typeof v === 'string' && !!v.trim() && v.length <= 1000;
  if (
    !g ||
    g.id !== row.id ||
    g.revision !== row.revision ||
    g.locationId !== row.location_id ||
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
  return g;
}
