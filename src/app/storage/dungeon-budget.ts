import { budgetRarity as rarity } from '../dungeon-budget-contracts';
import { readPreparedGroup } from './session';
import { validateDrawingElement } from '../drawing-contracts';
import { createHash } from 'node:crypto';
import type { GraphView } from '../graph-contracts';
import type { DungeonBudgetView, DungeonFeatureFact } from '../dungeon-budget-contracts';
import {
  dungeonBudgetSummaries,
  emptyBudgetValues,
  featureBudgetOwner,
} from '../dungeon-budget-model';
import { dungeonContentAnchors } from '../dungeon-content-model';
import { readGeneratorRegistry } from './generation';
import { readEncounterPlan, readEncounterPlans } from './encounters';
import { readTreasure } from './progression';
import { readItemDefinition } from './item-definitions';
import { assessEncounter } from '../encounter-contracts';
import { readLive } from './live';
import type { RewardGuidanceRules } from '../generation/reward-guidance';
export function dungeonBudgetView(
  source: any,
  cam: string,
  scopeId: string,
  view: GraphView,
): DungeonBudgetView {
  const registry = readGeneratorRegistry(source, cam),
    preset = registry.presets.find((p) => p.id === registry.effectiveId)!,
    rules = preset.config.loot as RewardGuidanceRules,
    defaultPartySize = Math.max(1, readLive(source, cam).scene?.members.length ?? 4),
    g = view.geometry,
    elements = g.drawing.elements.filter(
      (e) => e.scopeId === scopeId && e.kind === 'feature' && !e.archived,
    ),
    anchors = dungeonContentAnchors(g, elements),
    settings = view.layout.budgets ?? [],
    parent = (id: string) => {
      const k = g.drawing.keyContent?.find((k) => k.id === id);
      return k?.kind === 'group' ? (k.levelId ?? scopeId) : scopeId;
    },
    party = (id: string): number =>
      settings.find((s) => s.ownerId === id)?.partySize ??
      (id === scopeId ? defaultPartySize : party(parent(id))),
    facts: DungeonFeatureFact[] = [];
  for (const e of elements) {
    const anchor = anchors.get(e.id),
      ownerId = featureBudgetOwner(g, scopeId, e.roomId),
      values = emptyBudgetValues(),
      reference = e.content?.reference ?? null,
      problems: string[] = [];
    let label = '';
    if (!e.roomId || !g.rooms.some((r) => r.id === e.roomId))
      problems.push('Inhalt ist ohne Raumgeometrie erhalten.');
    if (e.content && !anchor)
      problems.push('Voxelanker ist ungebunden; Raum und Rasterzelle neu auswählen.');
    try {
      if (e.feature === 'encounter') {
        if (!reference || !['encounter', 'group'].includes(reference.kind)) {
          values.unknownDanger++;
          problems.push('Encounter besitzt keine unabhängige Encounterzuordnung.');
        } else {
          const plan =
            reference.kind === 'group'
              ? readPreparedGroup(source, cam, reference.id).plan
              : readEncounterPlan(source, cam, reference.id);
          label = plan.name;
          const assessment = assessEncounter(
            [{ id: 'dungeon-budget', name: 'Budgetparty', level: null, count: party(ownerId) }],
            plan.entries.map((entry) => ({
              xp: plan.sources.find((c) => c.id === entry.creatureId)?.xp,
              count: entry.count,
            })),
          );
          values.baseXp = assessment.baseXp;
          values.adjustedXp = assessment.adjustedXp;
          values.unknownDanger = assessment.missingXp;
          if (assessment.missingXp) problems.push('Kreaturen-XP sind teilweise unbekannt.');
        }
      } else if (e.feature === 'trap') {
        if (e.content?.trapXp === null || e.content?.trapXp === undefined) values.unknownDanger++;
        else {
          values.baseXp = e.content.trapXp;
          values.adjustedXp = e.content.trapXp;
        }
      } else if (e.feature === 'loot') {
        if (!reference || reference.kind !== 'treasure') {
          values.unknownGold++;
          values.unknownMagic++;
          problems.push('Loot besitzt keine unabhängige Beutezuordnung.');
        } else {
          const treasure = readTreasure(source, cam, reference.id);
          label = treasure.title;
          for (const item of treasure.items) {
            const quantity = Math.max(0, item.quantity - item.allocated);
            if (!quantity) continue;
            const definition = readItemDefinition(
              source,
              item.reference.definitionId,
              item.reference.revision,
            );
            if (definition.magic) {
              const r = rarity(definition.rarity);
              if (r) values.magic[r] += quantity;
              else values.unknownMagic += quantity;
            } else if (item.unitCopper === null) values.unknownGold += quantity;
            else
              values.goldCopper = String(
                BigInt(values.goldCopper) + BigInt(item.unitCopper) * BigInt(quantity),
              );
          }
        }
      }
    } catch (error) {
      problems.push((error as Error).message);
      if (e.feature === 'encounter') values.unknownDanger++;
      if (e.feature === 'loot') {
        values.unknownGold++;
        values.unknownMagic++;
      }
    }
    facts.push({
      id: e.id,
      roomId: e.roomId,
      placed: !!e.roomId && g.rooms.some((r) => r.id === e.roomId) && (!e.content || !!anchor),
      kind: e.feature,
      title: e.name,
      ownerId,
      referenceId: reference?.id ?? null,
      referenceLabel: label,
      problem: problems.length ? problems.join(' ') : null,
      values,
    });
  }
  const usableRules =
    rules && Array.isArray(rules.progression) && rules.progression.length
      ? rules
      : { progression: [] };
  return {
    scopes: dungeonBudgetSummaries(g, view.layout, scopeId, facts, usableRules, defaultPartySize),
    facts,
    preset: { id: preset.id, name: preset.name, revision: preset.revision },
    encounters: readEncounterPlans(source, cam, '')
      .slice(0, 1000)
      .map((e: any) => ({ id: e.id, name: e.name })),
    groups: source
      .prepare(
        "SELECT id,json_extract(payload,'$.title') name FROM prepared_group WHERE campaign_id=? AND draft_plan_id IS NULL ORDER BY rowid DESC LIMIT 1000",
      )
      .all(cam),
    treasures: source
      .prepare(
        "SELECT id,json_extract(payload,'$.title') name FROM treasure WHERE campaign_id=? ORDER BY rowid DESC LIMIT 1000",
      )
      .all(cam),
  };
}
export function validateDungeonPlacement(
  db: any,
  cam: string,
  e: import('../drawing-contracts').DrawingElement,
  skipScopeId: string | null = null,
) {
  const c = e.content;
  if (!c || e.archived || !e.roomId || !c.reference) return;
  for (const row of db
    .prepare(
      "SELECT * FROM drawing_element WHERE campaign_id=? AND kind='feature' AND id<>? AND (? IS NULL OR scope_id<>?)",
    )
    .iterate(cam, e.id, skipScopeId, skipScopeId)) {
    if (createHash('sha256').update(row.payload).digest('hex') !== row.checksum)
      throw new Error('Vorhandene Featurezuordnung ist beschädigt.');
    const other = JSON.parse(row.payload);
    validateDrawingElement(other);
    if (
      other.id !== row.id ||
      other.kind !== row.kind ||
      other.scopeId !== row.scope_id ||
      other.floorId !== row.floor_id ||
      other.roomId !== row.room_id ||
      other.revision !== row.revision
    )
      throw new Error('Vorhandene Featurezuordnung ist widersprüchlich.');
    if (
      !other.archived &&
      other.roomId &&
      other.content?.reference?.kind === c.reference.kind &&
      other.content?.reference?.id === c.reference.id
    )
      throw new Error(
        'Dieser konkrete Encounter / Loot besitzt bereits eine Dungeonplatzierung. Für eine weitere Platzierung eine unabhängige Inhaltskopie verwenden.',
      );
  }
}
