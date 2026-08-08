import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { x as extractTar } from 'tar'
import { z } from 'zod'
import {
  referenceDocumentSchema,
  referenceTermSchema,
  type ReferenceBlock,
  type ReferenceCandidate,
  type ReferenceDefinitionKind,
  type ReferenceDocument,
  type ReferenceInline,
  type ReferenceTarget,
  type ReferenceTerm
} from '../src/shared/contracts/reference.js'
import {
  creatureSchema,
  type Creature
} from '../src/shared/contracts/creature.js'
import {
  endpointSchemas,
  monsterSourceSchema
} from './reference-compiler/source-schemas.js'
import { compileCreatureActions } from './reference-compiler/creature-parts.js'

const upstreamTag = 'v5.10.0'
const upstreamCommit = '3f5593ea004c4f5a2af95603087ce4de72689d9f'
const expectedArchiveSha256 =
  '200d84ced9b85049ebd975d497463a10b5b31560f8d86424fd98ae4780eb84c4'
const archiveUrl = `https://codeload.github.com/5e-bits/5e-database/tar.gz/${upstreamCommit}`
const officialSource =
  'https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf'
const attribution =
  'This work includes material taken from the System Reference Document 5.1 (SRD 5.1) by Wizards of the Coast LLC and available under CC BY 4.0.'
const cacheRoot = resolve('.cache/reference-import')
const archivePath = join(cacheRoot, `${upstreamCommit}.tar.gz`)
const extractionRoot = join(cacheRoot, upstreamCommit)
const outputRoot = resolve('resources/reference')
const databasePath = join(outputRoot, 'srd-5.1.sqlite')
const manifestPath = join(outputRoot, 'srd-5.1.manifest.json')
const reportPath = join(outputRoot, 'srd-5.1.import-report.json')
const definitionIdsPath = join(outputRoot, 'srd-5.1.definition-ids.json')
const creatureOutputPath = resolve('src/core/creatures/srd-5.1.generated.json')
const creatureReportPath = resolve(
  'resources/catalog/srd-5.1.creature-import-report.json'
)
const creatureIdsPath = resolve('resources/catalog/srd-5.1.creature-ids.json')
const biomeEnrichmentPath = resolve('resources/catalog/creature-biomes.json')
const creaturePartOverridesPath = resolve(
  'resources/catalog/creature-part-id-overrides.json'
)
const monsterFile = '5e-SRD-Monsters.json'

const endpointFiles = {
  'ability-scores': '5e-SRD-Ability-Scores.json',
  conditions: '5e-SRD-Conditions.json',
  equipment: '5e-SRD-Equipment.json',
  feats: '5e-SRD-Feats.json',
  features: '5e-SRD-Features.json',
  'magic-items': '5e-SRD-Magic-Items.json',
  'rule-sections': '5e-SRD-Rule-Sections.json',
  rules: '5e-SRD-Rules.json',
  skills: '5e-SRD-Skills.json',
  spells: '5e-SRD-Spells.json',
  traits: '5e-SRD-Traits.json',
  'weapon-properties': '5e-SRD-Weapon-Properties.json'
} as const

const endpointKinds: Record<
  keyof typeof endpointFiles,
  ReferenceDefinitionKind
> = {
  'ability-scores': 'ability',
  conditions: 'condition',
  equipment: 'item',
  feats: 'ability',
  features: 'ability',
  'magic-items': 'item',
  'rule-sections': 'rule',
  rules: 'rule',
  skills: 'ability',
  spells: 'spell',
  traits: 'ability',
  'weapon-properties': 'rule'
}

const biomeEnrichmentSchema = z
  .object({
    schemaVersion: z.literal(1),
    provenance: z.string().min(1),
    aliases: z.record(z.string(), z.string().min(1)),
    biomes: z.record(z.string(), z.array(z.string().min(1)))
  })
  .strict()
const creaturePartOverridesSchema = z
  .object({
    schemaVersion: z.literal(1),
    overrides: z.record(z.string(), z.string().min(1))
  })
  .strict()

type DraftEntry = {
  aliases: string[]
  target: ReferenceTarget
  title: string
  facts: { label: string; value: string }[]
  blocks: UnlinkedBlock[]
}
type UnlinkedBlock =
  | { kind: 'heading'; level: 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; columns: string[]; rows: string[][] }

await mkdir(cacheRoot, { recursive: true })
const archive = await loadArchive()
const archiveSha256 = createHash('sha256').update(archive).digest('hex')
if (archiveSha256 !== expectedArchiveSha256)
  throw new Error(
    `Pinned SRD archive checksum mismatch: expected ${expectedArchiveSha256}, received ${archiveSha256}`
  )
await rm(extractionRoot, { recursive: true, force: true })
await mkdir(extractionRoot, { recursive: true })
await extractTar({ file: archivePath, cwd: extractionRoot, gzip: true })
const [sourceDirectoryName] = await readdir(extractionRoot)
if (!sourceDirectoryName) throw new Error('Pinned SRD archive is empty')
const sourceRoot = join(
  extractionRoot,
  sourceDirectoryName,
  'src',
  '2014',
  'en'
)

const creatureBuild = await compileCreatures(sourceRoot)
const creatureJson = `${JSON.stringify(creatureBuild.document, null, 2)}\n`
const creatureJsonSha256 = createHash('sha256')
  .update(creatureJson)
  .digest('hex')

const endpointCounts: Record<string, number> = {
  monsters: creatureBuild.document.creatures.length
}
const drafts: DraftEntry[] = []
for (const [endpoint, file] of Object.entries(endpointFiles) as Array<
  [keyof typeof endpointFiles, string]
>) {
  const rows = z
    .array(endpointSchemas[endpoint])
    .parse(JSON.parse(await readFile(join(sourceRoot, file), 'utf8'))) as Array<
    Record<string, unknown>
  >
  endpointCounts[endpoint] = rows.length
  for (const raw of rows) drafts.push(...entriesFor(endpoint, raw))
}

drafts.sort(
  (left, right) =>
    left.title.localeCompare(right.title) ||
    targetKey(left.target).localeCompare(targetKey(right.target))
)

const duplicateTargets = Map.groupBy(drafts, (draft) => targetKey(draft.target))
const targetCollisions = [...duplicateTargets.entries()].filter(
  ([, entries]) => entries.length > 1
)
if (targetCollisions.length)
  throw new Error(
    `Duplicate reference targets:\n${targetCollisions
      .map(
        ([key, entries]) =>
          `- ${key}: ${entries.map((entry) => entry.title).join(' | ')}`
      )
      .join('\n')}`
  )

const termMap = new Map<
  string,
  {
    term: string
    matchMode: 'folded'
    candidates: Map<string, ReferenceCandidate>
  }
>()
for (const draft of drafts)
  for (const alias of draft.aliases) {
    const normalized = alias.trim()
    if (!normalized) continue
    const lookup = normalized.normalize('NFKC').toLocaleLowerCase('en-US')
    const current = termMap.get(lookup) ?? {
      term: normalized,
      matchMode: 'folded' as const,
      candidates: new Map()
    }
    current.candidates.set(targetKey(draft.target), {
      target: draft.target,
      title: draft.title
    })
    termMap.set(lookup, current)
  }

const terms = [...termMap.values()]
  .map((term): ReferenceTerm =>
    referenceTermSchema.parse({
      term: term.term,
      matchMode: term.matchMode,
      candidates: [...term.candidates.values()].toSorted(candidateOrder)
    })
  )
  .toSorted(
    (left, right) =>
      right.term.length - left.term.length ||
      left.term.localeCompare(right.term)
  )
const linkTerms = terms.toSorted(
  (left, right) =>
    right.term.length - left.term.length || left.term.localeCompare(right.term)
)

const documents = drafts.map((draft): ReferenceDocument =>
  referenceDocumentSchema.parse({
    documentKind: 'article',
    target: draft.target,
    title: draft.title,
    facts: draft.facts.map((fact) => ({
      label: fact.label,
      value: linkText(fact.value, linkTerms, [draft.target])
    })),
    blocks: draft.blocks.map((block): ReferenceBlock =>
      linkBlock(block, linkTerms, draft.target)
    ),
    source: source()
  })
)
const definitionIds = documents
  .map((document) => targetKey(document.target))
  .toSorted()
const goldenDefinitionIds = await readRequiredStringList(definitionIdsPath)
const removedDefinitionIds = goldenDefinitionIds.filter(
  (id) => !definitionIds.includes(id)
)
const addedDefinitionIds = definitionIds.filter(
  (id) => !goldenDefinitionIds.includes(id)
)
const incompleteDocuments = documents
  .filter(
    (document) =>
      document.documentKind === 'article' &&
      document.facts.length === 0 &&
      document.blocks.length === 0
  )
  .map((document) => targetKey(document.target))

await mkdir(outputRoot, { recursive: true })
await rm(databasePath, { force: true })
const database = new Database(databasePath)
database.pragma('journal_mode = DELETE')
database.exec(`
  CREATE TABLE reference_manifest (
    singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
    catalog_id TEXT NOT NULL,
    catalog_version TEXT NOT NULL,
    upstream_commit TEXT NOT NULL,
    archive_sha256 TEXT NOT NULL,
    source_url TEXT NOT NULL,
    attribution TEXT NOT NULL
  );
  CREATE TABLE reference_document (
    target_key TEXT PRIMARY KEY,
    document_json TEXT NOT NULL
  );
  CREATE TABLE reference_term (
    normalized_term TEXT NOT NULL,
    term TEXT NOT NULL,
    match_mode TEXT NOT NULL CHECK(match_mode IN ('folded', 'exact')),
    target_key TEXT NOT NULL,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (normalized_term, match_mode, target_key)
  );
  CREATE INDEX idx_reference_term_position
    ON reference_term(position, normalized_term, target_key);
`)
const insertManifest = database.prepare(
  `INSERT INTO reference_manifest
   (singleton, catalog_id, catalog_version, upstream_commit, archive_sha256, source_url, attribution)
   VALUES (1, ?, ?, ?, ?, ?, ?)`
)
const insertDocument = database.prepare(
  'INSERT INTO reference_document (target_key, document_json) VALUES (?, ?)'
)
const insertTerm = database.prepare(
  `INSERT INTO reference_term
   (normalized_term, term, match_mode, target_key, title, position)
   VALUES (?, ?, ?, ?, ?, ?)`
)
database.transaction(() => {
  insertManifest.run(
    'srd-5.1',
    upstreamTag,
    upstreamCommit,
    archiveSha256,
    officialSource,
    attribution
  )
  for (const document of documents)
    insertDocument.run(targetKey(document.target), JSON.stringify(document))
  let position = 0
  for (const term of terms)
    for (const candidate of term.candidates)
      insertTerm.run(
        term.term.normalize('NFKC').toLocaleLowerCase('en-US'),
        term.term,
        term.matchMode,
        targetKey(candidate.target),
        candidate.title,
        position++
      )
})()
database.pragma('optimize')
database.close()

const databaseSha256 = createHash('sha256')
  .update(await readFile(databasePath))
  .digest('hex')
const manifest = {
  catalogId: 'srd-5.1',
  catalogVersion: upstreamTag,
  upstreamRepository: 'https://github.com/5e-bits/5e-database',
  upstreamCommit,
  archiveUrl,
  archiveSha256,
  databaseSha256,
  officialSource,
  license: 'CC-BY-4.0',
  attribution,
  endpointCounts,
  documents: documents.length,
  terms: terms.length,
  creatures: creatureBuild.document.creatures.length,
  creatureJsonSha256
}
const ambiguities = terms
  .filter((term) => term.candidates.length > 1)
  .map((term) => ({
    term: term.term,
    candidates: term.candidates.map((candidate) => targetKey(candidate.target))
  }))
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
await mkdir(dirname(creatureOutputPath), { recursive: true })
await writeFile(creatureOutputPath, creatureJson, 'utf8')
await writeFile(
  reportPath,
  `${JSON.stringify(
    {
      documents: documents.length,
      terms: terms.length,
      ambiguousTerms: ambiguities.length,
      ambiguities,
      targetCollisions: [],
      addedDefinitionIds,
      removedDefinitionIds,
      incompleteDocuments,
      creatureQuality: creatureBuild.report
    },
    null,
    2
  )}\n`,
  'utf8'
)
await mkdir(dirname(creatureReportPath), { recursive: true })
await writeFile(
  creatureReportPath,
  `${JSON.stringify(creatureBuild.report, null, 2)}\n`,
  'utf8'
)

async function loadArchive(): Promise<Buffer> {
  try {
    return await readFile(archivePath)
  } catch {
    const response = await fetch(archiveUrl, {
      headers: { accept: 'application/gzip' }
    })
    if (!response.ok)
      throw new Error(`Pinned SRD download failed: ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(archivePath, buffer)
    return buffer
  }
}

async function compileCreatures(sourceRoot: string): Promise<{
  document: {
    manifest: Record<string, string>
    creatures: Creature[]
  }
  report: Record<string, unknown>
}> {
  const sourceRows = z
    .array(monsterSourceSchema)
    .parse(JSON.parse(await readFile(join(sourceRoot, monsterFile), 'utf8')))
  const enrichment = biomeEnrichmentSchema.parse(
    JSON.parse(await readFile(biomeEnrichmentPath, 'utf8'))
  )
  const partOverrides = creaturePartOverridesSchema.parse(
    JSON.parse(await readFile(creaturePartOverridesPath, 'utf8'))
  ).overrides
  const usedOverrides = new Set<string>()
  const creatures = sourceRows
    .map((raw): Creature => {
      const actions = compileCreatureActions(
        raw.index,
        'action',
        raw.actions ?? [],
        partOverrides,
        usedOverrides
      )
      const traits = compileCreatureActions(
        raw.index,
        'trait',
        raw.special_abilities ?? [],
        partOverrides,
        usedOverrides
      )
      const legendaryActions = compileCreatureActions(
        raw.index,
        'legendary-action',
        raw.legendary_actions ?? [],
        partOverrides,
        usedOverrides
      )
      const proficiencyText = (prefix: string) =>
        raw.proficiencies
          .filter((entry) => entry.proficiency.name.startsWith(prefix))
          .map(
            (entry) =>
              `${entry.proficiency.name.slice(prefix.length)} ${signed(entry.value)}`
          )
          .join(', ')
      return creatureSchema.parse({
        id: raw.index,
        name: raw.name,
        cr: raw.challenge_rating,
        challengeRating: String(raw.challenge_rating),
        xp: raw.xp,
        type: titleCase(raw.type),
        subtype: titleCase(raw.subtype ?? ''),
        size: raw.size,
        alignment: titleCase(raw.alignment),
        biomes: [
          ...(enrichment.biomes[enrichment.aliases[raw.index] ?? raw.index] ??
            [])
        ].toSorted(),
        ac: raw.armor_class[0]?.value ?? 0,
        hp: raw.hit_points,
        hitDice: raw.hit_dice,
        speed: recordText(raw.speed),
        initiative: Math.floor((raw.dexterity - 10) / 2),
        abilities: {
          str: raw.strength,
          dex: raw.dexterity,
          con: raw.constitution,
          int: raw.intelligence,
          wis: raw.wisdom,
          cha: raw.charisma
        },
        senses: recordText(raw.senses),
        languages: raw.languages,
        savingThrows: proficiencyText('Saving Throw: '),
        skills: proficiencyText('Skill: '),
        damageVulnerabilities: raw.damage_vulnerabilities.join(', '),
        damageResistances: raw.damage_resistances.join(', '),
        damageImmunities: raw.damage_immunities.join(', '),
        conditionImmunities: raw.condition_immunities
          .map((condition) => condition.name)
          .join(', '),
        traits,
        actions,
        legendaryActions,
        details:
          raw.desc?.trim() ||
          traits[0]?.description ||
          actions[0]?.description ||
          ''
      })
    })
    .toSorted(
      (left, right) =>
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
    )
  const ids = creatures.map((creature) => creature.id).toSorted()
  const goldenIds = await readRequiredStringList(creatureIdsPath)
  const unusedOverrides = Object.keys(partOverrides)
    .filter((key) => !usedOverrides.has(key))
    .toSorted()
  if (unusedOverrides.length)
    throw new Error(
      `Unused creature part ID overrides:\n${unusedOverrides.map((key) => `- ${key}`).join('\n')}`
    )
  return {
    document: {
      manifest: {
        catalogVersion: upstreamTag,
        upstreamCommit,
        archiveSha256,
        source: `https://github.com/5e-bits/5e-database/tree/${upstreamTag}`,
        sourceHash: archiveSha256,
        sourceDocument: 'Dungeons & Dragons System Reference Document 5.1',
        license: 'CC-BY-4.0',
        attribution
      },
      creatures
    },
    report: {
      creatures: creatures.length,
      addedCreatureIds: ids.filter((id) => !goldenIds.includes(id)),
      removedCreatureIds: goldenIds.filter((id) => !ids.includes(id)),
      missingBiomeEnrichment: ids.filter(
        (id) => enrichment.biomes[enrichment.aliases[id] ?? id] === undefined
      ),
      orphanedBiomeEnrichment: Object.keys(enrichment.biomes)
        .filter(
          (id) =>
            !ids.includes(id) && !Object.values(enrichment.aliases).includes(id)
        )
        .toSorted(),
      incompleteCreatures: creatures
        .filter(
          (creature) =>
            !creature.details &&
            creature.actions.length === 0 &&
            creature.traits.length === 0
        )
        .map((creature) => creature.id),
      partIdCollisions: [],
      appliedPartIdOverrides: [...usedOverrides].toSorted()
    }
  }
}

async function readRequiredStringList(path: string): Promise<string[]> {
  return z.array(z.string()).parse(JSON.parse(await readFile(path, 'utf8')))
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

function recordText(value: Record<string, unknown>): string {
  return Object.entries(value)
    .filter(([, fact]) => fact !== false && fact !== null && fact !== undefined)
    .map(
      ([name, fact]) =>
        `${titleCase(name.replaceAll('_', ' '))} ${String(fact)}`
    )
    .join(', ')
}

function entriesFor(
  endpoint: keyof typeof endpointFiles,
  raw: Record<string, unknown>
): DraftEntry[] {
  const index = text(raw['index'])
  if (!index) throw new Error(`${endpoint} row has no index`)
  const kind = endpointKinds[endpoint]
  const title =
    endpoint === 'ability-scores'
      ? text(raw['full_name']) || text(raw['name'])
      : text(raw['name']) || titleCase(index.replaceAll('-', ' '))
  if (!title) throw new Error(`${endpoint}:${index} has no title`)
  const description = Array.isArray(raw['desc'])
    ? raw['desc'].map(text).join('\n\n')
    : text(raw['desc'])
  const blocks = markdownBlocks(description, title)
  const target: ReferenceTarget = {
    scope: 'srd',
    catalogId: 'srd-5.1',
    definitionKind: kind,
    definitionId: `${endpoint}:${index}`
  }
  const entries: DraftEntry[] = [
    {
      aliases: unique([
        ...(endpoint === 'ability-scores' ? [text(raw['name'])] : []),
        title
      ]),
      target,
      title,
      facts: factsFor(endpoint, raw),
      blocks
    }
  ]
  if (endpoint === 'rule-sections') {
    const headings: Array<{
      block: Extract<UnlinkedBlock, { kind: 'heading' }>
      path: string[]
      position: number
    }> = []
    const headingPath: Partial<Record<2 | 3 | 4, string>> = {}
    for (const [position, block] of blocks.entries()) {
      if (block.kind !== 'heading') continue
      headingPath[block.level] = slug(block.text)
      for (let level = block.level + 1; level <= 4; level += 1)
        delete headingPath[level as 2 | 3 | 4]
      if (block.level >= 3)
        headings.push({
          block,
          path: [2, 3, 4]
            .filter((level) => level <= block.level)
            .map((level) => headingPath[level as 2 | 3 | 4])
            .filter((part): part is string => part !== undefined),
          position
        })
    }
    for (const [headingIndex, heading] of headings.entries()) {
      const end =
        headings
          .slice(headingIndex + 1)
          .find((next) => next.block.level <= heading.block.level)?.position ??
        blocks.length
      const childKind = index === 'actions-in-combat' ? 'action' : 'rule'
      entries.push({
        aliases: [heading.block.text],
        target: {
          scope: 'srd',
          catalogId: 'srd-5.1',
          definitionKind: childKind,
          definitionId: `rule-section:${index}:${heading.path.join(':')}`
        },
        title: heading.block.text,
        facts: [],
        blocks: blocks.slice(heading.position + 1, end)
      })
    }
  }
  return entries
}

function markdownBlocks(value: string, documentTitle: string): UnlinkedBlock[] {
  const blocks: UnlinkedBlock[] = []
  const lines = value.replaceAll('\r\n', '\n').split('\n')
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let table: Extract<UnlinkedBlock, { kind: 'table' }> | null = null
  const flushParagraph = () => {
    if (paragraph.length)
      blocks.push({ kind: 'paragraph', text: cleanInline(paragraph.join(' ')) })
    paragraph = []
  }
  const flushList = () => {
    if (list) blocks.push({ kind: 'list', ...list })
    list = null
  }
  for (const [lineIndex, rawLine] of lines.entries()) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      flushList()
      table = null
      continue
    }
    const heading = /^(#{2,4})\s+(.+)$/.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      table = null
      const headingText = cleanInline(heading[2]!)
      if (headingText.toLocaleLowerCase() !== documentTitle.toLocaleLowerCase())
        blocks.push({
          kind: 'heading',
          level: heading[1]!.length as 2 | 3 | 4,
          text: headingText
        })
      continue
    }
    const listItem = /^(?:(\d+)[.)]|[-*])\s+(.+)$/.exec(line)
    if (listItem) {
      flushParagraph()
      table = null
      const ordered = listItem[1] !== undefined
      if (list && list.ordered !== ordered) flushList()
      list ??= { ordered, items: [] }
      list.items.push(cleanInline(listItem[2]!))
      continue
    }
    const tableSeparator = (candidate: string | undefined) =>
      candidate !== undefined &&
      /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$/.test(candidate)
    if (tableSeparator(line)) continue
    if (
      line.includes('|') &&
      (table !== null || tableSeparator(lines[lineIndex + 1]))
    ) {
      flushParagraph()
      flushList()
      const cells = tableCells(line)
      if (table) table.rows.push(cells)
      else {
        table = { kind: 'table', columns: cells, rows: [] }
        blocks.push(table)
      }
      continue
    }
    table = null
    paragraph.push(line)
  }
  flushParagraph()
  flushList()
  return blocks
}

function linkBlock(
  block: UnlinkedBlock,
  terms: readonly ReferenceTerm[],
  excluded: ReferenceTarget
): ReferenceBlock {
  if (block.kind === 'heading')
    return {
      kind: 'heading',
      level: block.level,
      inlines: linkText(block.text, terms, [excluded])
    }
  if (block.kind === 'paragraph')
    return {
      kind: 'paragraph',
      inlines: linkText(block.text, terms, [excluded])
    }
  if (block.kind === 'list')
    return {
      kind: 'list',
      ordered: block.ordered,
      items: block.items.map((item) => linkText(item, terms, [excluded]))
    }
  return {
    kind: 'table',
    columns: block.columns,
    rows: block.rows.map((row) =>
      row.map((cell) => linkText(cell, terms, [excluded]))
    )
  }
}

function linkText(
  value: string,
  terms: readonly ReferenceTerm[],
  excluded: readonly ReferenceTarget[]
): ReferenceInline[] {
  const excludedKeys = new Set(excluded.map(targetKey))
  const matches: Array<{
    start: number
    end: number
    text: string
    candidates: readonly ReferenceCandidate[]
  }> = []
  const folded = value.normalize('NFKC').toLocaleLowerCase('en-US')
  for (const term of terms) {
    const needle = term.term.normalize('NFKC').toLocaleLowerCase('en-US')
    let start = folded.indexOf(needle)
    while (start >= 0) {
      const end = start + needle.length
      if (
        (start === 0 || !isWord(folded[start - 1]!)) &&
        (end === folded.length || !isWord(folded[end]!))
      ) {
        const candidates = term.candidates.filter(
          (candidate) => !excludedKeys.has(targetKey(candidate.target))
        )
        if (candidates.length)
          matches.push({
            start,
            end,
            text: value.slice(start, end),
            candidates
          })
      }
      start = folded.indexOf(needle, start + 1)
    }
  }
  matches.sort(
    (left, right) => left.start - right.start || right.end - left.end
  )
  const inlines: ReferenceInline[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.start < cursor) continue
    if (match.start > cursor)
      inlines.push({ kind: 'text', text: value.slice(cursor, match.start) })
    inlines.push({
      kind: 'reference',
      text: match.text,
      candidates: [...match.candidates]
    })
    cursor = match.end
  }
  if (cursor < value.length)
    inlines.push({ kind: 'text', text: value.slice(cursor) })
  return inlines.length ? inlines : [{ kind: 'text', text: value }]
}

function factsFor(
  endpoint: keyof typeof endpointFiles,
  raw: Record<string, unknown>
): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = []
  const add = (label: string, value: unknown) => {
    const formatted = factText(value)
    if (formatted) facts.push({ label, value: formatted })
  }
  if (endpoint === 'spells') {
    add('Level', raw['level'])
    add('School', raw['school'])
    add('Casting Time', raw['casting_time'])
    add('Range', raw['range'])
    add('Components', raw['components'])
    add('Duration', raw['duration'])
    add('Concentration', raw['concentration'] === true ? 'Yes' : 'No')
    add('Ritual', raw['ritual'] === true ? 'Yes' : 'No')
  } else if (endpoint === 'equipment' || endpoint === 'magic-items') {
    add('Category', raw['equipment_category'])
    add('Gear Category', raw['gear_category'])
    add('Rarity', raw['rarity'])
    add('Cost', raw['cost'])
    add('Weight', raw['weight'])
    add('Damage', raw['damage'])
    add('Armor Class', raw['armor_class'])
    add('Attunement', raw['requires_attunement'])
  } else if (endpoint === 'ability-scores') add('Abbreviation', raw['name'])
  return facts
}

function source() {
  return {
    title: 'Dungeons & Dragons System Reference Document 5.1',
    version: `2014 / ${upstreamTag}`,
    url: officialSource,
    attribution
  }
}

function factText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number')
    return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value))
    return value.map(factText).filter(Boolean).join(', ')
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  if (typeof record['name'] === 'string') return record['name']
  if ('quantity' in record && 'unit' in record)
    return `${factText(record['quantity'])} ${factText(record['unit'])}`.trim()
  if ('damage_dice' in record && 'damage_type' in record)
    return `${factText(record['damage_dice'])} ${factText(record['damage_type'])}`.trim()
  return Object.entries(record)
    .map(
      ([key, item]) =>
        `${titleCase(key.replaceAll('_', ' '))}: ${factText(item)}`
    )
    .filter((entry) => !entry.endsWith(': '))
    .join(', ')
}

function targetKey(target: ReferenceTarget): string {
  if (target.scope === 'srd')
    return `srd:${target.catalogId}:${target.definitionKind}:${target.definitionId}`
  if (target.scope === 'creature') return `creature:${target.creatureId}`
  if (target.scope === 'creature-part')
    return `creature-part:${target.creatureId}:${target.partKind}:${target.partId}`
  return `campaign:${target.campaignId}:${target.entityKind}:${target.entityId}`
}

function candidateOrder(
  left: ReferenceCandidate,
  right: ReferenceCandidate
): number {
  return (
    left.title.localeCompare(right.title) ||
    targetKey(left.target).localeCompare(targetKey(right.target))
  )
}

function cleanInline(value: string): string {
  return value
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim()
}

function tableCells(value: string): string[] {
  return value
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(cleanInline)
}

function slug(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('en-US')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'part'
  )
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : ''
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function isWord(value: string): boolean {
  return /[\p{L}\p{M}\p{N}_]/u.test(value)
}
