export const capabilityIssueCodes = [
  'duplicate_draft_id',
  'generator_item_unknown',
  'generator_item_duplicate',
  'generator_container_unknown',
  'generator_container_duplicate',
  'catalog_entry_unknown',
  'catalog_entry_inactive',
  'catalog_entry_kind_mismatch',
  'catalog_container_unknown',
  'catalog_container_hidden',
  'container_assignment_unknown'
] as const

export type CapabilityIssueCode = (typeof capabilityIssueCodes)[number]
export type CapabilityIssueParameter = string | number | boolean | null
export type CapabilityIssue = Readonly<{
  code: CapabilityIssueCode
  path: readonly (string | number)[]
  parameters: Readonly<Record<string, CapabilityIssueParameter>>
}>
