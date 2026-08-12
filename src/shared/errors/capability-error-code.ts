export const capabilityErrorCodes = [
  'validation_failed',
  'idempotency_conflict',
  'unsupported_svg',
  'svg_too_large',
  'file_read_failed',
  'catalog_unavailable',
  'stale',
  'not_found',
  'read_only',
  'timeout',
  'outcome_unknown',
  'core_unavailable',
  'protocol_violation',
  'internal'
] as const

export type CapabilityErrorCode = (typeof capabilityErrorCodes)[number]
