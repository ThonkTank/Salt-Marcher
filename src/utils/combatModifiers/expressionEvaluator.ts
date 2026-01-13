// Ziel: Interpreter für Schema-driven Condition Expressions
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Evaluiert ConditionExpression gegen ModifierContext.
// Unterstützt:
// - Logical operators: and, or, not
// - Quantified entity checks: exists
// - Spatial predicates: adjacent-to, within-range, opposite-side
// - State predicates: has-condition, is-incapacitated, hp-threshold
// - Action predicates: action-has-property, action-is-type, action-range-type

import type { Action } from '@/types/entities';
import type {
  ConditionExpression,
  EntityRef,
  QuantifiedEntity,
  ExistsExpression,
} from '@/types/entities/conditionExpression';
import type {
  ModifierContext,
  CombatantContext,
  ModifierSimulationState,
} from '@/services/combatantAI/situationalModifiers';
import { getDistance, isAllied, isHostile, feetToCell } from './helpers';
import { isNPC, type GridPosition, type Combatant } from '@/types/combat';
import { getExpectedValue } from '@/utils';
import { getAC } from '@/services/combatTracking';

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
  self: CombatantContext;
  /** The attacking entity */
  attacker: CombatantContext;
  /** The target entity */
  target: CombatantContext;
  /** The action being evaluated */
  action: Action;
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
 * Resolves an entity reference to its CombatantContext.
 */
function resolveEntity(ref: EntityRef, ctx: EvaluationContext): CombatantContext {
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
  return resolveEntity(ref, ctx).position;
}

/**
 * Extrahiert CombatantContext direkt aus Combatant.
 * Keine Profile-Indirektion - alle Daten vom Ursprung.
 */
export function combatantToCombatantContext(c: Combatant): CombatantContext {
  return {
    position: c.combatState.position,
    groupId: c.combatState.groupId,
    participantId: c.id,
    conditions: c.combatState.conditions,
    ac: getAC(c),
    hp: getExpectedValue(c.currentHp),
    maxHp: c.maxHp,
    creatureId: isNPC(c) ? c.creature.id : undefined,
  };
}

/**
 * Gets filtered entities based on quantified entity specification.
 * Verwendet direkt Combatants aus dem State.
 */
function getFilteredEntities(
  quantified: QuantifiedEntity,
  ctx: EvaluationContext
): CombatantContext[] {
  const relativeTo = quantified.relativeTo ?? 'attacker';
  const referenceEntity = resolveEntity(relativeTo, ctx);
  const referenceGroupId = referenceEntity.groupId;

  return ctx.state.combatants
    .filter((c) => {
      // Never include the reference entity itself
      if (c.id === referenceEntity.participantId) return false;

      const groupId = c.combatState.groupId;
      switch (quantified.filter) {
        case 'ally':
          return isAllied(groupId, referenceGroupId, ctx.alliances);
        case 'enemy':
          return isHostile(groupId, referenceGroupId, ctx.alliances);
        case 'any-creature':
          return true;
      }
    })
    .map(combatantToCombatantContext);
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
function isEntityIncapacitated(entity: CombatantContext): boolean {
  return entity.conditions.some(
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
      // Note: This requires access to already-computed modifiers
      // For now, return false as this is a complex case
      debug('has-advantage: not yet supported, returning false');
      return false;

    case 'is-creature-type':
      return evaluateIsCreatureType(expr, ctx);

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
    const checkFn = (candidate: CombatantContext): boolean => {
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

function evaluateTargetInLongRange(ctx: EvaluationContext): boolean {
  const { action, attacker, target } = ctx;

  if (!action.range?.long) return false;

  const distance = getDistance(attacker.position, target.position);
  const normalRangeCells = feetToCell(action.range.normal);
  const longRangeCells = feetToCell(action.range.long);

  return distance > normalRangeCells && distance <= longRangeCells;
}

function evaluateTargetBeyondNormalRange(ctx: EvaluationContext): boolean {
  const { action, attacker, target } = ctx;

  if (!action.range) return false;

  const distance = getDistance(attacker.position, target.position);
  const normalRangeCells = feetToCell(action.range.normal);

  return distance > normalRangeCells;
}

// --- State Predicates ---

function evaluateHasCondition(
  expr: { type: 'has-condition'; entity: EntityRef; condition: string; negate?: boolean },
  ctx: EvaluationContext
): boolean {
  const entity = resolveEntity(expr.entity, ctx);
  const hasCondition = entity.conditions.some(
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

  const hpPercent = (entity.hp / entity.maxHp) * 100;

  debug('hp-threshold:', {
    hp: entity.hp,
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
  return isAllied(entity.groupId, relativeTo.groupId, ctx.alliances);
}

function evaluateIsEnemy(
  expr: { type: 'is-enemy'; entity: EntityRef; relativeTo?: EntityRef },
  ctx: EvaluationContext
): boolean {
  const entity = resolveEntity(expr.entity, ctx);
  const relativeTo = resolveEntity(expr.relativeTo ?? 'attacker', ctx);
  return isHostile(entity.groupId, relativeTo.groupId, ctx.alliances);
}

function evaluateIsCreatureType(
  expr: { type: 'is-creature-type'; entity: EntityRef; creatureId: string },
  ctx: EvaluationContext
): boolean {
  const entity = resolveEntity(expr.entity, ctx);
  return entity.creatureId === expr.creatureId;
}
