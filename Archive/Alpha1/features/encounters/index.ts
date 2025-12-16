/**
 * Encounters Feature Module
 *
 * Simplified architecture using global CreatureStore
 */

// ============================================================================
// Creature Store (Global, Reactive, Vault-Based)
// ============================================================================

export {
    initializeCreatureStore,
    getCreatureStore,
    disposeCreatureStore,
    getAllCreatures,
    getCreaturesByType,
    getCreaturesByCRRange,
    subscribeCreatureState,
    type Creature,
    type CreatureState,
} from "./creature-store";

// ============================================================================
// Encounter Generation
// ============================================================================

export {
    generateEncounterFromHabitat,
} from "./encounter-generator";

export {
    filterCreaturesByHabitat,
} from "./encounter-filter";

export {
    calculateEncounterDifficulty,
} from "./encounter-probability";

// ============================================================================
// Types
// ============================================================================

export type {
    Encounter,
    Combatant,
    EncounterGenerationContext,
} from "./encounter-types";

// ============================================================================
// Weather Modifiers (still used by other systems)
// ============================================================================

export type { WeatherModifier } from "./weather-modifiers";

export {
    calculateWeatherModifiers,
    applyWeatherToEncounterChance,
    getVisibilityRange,
    getWeatherCRModifier,
} from "./weather-modifiers";

