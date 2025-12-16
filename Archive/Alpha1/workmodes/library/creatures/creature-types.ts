/**
 * Creature Types (Re-exported from shared types)
 *
 * This file maintains backward compatibility by re-exporting creature types
 * from the shared types layer (src/services/domain).
 *
 * Workmode imports can continue using this path, but features/services
 * should import directly from @services/domain to avoid layer violations.
 */

export type {
	// Ability scores
	AbilityScoreKey,
	SpellcastingAbility,
	// Speed types
	CreatureSpeedValue,
	CreatureSpeedExtra,
	CreatureSpeeds,
	SpeedEntry,
	SpeedArray,
	// Token types
	SenseToken,
	LanguageToken,
	SimpleValueToken,
	// Spellcasting
	SpellcastingSpell,
	SpellcastingGroupAtWill,
	SpellcastingGroupPerDay,
	SpellcastingGroupLevel,
	SpellcastingGroupCustom,
	SpellcastingGroup,
	SpellcastingComputedValues,
	SpellcastingData,
	// Damage and effects
	DamageInstance,
	AoeShape,
	AreaTarget,
	SingleTarget,
	SpecialTarget,
	Targeting,
	DurationTiming,
	SaveToEnd,
	ConditionEffect,
	MovementEffect,
	DamageOverTime,
	MechanicalEffect,
	EffectBlock,
	// Attack and saving throws
	AttackData,
	SavingThrowData,
	LimitedUse,
	MultiattackSubstitution,
	MultiattackData,
	SpellcastingEntryData,
	// Entry types
	BaseEntry,
	AttackEntry,
	SaveEntry,
	MultiattackEntry,
	SpellcastingEntry,
	SpecialEntry,
	LegacyEntry,
	CreatureEntry,
	// Ability and skills
	AbilityScore,
	SaveBonus,
	SkillBonus,
	// Main statblock
	StatblockData,
	CreatureData,
} from "@services/domain";
