import Database from 'better-sqlite3'
import {
  referenceDocumentSchema,
  referenceIndexSchema,
  referenceTargetSchema,
  type ReferenceCandidate,
  type ReferenceDocument,
  type ReferenceIndex,
  type ReferenceTarget
} from '../../shared/contracts/reference.js'
import { referenceTargetKey } from '../../shared/reference/reference-target-key.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'

type ManifestRow = {
  catalogId: string
  catalogVersion: string
  upstreamCommit: string
  archiveSha256: string
}

type TermRow = {
  normalizedTerm: string
  term: string
  matchMode: 'folded' | 'exact'
  targetKey: string
  title: string
}

export class ReferenceCatalogAdapter {
  private readonly database: Database.Database
  private readonly manifest: ManifestRow

  constructor(databasePath: string) {
    this.database = new Database(databasePath, {
      fileMustExist: true,
      readonly: true
    })
    this.database.pragma('query_only = ON')
    this.manifest = this.database
      .prepare(
        `SELECT catalog_id AS catalogId, catalog_version AS catalogVersion,
                upstream_commit AS upstreamCommit, archive_sha256 AS archiveSha256
         FROM reference_manifest WHERE singleton = 1`
      )
      .get() as ManifestRow
  }

  index(): ReferenceIndex {
    const rows = this.database
      .prepare(
        `SELECT normalized_term AS normalizedTerm, term, match_mode AS matchMode,
                target_key AS targetKey, title
         FROM reference_term ORDER BY position`
      )
      .all() as TermRow[]
    const terms = new Map<
      string,
      {
        term: string
        matchMode: 'folded' | 'exact'
        candidates: ReferenceCandidate[]
      }
    >()
    for (const row of rows) {
      const key = `${row.matchMode}:${row.normalizedTerm}`
      const term = terms.get(key) ?? {
        term: row.term,
        matchMode: row.matchMode,
        candidates: []
      }
      term.candidates.push({
        target: parseTargetKey(row.targetKey),
        title: row.title
      })
      terms.set(key, term)
    }
    return referenceIndexSchema.parse({
      scope: 'static',
      revision: `${this.manifest.catalogVersion}:${this.manifest.upstreamCommit}:${this.manifest.archiveSha256}`,
      terms: [...terms.values()]
    })
  }

  detail(target: ReferenceTarget): ReferenceDocument {
    if (target.scope !== 'srd' || target.catalogId !== this.manifest.catalogId)
      throw new CapabilityError('not_found', false)
    const row = this.database
      .prepare(
        'SELECT document_json AS documentJson FROM reference_document WHERE target_key = ?'
      )
      .get(referenceTargetKey(target)) as { documentJson: string } | undefined
    if (!row) throw new CapabilityError('not_found', false)
    return referenceDocumentSchema.parse(JSON.parse(row.documentJson))
  }

  close(): void {
    this.database.close()
  }
}

function parseTargetKey(value: string): ReferenceTarget {
  const [scope, catalogId, definitionKind, ...definitionId] = value.split(':')
  if (scope !== 'srd' || catalogId !== 'srd-5.1' || !definitionKind)
    throw new Error(`Invalid SRD target key: ${value}`)
  return referenceTargetSchema.parse({
    scope,
    catalogId,
    definitionKind,
    definitionId: definitionId.join(':')
  })
}
