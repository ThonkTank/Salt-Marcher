export type ItemReferenceValue =
  | Readonly<{
      kind: 'catalog'
      catalogContentHash: string
      entryKind: string
      catalogId: string
    }>
  | Readonly<{ kind: 'generated'; runId: string; definitionId: string }>
  | Readonly<{ kind: 'legacy'; definitionId: string }>

export type ExactItemValue = Readonly<{
  unitValueCp: number
  exactUnitValueCp?:
    Readonly<{ numerator: string; denominator: string }> | undefined
}>

export function itemReferenceKey(reference: ItemReferenceValue): string {
  if (reference.kind === 'catalog')
    return [
      'catalog',
      reference.catalogContentHash,
      reference.entryKind,
      reference.catalogId
    ].join(':')
  if (reference.kind === 'generated')
    return ['generated', reference.runId, reference.definitionId].join(':')
  return ['legacy', reference.definitionId].join(':')
}

/** Round exact unit price × quantity half-up at the persisted CP boundary. */
export function itemDefinitionLineValueCp(
  definition: ExactItemValue,
  quantity: number
): number {
  if (!Number.isSafeInteger(quantity) || quantity < 0)
    throw new Error('invalid_item_quantity')
  const exact = definition.exactUnitValueCp
  if (!exact) {
    const result = definition.unitValueCp * quantity
    if (!Number.isSafeInteger(result)) throw new Error('item_value_overflow')
    return result
  }
  const numerator = BigInt(exact.numerator) * BigInt(quantity)
  const denominator = BigInt(exact.denominator)
  const sign = numerator < 0n ? -1n : 1n
  const absolute = numerator < 0n ? -numerator : numerator
  const rounded = sign * ((absolute * 2n + denominator) / (2n * denominator))
  const result = Number(rounded)
  if (!Number.isSafeInteger(result)) throw new Error('item_value_overflow')
  return result
}
