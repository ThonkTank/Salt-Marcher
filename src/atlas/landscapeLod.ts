import type { Bounds } from "./model";

export const landscapeSymbolBudget = 16384;
export const landscapeSymbolMargin = (near: boolean) => (near ? 18 : 188);

export function landscapeDetails(
  scale: number,
  bounds?: Bounds,
): { spacing: number; alpha: number; near: boolean }[] {
  // Both representations coexist only in the transition band. No tree
  // candidates are generated for continental/world views.
  if (scale <= 0.03) return [];
  let nearAlpha = Math.max(0, Math.min(1, (scale - 0.35) / 0.15));
  if (bounds && nearAlpha > 0) {
    // A camera-position-independent upper bound avoids panning-induced switches.
    // Reserve both bands before admitting any detail candidates.
    const candidates = (spacing: number, near: boolean) => {
      const margin = landscapeSymbolMargin(near) * 2;
      return (
        (Math.ceil((bounds[2] - bounds[0] + margin) / spacing) + 1) *
        (Math.ceil((bounds[3] - bounds[1] + margin) / spacing) + 1)
      );
    };
    const work = candidates(32, true) + candidates(512, false);
    const capacity = Math.max(
      0,
      Math.min(
        1,
        (landscapeSymbolBudget - work) / (landscapeSymbolBudget * 0.2),
      ),
    );
    nearAlpha *= capacity;
  }
  const details = [];
  if (nearAlpha < 1)
    details.push({
      spacing: 512,
      alpha: Math.min(1, (scale - 0.03) / 0.03) * (1 - nearAlpha),
      near: false,
    });
  if (nearAlpha > 0)
    details.push({ spacing: 32, alpha: nearAlpha, near: true });
  return details;
}
