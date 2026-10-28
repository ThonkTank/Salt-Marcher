import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  CreatureCatalog,
  SRD_5_1_ARTIFACT_SHA256,
  SRD_5_1_NOTICE,
  SRD_5_1_REACTION_SUPPLEMENT,
  SRD_5_1_XP_CORRECTIONS,
  type CreatureCatalogQuery,
} from '../../features/catalog/creature-catalog';
const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const effectiveCatalogHash = hash(
  JSON.stringify({
    artifact: SRD_5_1_ARTIFACT_SHA256,
    xpCorrections: SRD_5_1_XP_CORRECTIONS,
    reactions: SRD_5_1_REACTION_SUPPLEMENT,
  }),
);
let catalog: CreatureCatalog | undefined;
function load() {
  if (!catalog) {
    const bytes = readFileSync(path.join(__dirname, 'catalog', 'srd-5.1.generated.json'));
    if (hash(bytes) !== SRD_5_1_ARTIFACT_SHA256)
      throw new Error('Monsterkatalog gehört nicht zum bestätigten Artefakt.');
    catalog = new CreatureCatalog(JSON.parse(bytes.toString('utf8')));
  }
  return catalog;
}
export function creatureInfo() {
  const c = load(),
    unique = (values: readonly string[]) => [...new Set(values)].filter(Boolean).sort();
  return {
    count: c.creatures.length,
    types: unique(c.creatures.map((c) => c.type)),
    subtypes: unique(c.creatures.map((c) => c.subtype)),
    sizes: unique(c.creatures.map((c) => c.size)),
    habitats: unique(c.creatures.flatMap((c) => c.biomes)),
    alignments: unique(c.creatures.map((c) => c.alignment)),
    notice: SRD_5_1_NOTICE,
    hash: effectiveCatalogHash,
  };
}
export function readCreature(id: string) {
  const c = load().detail(id);
  if (!c) throw new Error('Kreatur nicht gefunden.');
  return c;
}
export function searchCreatures(query: CreatureCatalogQuery) {
  const result = load().search(query);
  return {
    ...result,
    rows: result.rows.map((c) => ({
      id: c.id,
      name: c.name,
      challengeRating: c.challengeRating,
      cr: c.cr,
      type: c.type,
      size: c.size,
      ac: c.ac,
      hp: c.hp,
      xp: c.xp,
      sourceLabel: c.sourceLabel,
    })),
  };
}
