import bundledSrd from "./data/srd-5.1.generated.json";

export const SRD_5_1_ARTIFACT_SHA256 = "afdce83b65e0863e1247c6297f89460396fe8ce4fd6893139ae3284e8451073d";
export const SRD_5_1_NOTICE = "This work includes material taken from the System Reference Document 5.1 by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document and licensed under CC BY 4.0 at https://creativecommons.org/licenses/by/4.0/. The catalog was normalized by 5e-bits/5e-database v5.10.0, enriched with biome assignments and stable IDs by SaltMarcher, and copied byte-for-byte into this plugin.";

const PINNED_MANIFEST = Object.freeze({
  catalogVersion: "v5.10.0",
  upstreamCommit: "3f5593ea004c4f5a2af95603087ce4de72689d9f",
  archiveSha256: "200d84ced9b85049ebd975d497463a10b5b31560f8d86424fd98ae4780eb84c4",
  source: "https://github.com/5e-bits/5e-database/tree/v5.10.0",
  sourceHash: "200d84ced9b85049ebd975d497463a10b5b31560f8d86424fd98ae4780eb84c4",
  sourceDocument: "Dungeons & Dragons System Reference Document 5.1",
  license: "CC-BY-4.0",
  attribution: "This work includes material taken from the System Reference Document 5.1 (SRD 5.1) by Wizards of the Coast LLC and available under CC BY 4.0.",
} as const);

export type CreatureRulesVersion = "2014";
export type CreatureCatalogSort = "name" | "cr" | "xp" | "ac" | "hp";

export interface CreatureAction {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface Creature {
  readonly id: string;
  readonly name: string;
  readonly cr: number;
  readonly challengeRating: string;
  readonly xp: number;
  readonly type: string;
  readonly subtype: string;
  readonly size: string;
  readonly alignment: string;
  readonly biomes: readonly string[];
  readonly ac: number;
  readonly hp: number;
  readonly hitDice: string;
  readonly speed: string;
  readonly initiative: number;
  readonly abilities: Readonly<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>;
  readonly senses: string;
  readonly languages: string;
  readonly savingThrows: string;
  readonly skills: string;
  readonly damageVulnerabilities: string;
  readonly damageResistances: string;
  readonly damageImmunities: string;
  readonly conditionImmunities: string;
  readonly traits: readonly CreatureAction[];
  readonly actions: readonly CreatureAction[];
  readonly legendaryActions: readonly CreatureAction[];
  readonly details: string;
  readonly sourceId: string;
  readonly sourceLabel: string;
  readonly sourceVersion: string;
  readonly rulesVersion: CreatureRulesVersion;
  readonly legacy: boolean;
}

export interface CreatureCatalogManifest {
  readonly catalogVersion: string;
  readonly upstreamCommit: string;
  readonly archiveSha256: string;
  readonly source: string;
  readonly sourceHash: string;
  readonly sourceDocument: string;
  readonly license: "CC-BY-4.0";
  readonly attribution: string;
}

export interface CreatureCatalogQuery {
  readonly text?: string;
  readonly crMin?: number;
  readonly crMax?: number;
  readonly sizes?: readonly string[];
  readonly types?: readonly string[];
  readonly subtypes?: readonly string[];
  readonly habitats?: readonly string[];
  readonly alignments?: readonly string[];
  readonly acMin?: number;
  readonly acMax?: number;
  readonly hpMin?: number;
  readonly hpMax?: number;
  readonly movement?: string;
  readonly senses?: string;
  readonly vulnerabilities?: string;
  readonly resistances?: string;
  readonly immunities?: string;
  readonly conditionImmunities?: string;
  readonly sourceIds?: readonly string[];
  readonly sort?: CreatureCatalogSort;
  readonly direction?: "asc" | "desc";
  readonly offset?: number;
  readonly limit?: number;
}

export interface CreatureCatalogPage {
  readonly rows: readonly Creature[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
}

interface RawCatalog {
  readonly manifest: CreatureCatalogManifest;
  readonly creatures: readonly Omit<Creature,
    "sourceId" | "sourceLabel" | "sourceVersion" | "rulesVersion" | "legacy">[];
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} muss ein Objekt sein.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} muss Text sein.`);
  return value;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${label} muss eine endliche Zahl sein.`);
  return value;
}

function integer(value: unknown, label: string): number {
  const parsed = number(value, label);
  if (!Number.isInteger(parsed)) throw new Error(`${label} muss ganzzahlig sein.`);
  return parsed;
}

function strings(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} muss eine Liste sein.`);
  return value.map((entry, index) => text(entry, `${label}[${index}]`));
}

function actions(value: unknown, label: string): readonly CreatureAction[] {
  if (!Array.isArray(value)) throw new Error(`${label} muss eine Liste sein.`);
  return value.map((entry, index) => {
    const row = object(entry, `${label}[${index}]`);
    return {
      id: text(row.id, `${label}[${index}].id`),
      name: text(row.name, `${label}[${index}].name`),
      description: text(row.description, `${label}[${index}].description`),
    };
  });
}

function abilityScores(value: unknown, label: string): Creature["abilities"] {
  const row = object(value, label);
  return {
    str: integer(row.str, `${label}.str`),
    dex: integer(row.dex, `${label}.dex`),
    con: integer(row.con, `${label}.con`),
    int: integer(row.int, `${label}.int`),
    wis: integer(row.wis, `${label}.wis`),
    cha: integer(row.cha, `${label}.cha`),
  };
}

function rawCreature(value: unknown, index: number): RawCatalog["creatures"][number] {
  const label = `creatures[${index}]`, row = object(value, label);
  const id = text(row.id, `${label}.id`).trim();
  if (!id) throw new Error(`${label}.id darf nicht leer sein.`);
  const cr = number(row.cr, `${label}.cr`), xp = integer(row.xp, `${label}.xp`),
    ac = integer(row.ac, `${label}.ac`), hp = integer(row.hp, `${label}.hp`);
  if (cr < 0 || xp < 0 || ac < 0 || hp < 0)
    throw new Error(`${label} enthält einen negativen Kampfwert.`);
  return {
    id,
    name: text(row.name, `${label}.name`),
    cr,
    challengeRating: text(row.challengeRating, `${label}.challengeRating`),
    xp,
    type: text(row.type, `${label}.type`),
    subtype: text(row.subtype, `${label}.subtype`),
    size: text(row.size, `${label}.size`),
    alignment: text(row.alignment, `${label}.alignment`),
    biomes: strings(row.biomes, `${label}.biomes`),
    ac,
    hp,
    hitDice: text(row.hitDice, `${label}.hitDice`),
    speed: text(row.speed, `${label}.speed`),
    initiative: integer(row.initiative, `${label}.initiative`),
    abilities: abilityScores(row.abilities, `${label}.abilities`),
    senses: text(row.senses, `${label}.senses`),
    languages: text(row.languages, `${label}.languages`),
    savingThrows: text(row.savingThrows, `${label}.savingThrows`),
    skills: text(row.skills, `${label}.skills`),
    damageVulnerabilities: text(row.damageVulnerabilities, `${label}.damageVulnerabilities`),
    damageResistances: text(row.damageResistances, `${label}.damageResistances`),
    damageImmunities: text(row.damageImmunities, `${label}.damageImmunities`),
    conditionImmunities: text(row.conditionImmunities, `${label}.conditionImmunities`),
    traits: actions(row.traits, `${label}.traits`),
    actions: actions(row.actions, `${label}.actions`),
    legendaryActions: actions(row.legendaryActions, `${label}.legendaryActions`),
    details: text(row.details, `${label}.details`),
  };
}

export function parseCreatureCatalog(value: unknown): RawCatalog {
  const root = object(value, "Katalog"), manifestValue = object(root.manifest, "manifest");
  const license = text(manifestValue.license, "manifest.license");
  if (license !== "CC-BY-4.0")
    throw new Error(`Nicht unterstützte Kataloglizenz: ${license || "leer"}.`);
  if (!Array.isArray(root.creatures)) throw new Error("creatures muss eine Liste sein.");
  const manifest: CreatureCatalogManifest = {
    catalogVersion: text(manifestValue.catalogVersion, "manifest.catalogVersion"),
    upstreamCommit: text(manifestValue.upstreamCommit, "manifest.upstreamCommit"),
    archiveSha256: text(manifestValue.archiveSha256, "manifest.archiveSha256"),
    source: text(manifestValue.source, "manifest.source"),
    sourceHash: text(manifestValue.sourceHash, "manifest.sourceHash"),
    sourceDocument: text(manifestValue.sourceDocument, "manifest.sourceDocument"),
    license,
    attribution: text(manifestValue.attribution, "manifest.attribution"),
  };
  for (const field of Object.keys(PINNED_MANIFEST) as (keyof CreatureCatalogManifest)[])
    if (manifest[field] !== PINNED_MANIFEST[field])
      throw new Error(`manifest.${field} stimmt nicht mit dem gepinnten SRD-5.1-Artefakt überein.`);
  const creatures = root.creatures.map(rawCreature), ids = new Set<string>();
  for (const creature of creatures) {
    if (ids.has(creature.id)) throw new Error(`Doppelte Kreaturenkennung: ${creature.id}.`);
    ids.add(creature.id);
  }
  return { manifest, creatures };
}

function normalized(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("en-US").trim();
}

function compareText(left: string, right: string): number {
  const a = normalized(left), b = normalized(right);
  return a < b ? -1 : a > b ? 1 : left < right ? -1 : left > right ? 1 : 0;
}

function contains(value: string, search: string | undefined): boolean {
  const needle = normalized(search ?? "");
  return !needle || normalized(value).includes(needle);
}

function oneOf(value: string, selected: readonly string[] | undefined): boolean {
  return !selected?.length || selected.some((entry) => normalized(entry) === normalized(value));
}

function overlaps(values: readonly string[], selected: readonly string[] | undefined): boolean {
  return !selected?.length || selected.some((entry) => values.some((value) => normalized(value) === normalized(entry)));
}

function bounded(value: number, min: number | undefined, max: number | undefined): boolean {
  return (min === undefined || value >= min) && (max === undefined || value <= max);
}

export function creatureMatchesQuery(creature: Creature, query: CreatureCatalogQuery): boolean {
  return contains(creature.name, query.text) &&
    bounded(creature.cr, query.crMin, query.crMax) &&
    bounded(creature.ac, query.acMin, query.acMax) &&
    bounded(creature.hp, query.hpMin, query.hpMax) &&
    oneOf(creature.size, query.sizes) && oneOf(creature.type, query.types) &&
    oneOf(creature.subtype, query.subtypes) && oneOf(creature.alignment, query.alignments) &&
    overlaps(creature.biomes, query.habitats) && contains(creature.speed, query.movement) &&
    contains(creature.senses, query.senses) &&
    contains(creature.damageVulnerabilities, query.vulnerabilities) &&
    contains(creature.damageResistances, query.resistances) &&
    contains(creature.damageImmunities, query.immunities) &&
    contains(creature.conditionImmunities, query.conditionImmunities) &&
    oneOf(creature.sourceId, query.sourceIds);
}

export class CreatureCatalog {
  readonly manifest: CreatureCatalogManifest;
  readonly creatures: readonly Creature[];
  private readonly byId: ReadonlyMap<string, Creature>;

  constructor(value: unknown) {
    const parsed = parseCreatureCatalog(value);
    this.manifest = deepFreeze(parsed.manifest);
    this.creatures = deepFreeze(parsed.creatures.map((creature) => ({
      ...creature,
      sourceId: "srd-5.1",
      sourceLabel: parsed.manifest.sourceDocument,
      sourceVersion: parsed.manifest.catalogVersion,
      rulesVersion: "2014" as const,
      legacy: true,
    })));
    this.byId = new Map(this.creatures.map((creature) => [creature.id, creature]));
  }

  detail(id: string): Creature | undefined {
    return this.byId.get(id);
  }

  search(query: CreatureCatalogQuery = {}): CreatureCatalogPage {
    query = validatedQuery(query);
    const offset = query.offset ?? 0, limit = query.limit ?? 50;
    if (query.crMin !== undefined && query.crMax !== undefined && query.crMin > query.crMax)
      throw new Error("Der minimale HG darf den maximalen HG nicht überschreiten.");
    if (query.acMin !== undefined && query.acMax !== undefined && query.acMin > query.acMax)
      throw new Error("Die minimale RK darf die maximale RK nicht überschreiten.");
    if (query.hpMin !== undefined && query.hpMax !== undefined && query.hpMin > query.hpMax)
      throw new Error("Die minimalen TP dürfen die maximalen TP nicht überschreiten.");
    const direction = query.direction === "desc" ? -1 : 1, sort = query.sort ?? "name";
    const rows = this.creatures.filter((creature) => creatureMatchesQuery(creature, query)).sort((left, right) => {
      const primary = sort === "name" ? compareText(left.name, right.name) : left[sort] - right[sort];
      return primary * direction || compareText(left.name, right.name) || compareText(left.id, right.id);
    });
    return { rows: rows.slice(offset, offset + limit), total: rows.length, offset, limit };
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function validatedQuery(input: CreatureCatalogQuery): CreatureCatalogQuery {
  const query = object(input, "query");
  const numeric = ["crMin", "crMax", "acMin", "acMax", "hpMin", "hpMax"] as const;
  for (const key of numeric) if (query[key] !== undefined &&
    (typeof query[key] !== "number" || !Number.isFinite(query[key]) || query[key] < 0))
    throw new Error(`query.${key} muss eine nichtnegative endliche Zahl sein.`);
  for (const key of ["text", "movement", "senses", "vulnerabilities", "resistances", "immunities", "conditionImmunities"] as const)
    if (query[key] !== undefined && typeof query[key] !== "string")
      throw new Error(`query.${key} muss Text sein.`);
  for (const key of ["sizes", "types", "subtypes", "habitats", "alignments", "sourceIds"] as const)
    if (query[key] !== undefined) strings(query[key], `query.${key}`);
  const sorts: readonly CreatureCatalogSort[] = ["name", "cr", "xp", "ac", "hp"];
  if (query.sort !== undefined && !sorts.includes(query.sort as CreatureCatalogSort))
    throw new Error("query.sort enthält eine unbekannte Sortierung.");
  if (query.direction !== undefined && query.direction !== "asc" && query.direction !== "desc")
    throw new Error("query.direction enthält eine unbekannte Richtung.");
  for (const [key, fallback, minimum, maximum] of [["offset", 0, 0, Number.MAX_SAFE_INTEGER], ["limit", 50, 1, 100]] as const) {
    const value = query[key] ?? fallback;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum)
      throw new Error(`query.${key} liegt außerhalb des gültigen Bereichs.`);
  }
  return input;
}

export const bundledCreatureCatalog = new CreatureCatalog(bundledSrd);
