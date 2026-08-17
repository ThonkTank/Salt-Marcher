export const ruleClassifications = [
  'domain_invariant',
  'catalog_fact',
  'preset_rule'
] as const

export type RuleClassification = (typeof ruleClassifications)[number]

export type ClassifiedGenerationRule = Readonly<{
  id: string
  classification: RuleClassification
  owner: string
  rationale: string
}>

const classifiedRule = (
  rule: ClassifiedGenerationRule
): ClassifiedGenerationRule => Object.freeze(rule)

/**
 * This registry classifies rule ownership, not values. Executable values stay
 * with the named owner and are checked by focused stage/catalog/config tests.
 */
export const generationRuleOwnership: readonly ClassifiedGenerationRule[] =
  Object.freeze([
    classifiedRule({
      id: 'money-exact-arithmetic',
      classification: 'domain_invariant',
      owner: 'reward-units.ts and rational.ts',
      rationale: 'Money arithmetic must not vary by catalog or preset.'
    }),
    classifiedRule({
      id: 'saved-run-replay-authority',
      classification: 'domain_invariant',
      owner: 'generated-run-store.ts',
      rationale: 'A concrete immutable result remains authoritative.'
    }),
    classifiedRule({
      id: 'item-and-container-definitions',
      classification: 'catalog_fact',
      owner: 'resources/sessiongeneration registry',
      rationale: 'Published catalog identities and facts are immutable.'
    }),
    classifiedRule({
      id: 'coin-denominations-and-profiles',
      classification: 'catalog_fact',
      owner: 'DB_CoinDenominations.tsv and DB_CoinProfiles.tsv',
      rationale: 'Available denominations and profiles are catalog content.'
    }),
    classifiedRule({
      id: 'reward-progression-and-mix',
      classification: 'preset_rule',
      owner: 'Generator Config V5',
      rationale: 'Progression, shares, and thresholds are editable policy.'
    }),
    classifiedRule({
      id: 'selection-and-packing-policy',
      classification: 'preset_rule',
      owner: 'Generator Config V5',
      rationale: 'Weights, tolerances, and packing thresholds are policy.'
    })
  ])
