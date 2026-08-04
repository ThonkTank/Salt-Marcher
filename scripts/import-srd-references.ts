import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const apiRoot = 'https://www.dnd5eapi.co/api/2014'
const officialSource =
  'https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf'
const target = resolve('src/core/reference/srd-5.1.generated.json')
const attribution =
  'This work includes material taken from the System Reference Document 5.1 (SRD 5.1) by Wizards of the Coast LLC and available under CC BY 4.0.'

const endpointKinds = {
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
} as const

type ReferenceKind =
  (typeof endpointKinds)[keyof typeof endpointKinds] | 'action'
type RawResource = Record<string, unknown>
type Entry = {
  aliases: string[]
  document: {
    target: { kind: ReferenceKind; id: string }
    title: string
    context: string | null
    summary: string
    facts: { label: string; value: string }[]
    sections: { id: string; title: string; paragraphs: string[] }[]
    source: {
      title: string
      version: string
      url: string
      attribution: string
    }
  }
}

const indexRows = (
  await Promise.all(
    Object.keys(endpointKinds).map(async (endpoint) => {
      const payload = await getJson(`${apiRoot}/${endpoint}`)
      const results = Array.isArray(payload['results'])
        ? (payload['results'] as RawResource[])
        : []
      return results.map((row) => ({
        endpoint: endpoint as keyof typeof endpointKinds,
        index: text(row['index'])
      }))
    })
  )
).flat()

const rawRows = await concurrentMap(indexRows, 16, async (row) => ({
  ...row,
  raw: await getJson(`${apiRoot}/${row.endpoint}/${row.index}`)
}))

const entries = rawRows.flatMap(({ endpoint, index, raw }) => {
  const kind = endpointKinds[endpoint]
  const title =
    endpoint === 'ability-scores'
      ? text(raw['full_name']) || text(raw['name'])
      : text(raw['name']) || titleCase(index.replaceAll('-', ' '))
  const aliases = unique([
    ...(endpoint === 'ability-scores' ? [text(raw['name'])] : []),
    title
  ])
  const sections = descriptionSections(raw['desc'], title)
  const paragraphs = sections.flatMap((section) => section.paragraphs)
  const document = {
    target: { kind, id: `${endpoint}:${index}` },
    title,
    context: endpointLabel(endpoint),
    summary: paragraphs[0] ?? '',
    facts: factsFor(endpoint, raw),
    sections,
    source: source()
  } satisfies Entry['document']
  const result: Entry[] = [{ aliases, document }]

  if (endpoint === 'rule-sections')
    for (const section of sections.filter((candidate) => candidate.title))
      result.push({
        aliases: [section.title],
        document: {
          target: {
            kind: index === 'actions-in-combat' ? 'action' : 'rule',
            id: `rule-section:${index}:${section.id}`
          },
          title: section.title,
          context: index === 'actions-in-combat' ? 'Action in Combat' : title,
          summary: section.paragraphs[0] ?? '',
          facts: [],
          sections: [section],
          source: source()
        }
      })
  return result
})

entries.sort(
  (left, right) =>
    left.document.title.localeCompare(right.document.title) ||
    left.document.target.kind.localeCompare(right.document.target.kind) ||
    left.document.target.id.localeCompare(right.document.target.id)
)

const sourceContentHash = createHash('sha256')
  .update(JSON.stringify(rawRows))
  .digest('hex')
const document = {
  manifest: {
    catalogVersion: 'srd-5.1-5e-bits-2014-2026-08-04',
    apiRoot,
    officialSource,
    sourceContentHash,
    license: 'CC-BY-4.0',
    attribution,
    endpointCounts: Object.fromEntries(
      Object.keys(endpointKinds).map((endpoint) => [
        endpoint,
        indexRows.filter((row) => row.endpoint === endpoint).length
      ])
    )
  },
  entries
}

await mkdir(dirname(target), { recursive: true })
await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

async function getJson(url: string): Promise<RawResource> {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok)
    throw new Error(`SRD reference import failed: ${response.status} ${url}`)
  return (await response.json()) as RawResource
}

async function concurrentMap<T, R>(
  values: readonly T[],
  concurrency: number,
  work: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (next < values.length) {
        const index = next++
        results[index] = await work(values[index]!)
      }
    })
  )
  return results
}

function source() {
  return {
    title: 'Dungeons & Dragons System Reference Document 5.1',
    version: '2014 / SRD 5.1',
    url: officialSource,
    attribution
  }
}

function factsFor(
  endpoint: keyof typeof endpointKinds,
  raw: RawResource
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
  } else if (endpoint === 'ability-scores') {
    add('Abbreviation', raw['name'])
  }
  return facts
}

function descriptionSections(
  value: unknown,
  documentTitle: string
): { id: string; title: string; paragraphs: string[] }[] {
  const raw = Array.isArray(value) ? value.map(text).join('\n\n') : text(value)
  if (!raw.trim()) return []
  const sections: { id: string; title: string; paragraphs: string[] }[] = []
  let current = { id: 'description', title: '', paragraphs: [] as string[] }
  const flush = () => {
    if (current.paragraphs.length > 0) sections.push(current)
  }
  for (const block of raw.split(/\n\s*\n/)) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const heading = /^(#{2,4})\s+(.+)$/.exec(trimmed)
    if (heading) {
      const headingTitle = cleanText(heading[2]!)
      if (
        headingTitle.toLocaleLowerCase() === documentTitle.toLocaleLowerCase()
      )
        continue
      flush()
      current = {
        id: slug(headingTitle),
        title: headingTitle,
        paragraphs: []
      }
      continue
    }
    current.paragraphs.push(cleanText(trimmed))
  }
  flush()
  return sections
}

function cleanText(value: string): string {
  return value
    .replace(/^[-*]\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim()
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

function endpointLabel(endpoint: keyof typeof endpointKinds): string {
  return titleCase(endpoint.replaceAll('-', ' '))
}

function slug(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
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
