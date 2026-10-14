import type {
  SessionProfile,
  SessionLootGuidance,
  SessionProposal,
} from "../session-contracts";
import type { ItemInput } from "../progression";
import { copper, xpShare } from "../progression";
import {
  cumulativeGoldCopper,
  type RewardGuidanceRules,
} from "../generation/reward-guidance";
import { readGeneratorRegistry } from "./generation";
import {
  readProgressCharacter,
  ledgerRewardValue,
  checkedLedgerRow,
} from "./progression";
import { readItemDefinition } from "./item-definitions";
/** Validate the saved calculation itself; current XP, prices and presets may have changed. */
export function checkedSessionLootGuidance(
  g: SessionLootGuidance,
  count: number,
): SessionLootGuidance {
  const object = (v: any) => v && typeof v === "object" && !Array.isArray(v);
  const id = (v: any) =>
    typeof v === "string" && !!v.trim() && v.length <= 1000;
  const unsigned = (v: any) => Number.isSafeInteger(v) && v >= 0;
  const amount = (v: any, signed = false) =>
    typeof v === "string" &&
    v.length <= 100 &&
    (signed ? /^-?\d+$/ : /^\d+$/).test(v);
  if (
    !object(g) ||
    g.version !== "cumulative-gold-v1" ||
    !object(g.preset) ||
    !id(g.preset.id) ||
    !unsigned(g.preset.revision) ||
    g.preset.revision < 1 ||
    typeof g.preset.hash !== "string" ||
    !/^[0-9a-f]{64}$/.test(g.preset.hash) ||
    !unsigned(g.rewardXp) ||
    ![
      g.expectedBeforeCopper,
      g.expectedAfterCopper,
      g.receivedCopper,
      g.baselineCopper,
      g.targetCopper,
    ].every((v) => amount(v)) ||
    !amount(g.differenceCopper, true) ||
    !Array.isArray(g.allocationsCopper) ||
    g.allocationsCopper.length !== count ||
    !g.allocationsCopper.every((v) => amount(v)) ||
    !Array.isArray(g.characters) ||
    !g.characters.length ||
    g.characters.length > 1000
  )
    throw new Error("Beuteausgleich der Vorschau beschädigt.");
  for (const c of g.characters)
    if (
      !object(c) ||
      !id(c.characterId) ||
      typeof c.name !== "string" ||
      c.name.length > 1000 ||
      !unsigned(c.xp) ||
      !unsigned(c.revision) ||
      ![c.receivedCopper, c.expectedBeforeCopper, c.expectedAfterCopper].every(
        (v) => amount(v),
      ) ||
      BigInt(c.expectedAfterCopper) < BigInt(c.expectedBeforeCopper)
    )
      throw new Error("Figur des Beuteausgleichs beschädigt.");
  const sum = (
      key: "expectedBeforeCopper" | "expectedAfterCopper" | "receivedCopper",
    ) => g.characters.reduce((n, c) => n + BigInt(c[key]), 0n),
    before = sum("expectedBeforeCopper"),
    after = sum("expectedAfterCopper"),
    received = sum("receivedCopper"),
    target = after > received ? after - received : 0n;
  if (
    new Set(g.characters.map((c) => c.characterId)).size !==
      g.characters.length ||
    before !== BigInt(g.expectedBeforeCopper) ||
    after !== BigInt(g.expectedAfterCopper) ||
    received !== BigInt(g.receivedCopper) ||
    after - before !== BigInt(g.baselineCopper) ||
    before - received !== BigInt(g.differenceCopper) ||
    target !== BigInt(g.targetCopper) ||
    g.allocationsCopper.reduce((n, v) => n + BigInt(v), 0n) !== target
  )
    throw new Error(
      "Beuteausgleich hat widersprüchliche Summen oder doppelte Figuren.",
    );
  return g;
}
function rulesOf(value: unknown): RewardGuidanceRules {
  const r = value as RewardGuidanceRules;
  if (
    !r ||
    !Array.isArray(r.progression) ||
    r.progression.length !== 20 ||
    r.progression.some(
      (p, i) =>
        p.level !== i + 1 ||
        !Number.isSafeInteger(p.xpAtLevel) ||
        p.xpAtLevel < 0 ||
        !Number.isSafeInteger(p.goldAtLevelCp) ||
        p.goldAtLevelCp < 0 ||
        (i > 0 &&
          (p.xpAtLevel <= r.progression[i - 1]!.xpAtLevel ||
            p.goldAtLevelCp < r.progression[i - 1]!.goldAtLevelCp)),
    ) ||
    r.progression[0]!.xpAtLevel !== 0
  )
    throw new Error(
      "Das wirksame Preset benötigt die vollständige Beute-Fortschrittskurve. Automatischen Beuteausgleich ausschalten oder Preset korrigieren.",
    );
  return r;
}
export function sessionLootGuidance(
  db: any,
  cam: string,
  p: SessionProfile,
  proposals: SessionProposal[],
): SessionLootGuidance {
  if (
    !p.party.length ||
    new Set(p.party.map((c) => c.id)).size !== p.party.length ||
    p.party.some((c) => c.count !== 1)
  )
    throw new Error(
      "Automatischer Beuteausgleich benötigt einzelne Roster-Figuren, jede mit Anzahl 1. Freie Planungszeilen weiter ohne automatischen Ausgleich verwenden.",
    );
  const registry = readGeneratorRegistry(db, cam),
    preset = registry.presets.find((p) => p.id === registry.effectiveId)!,
    rules = rulesOf(preset.config.loot),
    ids = new Set(p.party.map((c) => c.id)),
    received = new Map<string, bigint>();
  for (const id of ids) received.set(id, 0n);
  const members = db
    .prepare("SELECT id FROM roster_member WHERE campaign_id=?")
    .all(cam)
    .map((r: any) => r.id);
  for (const id of ids)
    if (!members.includes(id))
      throw new Error(
        "Planungsfigur fehlt im Roster. Für Beuteausgleich vorhandene Figuren wählen.",
      );
  for (const row of db
    .prepare("SELECT * FROM character_ledger WHERE campaign_id=?")
    .iterate(cam)) {
    if (!ids.has(row.character_id)) continue;
    const item = checkedLedgerRow(row),
      value = ledgerRewardValue(db, cam, item);
    if (value === null)
      throw new Error(
        "Ein erhaltener Beutewert ist unbekannt. Wert im Ledger/Katalog klären oder automatischen Ausgleich ausschalten.",
      );
    received.set(row.character_id, received.get(row.character_id)! + value);
  }
  const rewardXp = proposals.reduce(
      (n, p) => n + p.encounter.assessment.baseXp + (p.reward?.poolXp ?? 0),
      0,
    ),
    perCharacter = proposals.reduce(
      (n, p) =>
        n +
        xpShare(
          p.encounter.assessment.baseXp + (p.reward?.poolXp ?? 0),
          ids.size,
        ).share,
      0,
    ),
    characters = p.party.map((c) => {
      const progress = readProgressCharacter(db, cam, c.id);
      if (progress.xp === null)
        throw new Error(
          "Für " +
            c.name +
            " fehlen bestätigte XP. Beuteausgleich benötigt XP, nicht nur ein Planungslevel.",
        );
      return {
        characterId: c.id,
        name: c.name,
        xp: progress.xp,
        revision: progress.revision,
        receivedCopper: String(received.get(c.id)!),
        expectedBeforeCopper: cumulativeGoldCopper(progress.xp, rules),
        expectedAfterCopper: cumulativeGoldCopper(
          progress.xp + perCharacter,
          rules,
        ),
      };
    });
  const sum = (
      key: "expectedBeforeCopper" | "expectedAfterCopper" | "receivedCopper",
    ) => characters.reduce((n, c) => n + BigInt(c[key]), 0n),
    before = sum("expectedBeforeCopper"),
    after = sum("expectedAfterCopper"),
    actual = sum("receivedCopper"),
    target = after > actual ? after - actual : 0n,
    part = target / BigInt(proposals.length),
    rest = target % BigInt(proposals.length);
  return checkedSessionLootGuidance(
    {
      version: "cumulative-gold-v1",
      preset: { id: preset.id, revision: preset.revision, hash: preset.hash },
      rewardXp,
      expectedBeforeCopper: String(before),
      expectedAfterCopper: String(after),
      receivedCopper: String(actual),
      baselineCopper: String(after - before),
      differenceCopper: String(before - actual),
      targetCopper: String(target),
      allocationsCopper: proposals.map((_, i) =>
        String(part + (BigInt(i) < rest ? 1n : 0n)),
      ),
      characters,
    },
    proposals.length,
  );
}
export function rewardItemCopper(db: any, item: ItemInput): bigint {
  const value = item.reference
    ? readItemDefinition(
        db,
        item.reference.definitionId,
        item.reference.revision,
      ).unitCopper
    : copper(item.valueGold);
  if (value === null)
    throw new Error("Geplante Beute benötigt einen bekannten Wert.");
  return BigInt(value) * BigInt(item.quantity);
}
/** Keep table flavor when it fits, reduce quantities to the slice, fill the exact remainder with coin stacks. */
export function fitRewardItems(
  db: any,
  items: ItemInput[],
  budget: string,
): ItemInput[] {
  let remaining = BigInt(budget);
  const result: ItemInput[] = [];
  for (const item of items) {
    const total = rewardItemCopper(db, item),
      unit = total / BigInt(item.quantity),
      quantity =
        unit === 0n
          ? item.quantity
          : Number(
              remaining / unit > BigInt(item.quantity)
                ? BigInt(item.quantity)
                : remaining / unit,
            );
    if (quantity) {
      result.push({ ...structuredClone(item), quantity });
      remaining -= unit * BigInt(quantity);
    }
  }
  for (const [name, unit, valueGold] of [
    ["Goldmünzen", 100n, "1"],
    ["Silbermünzen", 10n, "0.1"],
    ["Kupfermünzen", 1n, "0.01"],
  ] as const) {
    let count = remaining / unit;
    remaining %= unit;
    while (count) {
      const portion = count > 1000000n ? 1000000n : count;
      result.push({
        name,
        quantity: Number(portion),
        valueGold,
        category: "coins",
      });
      count -= portion;
      if (result.length > 100)
        throw new Error(
          "Automatischer Münzvorschlag zu groß. Weniger Szenenbudget oder andere Beutetabellen wählen.",
        );
    }
  }
  if (result.length > 100)
    throw new Error("Höchstens 100 Beuteeinträge pro Vorschlag.");
  return result;
}
export function applyLootGuidance(
  db: any,
  cam: string,
  profile: SessionProfile,
  proposals: SessionProposal[],
) {
  const guidance = sessionLootGuidance(db, cam, profile, proposals);
  for (const [index, p] of proposals.entries()) {
    p.reward = {
      poolXp: p.reward?.poolXp ?? 0,
      items: fitRewardItems(
        db,
        p.reward?.items ?? [],
        guidance.allocationsCopper[index]!,
      ),
    };
  }
  return guidance;
}
