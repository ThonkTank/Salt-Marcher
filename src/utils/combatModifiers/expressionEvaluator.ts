// Ziel: Interpreter für Schema-driven Condition Expressions
// Siehe: docs/services/combatantAI/combatantAI.md
//
// ============================================================================
// ⚠️ ON HOLD - Combat-Implementierung ist vorübergehend pausiert.
// Diese Datei wird aktuell nicht verwendet.
// ============================================================================
//
// Evaluiert ConditionExpression gegen ModifierContext.
// Unterstützt:
// - Logical operators: and, or, not
// - Quantified entity checks: exists
// - Spatial predicates: adjacent-to, within-range, opposite-side
// - State predicates: has-condition, is-incapacitated, hp-threshold
// - Action predicates: action-has-property, action-is-type, action-range-type

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [TODO]: Predicate String Shorthand Parser
// - Spec: docs/types/combatEvent.md#predicate-syntax
// - evaluateCondition() erwartet Object-Form Precondition
// - Benötigt: preprocessPredicate(expr) vor Auswertung
// - Beispiel: "target:condition:prone" → { type: 'has-condition', entity: 'target', condition: 'prone' }
//
// [HACK]: has-line-of-sight STUB
// - evaluateHasLineOfSight() returned immer true
// - Benötigt: LOS-Berechnung gegen Terrain/Obstacles aus CombatState
// - Abhängigkeit: gridLineOfSight.ts Integration
//
// [HACK]: has-advantage nicht implementiert
// - Returns false mit "not yet supported" log
// - Benötigt: Zugriff auf bereits berechnete Modifiers
// - Zirkuläre Abhängigkeit vermeiden (Modifier → Condition → Modifier)
//
// [HACK]: has-free-hands STUB
// - evaluateHasFreeHands() returned immer true
// - Benötigt: Equipment-System mit Händen-Tracking
// - Abhängigkeit: Equipment-Entity und Hand-Slot-Logik
//

import type {
  CombatEvent,
  Precondition as ConditionExpression,
  EntityRef,
  QuantifiedEntity,
  ExistsExpression,
  SizeCategory,
} from '@/types/entities/combatEvent';
import { CREATURE_SIZES } from '@/constants/creature';
import type {
  ModifierContext,
  ModifierSimulationState,
} from '@/services/combatantAI/situationalModifiers';
import { getDistance, isAllied, isHostile, feetToCell } from './helpers';
import { isNPC, type GridPosition, type Combatant } from '@/types/combat';
import { getExpectedValue } from '@/utils';
import { getAC, getResolvedCreature } from '@/services/combatTracking';

// ============================================================================
// DEBUG
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[expressionEvaluator]', ...args);
  }
};

// ============================================================================
// EVALUATION CONTEXT
// ============================================================================

/**
 * Extended context for expression evaluation.
 * Includes 'self' which may differ from 'attacker' in some contexts.
 */
export interface EvaluationContext {
  /** The entity that owns this modifier (for exists where clauses) */
  self: Combatant;
  /** The attacking entity */
  attacker: Combatant;
  /** The target entity */
  target: Combatant;
  /** The action being evaluated */
  action: CombatEvent;
  /** Full simulation state for entity queries */
  state: ModifierSimulationState;
  /** Alliances lookup */
  alliances: Record<string, string[]>;
}

/**
 * Creates EvaluationContext from ModifierContext.
 * By default, 'self' is the attacker.
 */
export function createEvaluationContext(modCtx: ModifierContext): EvaluationContext {
  return {
    self: modCtx.attacker,
    attacker: modCtx.attacker,
    target: modCtx.target,
    action: modCtx.action,
    state: modCtx.state,
    alliances: modCtx.state.alliances,
  };
}

// ============================================================================
// ENTITY RESOLUTION
// ============================================================================

/**
 * Resolves an entity reference to its Combatant.
 */
function resolveEntity(ref: EntityRef, ctx: EvaluationContext): Combatant {
  switch (ref) {
    case 'self':
      return ctx.self;
    case 'attacker':
      return ctx.attacker;
    case 'target':
      return ctx.target;
  }
}

/**
 * Resolves an entity reference to its position.
 */
function resolveEntityPosition(ref: EntityRef, ctx: EvaluationContext): GridPosition {
  return resolveEntity(ref, ctx).combatState.position;
}

/**
 * Gets filtered entities based on quantified entity specification.
 * Verwendet direkt Combatants aus dem State.
 */
function getFilteredEntities(
  quantified: QuantifiedEntity,
  ctx: EvaluationContext
): Combatant[] {
  const relativeTo = quantified.relativeTo ?? 'attacker';
  const referenceEntity = resolveEntity(relativeTo, ctx);
  const referenceGroupId = referenceEntity.combatState.groupId;

  return ctx.state.combatants.filter((c) => {
    // Never include the reference entity itself
    if (c.id === referenceEntity.id) return false;

    const groupId = c.combatState.groupId;
    switch (quantified.filter) {
      case 'ally':
        return isAllied(groupId, referenceGroupId, ctx.alliances);
      case 'enemy':
        return isHostile(groupId, referenceGroupId, ctx.alliances);
      case 'any-creature':
        return true;
    }
  });
}

// ============================================================================
// INCAPACITATION CHECK
// ============================================================================

/** D&D 5e conditions that cause incapacitation */
const INCAPACITATING_CONDITIONS = [
  'incapacitated',
  'paralyzed',
  'petrified',
  'stunned',
  'unconscious',
] as const;

/**
 * Checks if an entity has any incapacitating condition.
 */
function isEntityIncapacitated(entity: Combatant): boolean {
  return entity.combatState.conditions.some(
    (c) =>
      INCAPACITATING_CONDITIONS.includes(c.name as typeof INCAPACITATING_CONDITIONS[number]) ||
      INCAPACITATING_CONDITIONS.includes(c.effect as typeof INCAPACITATING_CONDITIONS[number])
  );
}

// ============================================================================
// MAIN EVALUATION FUNCTION
// ============================================================================

/**
 * Evaluates a condition expression against an evaluation context.
 *
 * @param expr The condition expression to evaluate
 * @param ctx The evaluation context
 * @returns true if the condition is satisfied
 */
export function evaluateCondition(
  expr: ConditionExpression,
  ctx: EvaluationContext
): boolean {
  debug('evaluateCondition:', { type: expr.type });

  switch (expr.type) {
    // === Logical Operators ===
    case 'and':
      return expr.conditions.every((c) => evaluateCondition(c, ctx));

    case 'or':
      return expr.conditions.some((c) => evaluateCondition(c, ctx));

    case 'not':
      return !evaluateCondition(expr.condition, ctx);

    case 'exists':
      return evaluateExists(expr, ctx);

    // === Spatial Predicates ===
    case 'adjacent-to':
      return evaluateAdjacentTo(expr, ctx);

    case 'within-range':
      return evaluateWithinRange(expr, ctx);

    case 'beyond-range':
      return evaluateBeyondRange(expr, ctx);

    case 'opposite-side':
      return evaluateOppositeSide(expr, ctx);

    case 'in-line-between':
      return evaluateInLineBetween(expr, ctx);

    case 'has-line-of-sight':
      return evaluateHasLineOfSight(expr, ctx);

    // === Action Range Predicates ===
    case 'target-in-long-range':
      return evaluateTargetInLongRange(ctx);

    case 'target-beyond-normal-range':
      return evaluateTargetBeyondNormalRange(ctx);

    // === State Predicates ===
    case 'has-condition':
      return evaluateHasCondition(expr, ctx);

    case 'is-incapacitated':
      return evaluateIsIncapacitated(expr, ctx);

    case 'hp-threshold':
      return evaluateHpThreshold(expr, ctx);

    case 'is-ally':
      return evaluateIsAlly(expr, ctx);

    case 'is-enemy':
      return evaluateIsEnemy(expr, ctx);

    case 'has-advantage':
      // HACK: siehe Header - has-advantage nicht implementiert
      // Note: This requires access to already-computed modifiers
      // For now, return false as this is a complex case
      debug('has-advantage: not yet supported, returning false');
      return false;

    case 'is-creature-type':
      return evaluateIsCreatureType(expr, ctx);

    // === Equipment Predicates ===
    case 'has-free-hands':
      return evaluateHasFreeHands(expr, ctx);

    // === Action Predicates ===
    case 'action-has-property':
      return ctx.action.properties?.includes(expr.property) ?? false;

    case 'action-is-type':
      return ctx.action.actionType === expr.actionType;

    case 'action-range-type':
      return ctx.action.range?.type === expr.rangeType;

    case 'action-is-id': {
      const ids = Array.isArray(expr.actionId) ? expr.actionId : [expr.actionId];
      return ids.includes(ctx.action.id);
    }

    case 'size-category':
      return evaluateSizeCategory(expr, ctx);

    default:
      console.warn(`[expressionEvaluator] Unknown expression type: ${(expr as { type: string }).type}`);
      return false;
  }
}

// ============================================================================
// PREDICATE IMPLEMENTATIONS
// ============================================================================

// --- Existential Quantifier ---

function evaluateExists(expr: ExistsExpression, ctx: EvaluationContext): boolean {
  const candidates = getFilteredEntities(expr.entity, ctx);

  if (candidates.length === 0) return false;

  // count-gte quantifier
  if (expr.entity.quantifier === 'count-gte') {
    const threshold = expr.entity.count ?? 1;

    if (expr.where) {
      // Count how many satisfy the where clause
      const satisfyingCount = candidates.filter((candidate) => {
        const innerCtx: EvaluationContext = { ...ctx, self: candidate };
        return evaluateCondition(expr.where!, innerCtx);
      }).length;
      return satisfyingCount >= threshold;
    }

    return candidates.length >= threshold;
  }

  // 'any' or 'all' quantifier
  if (expr.where) {
    const checkFn = (candidate: Combatant): boolean => {
      const innerCtx: EvaluationContext = { ...ctx, self: candidate };
      return evaluateCondition(expr.where!, innerCtx);
    };

    if (expr.entity.quantifier === 'all') {
      return candidates.every(checkFn);
    }
    return candidates.some(checkFn);
  }

  // No where clause: just check existence
  return candidates.length > 0;
}

// --- Spatial Predicates ---

function evaluateAdjacentTo(
  expr: { type: 'adjacent-to'; subject: EntityRef; object: EntityRef },
  ctx: EvaluationContext
): boolean {
  const subjectPos = resolveEntityPosition(expr.subject, ctx);
  const objectPos = resolveEntityPosition(expr.object, ctx);
  return getDistance(subjectPos, objectPos) <= 1; // 1 cell = 5ft
}

function evaluateWithinRange(
  expr: { type: 'within-range'; subject: EntityRef; object: EntityRef; range: number },
  ctx: EvaluationContext
): boolean {
  const subjectPos = resolveEntityPosition(expr.subject, ctx);
  const objectPos = resolveEntityPosition(expr.object, ctx);
  const rangeCells = feetToCell(expr.range);
  return getDistance(subjectPos, objectPos) <= rangeCells;
}

function evaluateBeyondRange(
  expr: { type: 'beyond-range'; subject: EntityRef; object: EntityRef; range: number },
  ctx: EvaluationContext
): boolean {
  const subjectPos = resolveEntityPosition(expr.subject, ctx);
  const objectPos = resolveEntityPosition(expr.object, ctx);
  const rangeCells = feetToCell(expr.range);
  return getDistance(subjectPos, objectPos) > rangeCells;
}

function evaluateOppositeSide(
  expr: {
    type: 'opposite-side';
    subject: EntityRef;
    center: EntityRef;
    of: EntityRef;
    angle?: number;
  },
  ctx: EvaluationContext
): boolean {
  const subjectPos = resolveEntityPosition(expr.subject, ctx);
  const centerPos = resolveEntityPosition(expr.center, ctx);
  const ofPos = resolveEntityPosition(expr.of, ctx);

  const angleThreshold = expr.angle ?? 180;

  // Calculate vectors from center to each entity
  const toSubject = { x: subjectPos.x - centerPos.x, y: subjectPos.y - centerPos.y };
  const toOf = { x: ofPos.x - centerPos.x, y: ofPos.y - centerPos.y };

  // Calculate angle between vectors using dot product
  const dot = toSubject.x * toOf.x + toSubject.y * toOf.y;
  const magSubject = Math.sqrt(toSubject.x ** 2 + toSubject.y ** 2);
  const magOf = Math.sqrt(toOf.x ** 2 + toOf.y ** 2);

  if (magSubject === 0 || magOf === 0) return false;

  const cosAngle = dot / (magSubject * magOf);
  const angleDegrees = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);

  return angleDegrees >= angleThreshold;
}

function evaluateInLineBetween(
  expr: { type: 'in-line-between'; entity: EntityRef; from: EntityRef; to: EntityRef },
  ctx: EvaluationContext
): boolean {
  const entityPos = resolveEntityPosition(expr.entity, ctx);
  const fromPos = resolveEntityPosition(expr.from, ctx);
  const toPos = resolveEntityPosition(expr.to, ctx);

  // Use Bresenham-like check: entity is roughly on the line between from and to
  // Simplified: check if entity is between from and to in both axes

  const minX = Math.min(fromPos.x, toPos.x);
  const maxX = Math.max(fromPos.x, toPos.x);
  const minY = Math.min(fromPos.y, toPos.y);
  const maxY = Math.max(fromPos.y, toPos.y);

  // Entity must be within bounding box
  if (entityPos.x < minX || entityPos.x > maxX) return false;
  if (entityPos.y < minY || entityPos.y > maxY) return false;

  // Calculate perpendicular distance to line
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const lineLength = Math.sqrt(dx * dx + dy * dy);

  if (lineLength === 0) {
    // from and to are same position
    return entityPos.x === fromPos.x && entityPos.y === fromPos.y;
  }

  // Perpendicular distance formula
  const perpDistance =
    Math.abs(dy * entityPos.x - dx * entityPos.y + toPos.x * fromPos.y - toPos.y * fromPos.x) /
    lineLength;

  // Allow 1 cell tolerance for "in line"
  return perpDistance <= 1;
}

/** HACK: siehe Header - LOS STUB */
function evaluateHasLineOfSight(
  _expr: { type: 'has-line-of-sight'; from: EntityRef; to: EntityRef },
  _ctx: EvaluationContext
): boolean {
  // For now, assume line of sight exists if no blocking terrain
  // Full implementation would need terrain/obstacle data
  debug('has-line-of-sight: assuming clear LOS (terrain not implemented)');
  return true;
}

// --- Action Range Predicates ---

/**
 * Helper to get range from action (supports both legacy and new schema).
 * Legacy: action.range
 * New: action.targeting.range (for single/multi targeting types)
 */
function getActionRange(action: EvaluationContext['action']): { normal?: number; long?: number } | null {
  // Legacy format: action.range
  if (action.range) {
    return action.range;
  }
  // New schema: action.targeting.range
  const targeting = action.targeting;
  if (targeting && 'range' in targeting && targeting.range) {
    const range = targeting.range as { type: string; normal?: number; long?: number; disadvantage?: number };
    if (range.type === 'ranged') {
      return {
        normal: range.normal,
        long: range.long ?? range.disadvantage, // long is alias for disadvantage in schema
      };
    }
  }
  return null;
}

function evaluateTargetInLongRange(ctx: EvaluationContext): boolean {
  const { action, attacker, target } = ctx;

  const range = getActionRange(action);
  if (!range?.long) return false;

  const distance = getDistance(attacker.combatState.position, target.combatState.position);
  const normalRangeCells = feetToCell(range.normal);
  const longRangeCells = feetToCell(range.long);

  return distance > normalRangeCells && distance <= longRangeCells;
}

function evaluateTargetBeyondNormalRange(ctx: EvaluationContext): boolean {
  const { action, attacker, target } = ctx;

  const range = getActionRange(action);
  if (!range?.normal) {
    debug('target-beyond-normal-range: no range found', { hasRange: !!range });
    return false;
  }

  const distance = getDistance(attacker.combatState.position, target.combatState.position);
  const normalRangeCells = feetToCell(range.normal);
  const result = distance > normalRangeCells;

  debug('target-beyond-normal-range:', {
    distance,
    normalRangeCells,
    result,
  });

  return result;
}

// --- State Predicates ---

function evaluateHasCondition(
  expr: { type: 'has-condition'; entity: EntityRef; condition: string; negate?: boolean },
  ctx: EvaluationContext
): boolean {
  const entity = resolveEntity(expr.entity, ctx);
  const hasCondition = entity.combatState.conditions.some(
    (c) => c.name === expr.condition || c.effect === expr.condition
  );
  return expr.negate ? !hasCondition : hasCondition;
}

function evaluateIsIncapacitated(
  expr: { type: 'is-incapacitated'; entity: EntityRef; negate?: boolean },
  ctx: EvaluationContext
): boolean {
  const entity = resolveEntity(expr.entity, ctx);
  const isIncap = isEntityIncapacitated(entity);
  return expr.negate ? !isIncap : isIncap;
}

function evaluateHpThreshold(
  expr: {
    type: 'hp-threshold';
    entity: EntityRef;
    comparison: 'below' | 'above' | 'equal-or-below' | 'equal-or-above';
    threshold: number;
  },
  ctx: EvaluationContext
): boolean {
  const entity = resolveEntity(expr.entity, ctx);

  // Calculate HP percentage (threshold is 0-100)
  if (entity.maxHp <= 0) {
    debug('hp-threshold: maxHp is 0 or negative, returning false');
    return false;
  }

  const hp = getExpectedValue(entity.currentHp);
  const hpPercent = (hp / entity.maxHp) * 100;

  debug('hp-threshold:', {
    hp,
    maxHp: entity.maxHp,
    hpPercent,
    comparison: expr.comparison,
    threshold: expr.threshold,
  });

  switch (expr.comparison) {
    case 'below':
      return hpPercent < expr.threshold;
    case 'above':
      return hpPercent > expr.threshold;
    case 'equal-or-below':
      return hpPercent <= expr.threshold;
    case 'equal-or-above':
      return hpPercent >= expr.threshold;
  }
}

function evaluateIsAlly(
  expr: { type: 'is-ally'; entity: EntityRef; relativeTo?: EntityRef },
  ctx: EvaluationContext
): boolean {
  const entity = resolveEntity(expr.entity, ctx);
  const relativeTo = resolveEntity(expr.relativeTo ?? 'attacker', ctx);
  return isAllied(entity.combatState.groupId, relativeTo.combatState.groupId, ctx.alliances);
}

function evaluateIsEnemy(
  expr: { type: 'is-enemy'; entity: EntityRef; relativeTo?: EntityRef },
  ctx: EvaluationContext
): boolean {
  const entity = resolveEntity(expr.entity, ctx);
  const relativeTo = resolveEntity(expr.relativeTo ?? 'attacker', ctx);
  return isHostile(entity.combatState.groupId, relativeTo.combatState.groupId, ctx.alliances);
}

function evaluateIsCreatureType(
  expr: { type: 'is-creature-type'; entity: EntityRef; creatureId: string },
  ctx: EvaluationContext
): boolean {
  const entity = resolveEntity(expr.entity, ctx);
  return isNPC(entity) ? entity.creature.id === expr.creatureId : false;
}

// --- Equipment Predicates ---

/**
 * HACK: siehe Header - Equipment-System nicht implementiert.
 * Prüft ob eine Entity genügend freie Hände hat.
 * Für MVP: Immer true (Equipment-System später).
 */
function evaluateHasFreeHands(
  expr: { type: 'has-free-hands'; count: number },
  _ctx: EvaluationContext
): boolean {
  debug('has-free-hands: Equipment-System nicht implementiert, returning true', {
    requiredHands: expr.count,
  });
  // TODO: Implement when Equipment system is ready
  // Would need to check:
  // 1. What's in main hand and off hand
  // 2. If wielding two-handed weapon
  // 3. If holding shield
  return true;
}

// --- Size Predicates ---

/** Size category ordering for comparison (index = size) */
const SIZE_ORDER = CREATURE_SIZES;

/**
 * Gets the size index for comparison.
 * Handles 'one-larger' by looking up attacker size and adding 1.
 */
function getSizeIndex(size: SizeCategory | 'one-larger', attackerSize: SizeCategory | undefined): number {
  if (size === 'one-larger') {
    if (!attackerSize) {
      debug('getSizeIndex: one-larger without attacker size, defaulting to medium');
      return SIZE_ORDER.indexOf('medium') + 1;
    }
    const attackerIndex = SIZE_ORDER.indexOf(attackerSize);
    return Math.min(attackerIndex + 1, SIZE_ORDER.length - 1);
  }
  return SIZE_ORDER.indexOf(size);
}

/**
 * Gets the size of an entity.
 * NPCs have size in creature definition via getResolvedCreature.
 * PCs default to 'medium'.
 */
function getEntitySize(entity: Combatant): SizeCategory {
  if (isNPC(entity)) {
    const resolved = getResolvedCreature(entity.creature.id);
    return resolved.definition.size ?? 'medium';
  }
  // Player characters - check character.size or default to medium
  if ('character' in entity && entity.character) {
    return (entity.character as { size?: SizeCategory }).size ?? 'medium';
  }
  return 'medium';
}

/**
 * Evaluates size-category precondition.
 * Checks if entity's size is within the specified max (inclusive).
 */
function evaluateSizeCategory(
  expr: { type: 'size-category'; entity?: EntityRef; max: SizeCategory | 'one-larger' },
  ctx: EvaluationContext
): boolean {
  // Default to 'target' if entity not specified (for targeting filters)
  const entityRef = expr.entity ?? 'target';
  const entity = resolveEntity(entityRef, ctx);
  const entitySize = getEntitySize(entity);
  const entitySizeIndex = SIZE_ORDER.indexOf(entitySize);

  // Get attacker size for 'one-larger' comparison
  const attackerSize = getEntitySize(ctx.attacker);
  const maxSizeIndex = getSizeIndex(expr.max, attackerSize);

  const result = entitySizeIndex <= maxSizeIndex;

  debug('evaluateSizeCategory:', {
    entity: entityRef,
    entitySize,
    entitySizeIndex,
    max: expr.max,
    maxSizeIndex,
    attackerSize,
    result,
  });

  return result;
}
