import { createHash } from 'node:crypto';
import { canonicalJson } from '../campaign/generation/canonical-json';
import {
  CatalogReferenceError,
  validateCatalogReference,
  type CatalogReference,
} from '../catalog/catalog-reference-contracts';
import type { ItemDefinition } from '../catalog/item-definition-contracts';
import { creatureInfo, readCreature } from './creature-catalog';
import { readItemDefinition } from './item-definitions';
const creatureSource = 'srd-5.1-creatures';
const itemSources = ['srd-5.1-items/', 'authored-items/'];
const itemSource = (r: CatalogReference) =>
  itemSources.find((source) => r.sourceId.startsWith(source));
function checkSource(r: CatalogReference, expected: 'creature' | 'item') {
  validateCatalogReference(r);
  if (r.entryType !== expected)
    throw new CatalogReferenceError('entry-type', 'Eintragstyp passt nicht zum Verbraucher.');
  if (r.sourceId !== creatureSource && !itemSource(r))
    throw new CatalogReferenceError('unknown-source', r.sourceId);
  if (expected === 'creature' ? r.sourceId !== creatureSource : !itemSource(r))
    throw new CatalogReferenceError('entry-type', 'Quelle besitzt einen anderen Eintragstyp.');
}
export function creatureReference(id: string, hash?: string): CatalogReference {
  return {
    sourceId: creatureSource,
    sourceVersion: '5.1',
    sourceHash: hash ?? creatureInfo().hash,
    entryId: id,
    entryType: 'creature',
  };
}
export function resolveCreatureReference(r: CatalogReference) {
  checkSource(r, 'creature');
  let info;
  try {
    info = creatureInfo();
  } catch (e) {
    throw new CatalogReferenceError(
      (e as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing-source' : 'unavailable-source',
      (e as Error).message,
    );
  }
  if (r.sourceVersion !== '5.1' || r.sourceHash !== info.hash)
    throw new CatalogReferenceError(
      'source-version',
      'Der gebundene Kreaturquellenstand ist nicht installiert.',
    );
  try {
    return readCreature(r.entryId);
  } catch {
    throw new CatalogReferenceError('missing-entry', r.entryId);
  }
}
export function itemDefinitionReference(d: ItemDefinition): CatalogReference {
  return {
    sourceId: (d.source.kind === 'srd51' ? itemSources[0]! : itemSources[1]!) + d.id,
    sourceVersion: String(d.revision),
    sourceHash: createHash('sha256').update(canonicalJson(d)).digest('hex'),
    entryId: d.id,
    entryType: 'item',
  };
}
export function resolveItemReference(
  db: any,
  r: CatalogReference,
  historicalId = r.entryId,
): ItemDefinition {
  checkSource(r, 'item');
  if (r.sourceId !== itemSource(r)! + r.entryId)
    throw new CatalogReferenceError(
      'missing-entry',
      'Eintrag gehört zu einer anderen Definitionsquelle.',
    );
  const revision = Number(r.sourceVersion);
  if (!Number.isSafeInteger(revision) || revision < 1 || String(revision) !== r.sourceVersion)
    throw new CatalogReferenceError('source-version', 'Gegenstandsrevision ist ungültig.');
  const known = db
    .prepare(
      'SELECT 1 FROM item_definition WHERE id=? UNION SELECT 1 FROM authored_item WHERE id=?',
    )
    .get(historicalId, historicalId);
  if (!known)
    throw new CatalogReferenceError(
      'missing-source',
      'Die gebundene Gegenstandsquelle ist nicht installiert.',
    );
  let definition;
  try {
    definition = readItemDefinition(db, historicalId, revision);
  } catch (e) {
    const available = db
      .prepare('SELECT 1 FROM item_definition_version WHERE id=? AND revision=?')
      .get(historicalId, revision);
    throw new CatalogReferenceError(
      available ? 'unavailable-source' : 'source-version',
      (e as Error).message,
    );
  }
  // Historical aliases are explicit storage ownership, never a name/content search.
  const bound = itemDefinitionReference({ ...definition, id: r.entryId });
  if (bound.sourceId !== r.sourceId || bound.sourceHash !== r.sourceHash)
    throw new CatalogReferenceError(
      'source-version',
      'Gegenstandsquelle widerspricht dem gebundenen Stand.',
    );
  return definition;
}
export function resolveCatalogReference(db: any, r: CatalogReference) {
  validateCatalogReference(r);
  return r.entryType === 'creature' ? resolveCreatureReference(r) : resolveItemReference(db, r);
}
