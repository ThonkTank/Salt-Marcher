export type OverflowEvidence = Readonly<{
  outsideOwnerPixels: number
  scrollOverflowPixels: number
  overflowX: string
  textOverflow: string
  whiteSpace: string
}>

export function hasImpermissibleLayoutOverflow(
  evidence: OverflowEvidence
): boolean {
  if (evidence.outsideOwnerPixels <= 1 && evidence.scrollOverflowPixels <= 1)
    return false
  const accessibleTruncation =
    evidence.overflowX === 'hidden' &&
    evidence.textOverflow === 'ellipsis' &&
    evidence.whiteSpace === 'nowrap'
  return !accessibleTruncation
}
