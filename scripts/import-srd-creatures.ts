import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const source =
  'https://api.open5e.com/v1/monsters/?document__slug=wotc-srd&limit=500'
const target = resolve('src/core/creatures/srd-5.1.generated.json')

const xpByCr = new Map<number, number>([
  [0, 10],
  [0.125, 25],
  [0.25, 50],
  [0.5, 100],
  [1, 200],
  [2, 450],
  [3, 700],
  [4, 1100],
  [5, 1800],
  [6, 2300],
  [7, 2900],
  [8, 3900],
  [9, 5000],
  [10, 5900],
  [11, 7200],
  [12, 8400],
  [13, 10000],
  [14, 11500],
  [15, 13000],
  [16, 15000],
  [17, 18000],
  [18, 20000],
  [19, 22000],
  [20, 25000],
  [21, 33000],
  [22, 41000],
  [23, 50000],
  [24, 62000],
  [25, 75000],
  [26, 90000],
  [27, 105000],
  [28, 120000],
  [29, 135000],
  [30, 155000]
])

const response = await fetch(source)
if (!response.ok) throw new Error(`SRD import failed: ${response.status}`)
const payload = (await response.json()) as {
  results: Record<string, unknown>[]
}

const creatures = payload.results
  .map((raw) => {
    const cr = Number(raw['cr'])
    const dexterity = Number(raw['dexterity'])
    const proficiencies = (raw['proficiencies'] ?? []) as {
      value?: number
      proficiency?: { name?: string }
    }[]
    const labeled = (prefix: string) =>
      proficiencies
        .filter((entry) => entry.proficiency?.name?.startsWith(prefix))
        .map(
          (entry) =>
            `${entry.proficiency?.name?.slice(prefix.length) ?? ''} ${signed(entry.value ?? 0)}`
        )
        .join(', ')
    const armor = raw['armor_class']
    const armorClass = Array.isArray(armor)
      ? Number((armor[0] as { value?: number } | undefined)?.value ?? 0)
      : Number(armor)
    const actions = normalizeActions(raw['actions'])
    const traits = normalizeActions(raw['special_abilities'])
    return {
      id: String(raw['slug']),
      name: String(raw['name']),
      cr,
      challengeRating: String(raw['challenge_rating']),
      xp: xpByCr.get(cr) ?? 0,
      type: title(String(raw['type'])),
      subtype: title(scalarText(raw['subtype'])),
      size: String(raw['size']),
      alignment: title(String(raw['alignment'])),
      biomes: ((raw['environments'] ?? []) as unknown[]).map(String).sort(),
      ac: armorClass,
      hp: Number(raw['hit_points']),
      hitDice: scalarText(raw['hit_dice']),
      speed: speedText(raw['speed']),
      initiative: Math.floor((dexterity - 10) / 2),
      abilities: {
        str: Number(raw['strength']),
        dex: dexterity,
        con: Number(raw['constitution']),
        int: Number(raw['intelligence']),
        wis: Number(raw['wisdom']),
        cha: Number(raw['charisma'])
      },
      senses: objectText(raw['senses']),
      languages: scalarText(raw['languages']),
      savingThrows: labeled('Saving Throw: '),
      skills: objectText(raw['skills']) || labeled('Skill: '),
      damageVulnerabilities: listText(raw['damage_vulnerabilities']),
      damageResistances: listText(raw['damage_resistances']),
      damageImmunities: listText(raw['damage_immunities']),
      conditionImmunities: listText(raw['condition_immunities']),
      traits,
      actions,
      legendaryActions: normalizeActions(raw['legendary_actions']),
      details:
        scalarText(raw['desc']).trim() ||
        traits[0]?.description ||
        actions[0]?.description ||
        ''
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))

const sourceHash = createHash('sha256')
  .update(JSON.stringify(payload.results))
  .digest('hex')
const document = {
  manifest: {
    catalogVersion: 'srd-5.1-open5e-wotc-srd-2026-08-01',
    source,
    sourceHash,
    sourceDocument: 'Dungeons & Dragons System Reference Document 5.1',
    license: 'CC-BY-4.0',
    attribution:
      'This work includes material from the System Reference Document 5.1 by Wizards of the Coast LLC, available under CC-BY-4.0.'
  },
  creatures
}

await mkdir(dirname(target), { recursive: true })
await writeFile(target, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

function normalizeActions(
  value: unknown
): { name: string; description: string }[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => {
    const action = entry as Record<string, unknown>
    return {
      name: scalarText(action['name']),
      description: scalarText(action['desc'])
    }
  })
}

function title(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

function speedText(value: unknown): string {
  if (!value || typeof value !== 'object') return scalarText(value)
  return Object.entries(value as Record<string, unknown>)
    .map(([mode, distance]) => `${title(mode)} ${scalarText(distance)}`)
    .join(', ')
}

function objectText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return Object.entries(value as Record<string, unknown>)
    .map(
      ([name, fact]) =>
        `${title(name.replaceAll('_', ' '))} ${scalarText(fact)}`
    )
    .join(', ')
}

function listText(value: unknown): string {
  return Array.isArray(value)
    ? value.map(scalarText).join(', ')
    : scalarText(value)
}

function scalarText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : ''
}
