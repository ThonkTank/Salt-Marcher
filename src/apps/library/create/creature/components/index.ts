// src/apps/library/create/creature/components/index.ts
// Central export point for the component-based entry system

// Export all types, type guards, and utility functions
export type {
  // Core types
  ComponentBasedEntry,
  EntryComponent,
  ComponentType,

  // Individual component types
  AttackComponent,
  SaveComponent,
  DamageComponent,
  ConditionComponent,
  AreaComponent,
  RechargeComponent,
  UsesComponent,
  TriggerComponent,
  HealComponent,
  EffectComponent,

  // Supporting types
  AreaShape,
  DamageType,
  ConditionType,
  RestType,
  TimeUnit,

  // Legacy compatibility
  LegacyCreatureEntry,
} from "./types";

export {
  // Type guards
  isAttackComponent,
  isSaveComponent,
  isDamageComponent,
  isConditionComponent,
  isAreaComponent,
  isRechargeComponent,
  isUsesComponent,
  isTriggerComponent,
  isHealComponent,
  isEffectComponent,

  // Factory functions
  createAttackComponent,
  createSaveComponent,
  createDamageComponent,
  createConditionComponent,
  createAreaComponent,
  createRechargeComponent,
  createUsesComponent,
  createTriggerComponent,
  createHealComponent,
  createEffectComponent,

  // Utility functions
  findComponentsByType,
  hasComponentType,
  getFirstComponent,
  removeComponentsByType,
  replaceComponent,
  validateEntry,
  validateComponent,

  // Migration functions
  migrateFromLegacy,
  migrateToLegacy,

  // Builder functions
  createMeleeAttackEntry,
  createRangedAttackEntry,
  createBreathWeaponEntry,
  createMultiattackEntry,
} from "./types";

// Export UI component creators
export {
  createConditionComponent as createConditionComponentUI,
  validateCondition,
  validateConditions,
  formatConditionString,
  conditionInstancesToString,
  parseConditionString,
  CONDITION_TYPES,
  TIME_UNITS,
} from "./condition-component";

export type {
  ConditionInstance,
  ConditionComponentOptions,
  EscapeMechanism,
} from "./condition-component";

// Export Area component
export {
  createAreaComponent as createAreaComponentUI,
  formatAreaString,
  formatOriginString,
  validateAreaSize,
  normalizeAreaSize,
  generateAreaPreview,
  toAreaComponentType,
  fromAreaComponentType,
  validateAreaComponent,
} from "./area-component";

export type {
  AreaInstance,
  AreaComponentOptions,
  AreaComponentHandle,
  DistanceUnit,
  OriginType,
} from "./area-component";

// Export Recharge component
export {
  createRechargeComponent as createRechargeComponentUI,
  formatRechargeOutput,
  validateRechargeComponent,
  parseRechargeString,
} from "./recharge-component";

export type {
  RechargeComponentOptions,
  RechargeComponentHandle,
} from "./recharge-component";

// Export Uses component
export {
  createUsesComponent as createUsesComponentUI,
  formatUsesOutput,
  validateUsesComponent,
  parseUsesString,
} from "./uses-component";

export type {
  UsesComponentOptions,
  UsesComponentHandle,
} from "./uses-component";
