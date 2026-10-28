/** Global definition identity. A local campaign copy must preserve all five bindings. */
export interface CatalogReference {
  sourceId: string;
  sourceVersion: string;
  sourceHash: string;
  entryId: string;
  entryType: 'creature' | 'item';
}
export function validateCatalogReference(value: unknown): asserts value is CatalogReference {
  const r = value as CatalogReference;
  if (r && typeof r === 'object' && (!r.sourceId || typeof r.sourceId !== 'string'))
    throw new CatalogReferenceError('missing-source', 'Quellenidentität fehlt.');
  if (
    !r ||
    typeof r !== 'object' ||
    Array.isArray(r) ||
    Object.keys(r).some(
      (key) => !['sourceId', 'sourceVersion', 'sourceHash', 'entryId', 'entryType'].includes(key),
    ) ||
    ![r.sourceId, r.sourceVersion, r.entryId].every(
      (v) => typeof v === 'string' && v.length > 0 && v.length <= 1000,
    ) ||
    typeof r.sourceHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(r.sourceHash) ||
    !['creature', 'item'].includes(r.entryType)
  )
    throw new Error('Katalogreferenz fehlt oder ist unvollständig.');
}
export type CatalogReferenceProblem =
  | 'missing-source'
  | 'unknown-source'
  | 'source-version'
  | 'unavailable-source'
  | 'missing-entry'
  | 'entry-type';
export class CatalogReferenceError extends Error {
  constructor(
    readonly code: CatalogReferenceProblem,
    message: string,
  ) {
    super('Katalogquelle [' + code + ']: ' + message);
    this.name = 'CatalogReferenceError';
  }
}

/** Binding from immutable catalogue metadata already read by the editor. */
export function creatureCatalogReference(entryId: string, sourceHash: string): CatalogReference {
  const reference: CatalogReference = {
    sourceId: 'srd-5.1-creatures',
    sourceVersion: '5.1',
    sourceHash,
    entryId,
    entryType: 'creature',
  };
  validateCatalogReference(reference);
  return reference;
}
