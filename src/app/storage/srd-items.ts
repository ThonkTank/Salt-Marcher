import transcriptAsset from "../../features/catalog/data/items-srd51-transcript.json";
import manifestAsset from "../../features/catalog/data/items-srd51-source-manifest.json";
import { createHash } from "node:crypto";
import { canonicalJson } from "../generation/canonical-json";
import type { ItemDefinition } from "../items-contracts";
interface SourceRecord {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  magic: boolean;
  attunement: string;
  cost?: { sourceText: string; copperPieces?: number | null };
  weight?: { sourceText: string };
  rarity?: { value?: string; sourceText?: string };
  properties: { name: string; sourceText?: string }[];
  description: { text: string }[];
  armor?: Record<string, string>;
  damage?: Record<string, string>;
  speed?: { sourceText: string };
  carryingCapacity?: { sourceText: string };
  sourceHeader?: { text: string };
  source: { pdfUrl: string; pdfPages: number[] };
}
const transcript = transcriptAsset as {
  complete: boolean;
  records: SourceRecord[];
};
const manifest = manifestAsset as {
  complete: boolean;
  coverage: { inventoryOccurrences: number; transcriptRecords: number };
  source: { license: string; pdfUrl: string };
};
export const srdItemSourceStatus = {
  complete: manifest.complete && transcript.complete,
  message: `${transcript.records.length} erfasste SRD-5.1-Definitionen + eigene Gegenstände · ${manifest.coverage.inventoryOccurrences}/459 Quellenfundstellen erfasst; vollständiger Katalog und unabhängige Quellenabnahme offen.`,
};
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function project(r: SourceRecord): ItemDefinition {
  const details: string[] = [];
  if (r.sourceHeader) details.push(r.sourceHeader.text);
  if (r.cost) details.push("Price: " + r.cost.sourceText);
  if (r.armor) {
    const labels: Record<string, string> = {
      armorClassText: "Armor Class",
      dexterityRuleText: "Dexterity",
      strengthRuleText: "Strength",
      stealthRuleText: "Stealth",
    };
    details.push(
      ...Object.entries(r.armor).map(([k, v]) => (labels[k] ?? k) + ": " + v),
    );
  }
  if (r.damage) details.push("Damage: " + Object.values(r.damage).join(" · "));
  if (r.speed) details.push("Speed: " + r.speed.sourceText);
  if (r.carryingCapacity)
    details.push("Carrying capacity: " + r.carryingCapacity.sourceText);
  const cost = r.cost?.copperPieces;
  return {
    id: r.id,
    revision: 1,
    name: r.name,
    category: r.magic ? "magic" : "equipment",
    magic: r.magic,
    rarity: r.rarity?.value ?? r.rarity?.sourceText ?? "",
    attunement:
      r.attunement === "required"
        ? "yes"
        : r.attunement === "not-required"
          ? "no"
          : "unspecified",
    unitCopper: cost === null || cost === undefined ? null : String(cost),
    weightText: r.weight?.sourceText ?? "",
    properties: r.properties.map((p) => p.sourceText ?? p.name),
    description: [...details, ...r.description.map((d) => d.text)].join("\n\n"),
    source: {
      kind: "srd51",
      label: "SRD 5.1 · " + r.source.pdfPages.map((p) => "S. " + p).join(", "),
      license: manifest.source.license,
      url: r.source.pdfUrl + "#page=" + r.source.pdfPages[0],
    },
    trashed: false,
    sourceHash: hash(canonicalJson(r)),
  };
}
export const srdItemDefinitions: readonly ItemDefinition[] =
  transcript.records.map(project);
