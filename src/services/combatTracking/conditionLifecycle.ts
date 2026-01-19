// Ziel: Einheitliche Condition-Lifecycle-Pipeline
// Siehe: docs/services/combatTracking/conditionLifecycle.md
//
// Schema-driven lifecycle handlers for conditions:
// - Linked conditions (grappled → grappling on source)
// - Death triggers (source dies → remove conditions from targets)
// - Position sync (source moves → targets follow)
//
// Used by: addCondition, removeCondition, markDeadCombatants, setPosition

// ============================================================================
// HACK & TODO
// ============================================================================
//
// [TODO]: Duration Classification Helper
// - Spec: docs/types/combatEvent.md#duration-typen-klassifikation
// - Fehlt: classifyDuration(duration) → 'instant' | 'duration' | 'infinite'
// - Mapping:
//   - instant: { type: 'instant' }
//   - duration: { type: 'rounds' | 'minutes' | 'hours' | 'concentration' | 'until-save' | 'until-escape' }
//   - infinite: { type: 'permanent' | 'until-dispelled' | 'until-condition' }
//
// [TODO]: Lineage-basiertes Duration Tracking
// - Spec: docs/types/combatEvent.md#linked-duration-patterns
// - Aktuell: linkedToSource für bidirektionale Conditions
// - Spec erweitert: lineage.parent + lineage.children für komplexe Hierarchien
// - Beispiel: Spell → multiple Conditions mit gemeinsamer Lebensdauer

import type { SchemaModifier } from '@/types/entities/combatEvent';
import type {
  Combatant,
  CombatantSimulationState,
  ConditionState,
  LifecycleRegistry,
  GridPosition,
} from '@/types/combat';

// ============================================================================
// DEBUG HELPER
// ============================================================================

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG_SERVICES === 'true') {
    console.log('[conditionLifecycle]', ...args);
  }
};

// ============================================================================
// REGISTRY BUILDER
// ============================================================================

/**
 * Builds lifecycle registry from modifier presets.
 * Called once at combat initialization.
 *
 * @param presets Array of SchemaModifier definitions
 * @returns Map from condition name to lifecycle config
 */
export function buildLifecycleRegistry(presets: SchemaModifier[]): LifecycleRegistry {
  const registry: LifecycleRegistry = new Map();

  for (const preset of presets) {
    // Only process condition modifiers (id pattern: condition-{name})
    if (preset.lifecycle && preset.id.startsWith('condition-')) {
      const conditionName = preset.id.replace('condition-', '');
      registry.set(conditionName, preset.lifecycle);
      debug('registered lifecycle:', conditionName, preset.lifecycle);
    }
  }

  debug('registry built:', registry.size, 'conditions');
  return registry;
}

// ============================================================================
// INTERNAL CONDITION HELPERS
// ============================================================================

/**
 * Internal function to add a condition without triggering lifecycle handlers.
 * Used by lifecycle handlers to avoid infinite recursion.
 *
 * NOTE: This is a simplified version. The full addCondition logic (modifier registration)
 * will be called by the main addCondition function in combatState.ts.
 */
function addConditionInternal(c: Combatant, condition: ConditionState): void {
  c.combatState.conditions.push(condition);
  debug('addConditionInternal:', { combatant: c.id, condition: condition.name });
}

/**
 * Internal function to remove a condition without triggering lifecycle handlers.
 * Used by lifecycle handlers to avoid infinite recursion.
 */
function removeConditionInternal(c: Combatant, conditionName: string): void {
  c.combatState.conditions = c.combatState.conditions.filter(
    cond => cond.name !== conditionName
  );

  // Also remove associated modifier (pattern: condition-{name})
  const modifierId = `condition-${conditionName}`;
  c.combatState.modifiers = c.combatState.modifiers.filter(
    am => am.modifier.id !== modifierId
  );

  debug('removeConditionInternal:', { combatant: c.id, condition: conditionName });
}

// ============================================================================
// LINKED CONDITION HANDLERS
// ============================================================================

/**
 * Handles linked conditions when a condition is applied.
 * If the condition has linkedToSource, apply the linked condition to the source.
 *
 * Example: When 'grappled' is applied to target, 'grappling' is applied to source.
 *
 * @param target The combatant receiving the condition
 * @param condition The condition being applied
 * @param source The combatant applying the condition
 * @param registry The lifecycle registry
 */
export function handleLinkedConditionOnApply(
  target: Combatant,
  condition: ConditionState,
  source: Combatant,
  registry: LifecycleRegistry
): void {
  const lifecycle = registry.get(condition.name);
  if (!lifecycle?.linkedToSource) return;

  const linked = lifecycle.linkedToSource;

  // Check if source already has the linked condition
  if (linked.onlyIfNew !== false) {  // Default is true
    const hasLinked = source.combatState.conditions?.some(
      c => c.name === linked.conditionId
    );
    if (hasLinked) {
      debug('handleLinkedConditionOnApply: source already has linked condition', {
        source: source.id,
        linkedCondition: linked.conditionId,
      });
      return;
    }
  }

  // Apply linked condition to source
  const linkedCondition: ConditionState = {
    name: linked.conditionId,
    probability: condition.probability,
    effect: linked.conditionId,
    duration: { type: 'permanent' },  // Linked conditions are permanent until explicitly removed
    // No sourceId - this is a consequence condition, not applied by someone
  };

  addConditionInternal(source, linkedCondition);

  debug('handleLinkedConditionOnApply: applied linked condition', {
    source: source.id,
    sourceName: source.name,
    linkedCondition: linked.conditionId,
    originalCondition: condition.name,
    target: target.id,
  });
}

/**
 * Handles linked conditions when a condition is removed.
 * If the condition has linkedToSource.removeWhenNoTargets, check if the linked
 * condition should be removed from the source.
 *
 * Example: When all targets escape from 'grappled', remove 'grappling' from the source.
 *
 * @param target The combatant losing the condition
 * @param conditionName The condition being removed
 * @param sourceId The ID of the source who applied it
 * @param state Combat state for querying other combatants
 * @param registry The lifecycle registry
 */
export function handleLinkedConditionOnRemove(
  target: Combatant,
  conditionName: string,
  sourceId: string | undefined,
  state: CombatantSimulationState,
  registry: LifecycleRegistry
): void {
  const lifecycle = registry.get(conditionName);
  if (!lifecycle?.linkedToSource) return;
  if (lifecycle.linkedToSource.removeWhenNoTargets === false) return;
  if (!sourceId) return;

  const source = state.combatants.find(c => c.id === sourceId);
  if (!source) {
    debug('handleLinkedConditionOnRemove: source not found', { sourceId });
    return;
  }

  // Count remaining targets with this condition from this source
  // (excluding the target that is being removed)
  const remainingTargets = state.combatants.filter(c =>
    c.id !== target.id &&
    c.combatState.conditions.some(
      cond => cond.name === conditionName && cond.sourceId === sourceId
    )
  );

  debug('handleLinkedConditionOnRemove: checking remaining targets', {
    conditionName,
    sourceId,
    targetBeingRemoved: target.id,
    remainingCount: remainingTargets.length,
  });

  if (remainingTargets.length === 0) {
    const linkedConditionId = lifecycle.linkedToSource.conditionId;
    removeConditionInternal(source, linkedConditionId);

    debug('handleLinkedConditionOnRemove: removed linked condition', {
      source: source.id,
      sourceName: source.name,
      linkedCondition: linkedConditionId,
      reason: 'no more targets',
    });
  }
}

// ============================================================================
// DEATH TRIGGER HANDLER
// ============================================================================

/**
 * Handles condition removal when a source dies.
 * Removes conditions from all targets that were applied by the dead combatant.
 *
 * Example: When grappler dies, all grappled targets are freed.
 *
 * @param deadCombatant The combatant that just died
 * @param state Combat state
 * @param registry The lifecycle registry
 */
export function handleSourceDeath(
  deadCombatant: Combatant,
  state: CombatantSimulationState,
  registry: LifecycleRegistry
): void {
  debug('handleSourceDeath: processing', { deadCombatant: deadCombatant.id, deadName: deadCombatant.name });

  // Find all conditions on other combatants that have this combatant as source
  for (const combatant of state.combatants) {
    if (combatant.id === deadCombatant.id) continue;

    // Get conditions from the dead combatant (copy array to allow modification)
    const conditionsFromDead = combatant.combatState.conditions.filter(
      cond => cond.sourceId === deadCombatant.id
    );

    for (const condition of conditionsFromDead) {
      const lifecycle = registry.get(condition.name);
      // Default behavior is 'remove-from-targets'
      const behavior = lifecycle?.onSourceDeath ?? 'remove-from-targets';

      switch (behavior) {
        case 'remove-from-targets':
          removeConditionInternal(combatant, condition.name);
          debug('handleSourceDeath: removed condition', {
            combatant: combatant.id,
            combatantName: combatant.name,
            condition: condition.name,
            reason: 'source died',
          });
          break;

        case 'persist':
          // Clear sourceId to prevent further lifecycle triggers
          condition.sourceId = undefined;
          debug('handleSourceDeath: condition persists', {
            combatant: combatant.id,
            condition: condition.name,
            reason: 'onSourceDeath=persist',
          });
          break;
      }
    }
  }
}

// ============================================================================
// POSITION SYNC HANDLER
// ============================================================================

/**
 * Handles position synchronization for linked conditions.
 * When a combatant moves, targets with positionSync.followSource=true follow.
 *
 * Example: When grappler moves, grappled targets are dragged along.
 *
 * @param mover The combatant being moved
 * @param newPos The new position
 * @param state Combat state
 * @param registry The lifecycle registry
 * @returns Array of combatants whose positions were synced
 */
export function handlePositionSync(
  mover: Combatant,
  newPos: GridPosition,
  state: CombatantSimulationState,
  registry: LifecycleRegistry
): Combatant[] {
  const synced: Combatant[] = [];

  // Find all conditions on other combatants where mover is the source
  for (const combatant of state.combatants) {
    if (combatant.id === mover.id) continue;

    for (const condition of combatant.combatState.conditions) {
      if (condition.sourceId !== mover.id) continue;

      const lifecycle = registry.get(condition.name);
      if (!lifecycle?.positionSync?.followSource) continue;

      // Check if source has required condition (e.g., 'grappling')
      const requiredCond = lifecycle.positionSync.requiresSourceCondition;
      if (requiredCond) {
        const sourceHasRequired = mover.combatState.conditions.some(
          c => c.name === requiredCond
        );
        if (!sourceHasRequired) {
          debug('handlePositionSync: skipping - source missing required condition', {
            mover: mover.id,
            target: combatant.id,
            condition: condition.name,
            requiredCondition: requiredCond,
          });
          continue;
        }
      }

      // Sync position
      combatant.combatState.position = { ...newPos };
      synced.push(combatant);

      debug('handlePositionSync: synced position', {
        mover: mover.id,
        moverName: mover.name,
        target: combatant.id,
        targetName: combatant.name,
        condition: condition.name,
        newPos,
      });
    }
  }

  return synced;
}
