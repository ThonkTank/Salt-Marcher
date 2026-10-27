import assert from 'node:assert/strict';

/** Compare the same world offsets when native camera framing changes after Fresh.
 * Centres and radii are physical pixels, measured independently in each capture.
 * Keep the caller's colour threshold and interior sampling annulus unchanged. */
export function terrainPixelDifference(before, after, source, target) {
  for (const view of [source, target]) {
    assert([view.x, view.y, view.radius].every(Number.isFinite));
    assert(view.radius > 0);
  }
  let total = 0, changed = 0, sum = 0;
  const scale = target.radius / source.radius;
  for (let dy = -source.radius * 0.6; dy <= -source.radius * 0.2; dy++)
    for (let dx = -source.radius * 0.6; dx <= source.radius * 0.6; dx++) {
      const r = Math.hypot(dx, dy) / source.radius;
      if (r < 0.2 || r > 0.6) continue;
      const ax = Math.round(source.x + dx), ay = Math.round(source.y + dy),
        bx = Math.round(target.x + dx * scale), by = Math.round(target.y + dy * scale);
      assert(ax >= 0 && ay >= 0 && ax < before.width && ay < before.height);
      assert(bx >= 0 && by >= 0 && bx < after.width && by < after.height);
      const ai = (ay * before.width + ax) * 4, bi = (by * after.width + bx) * 4;
      const d = Math.max(...[0, 1, 2].map(k => Math.abs(before.data[ai+k] - after.data[bi+k])));
      total++; changed += d >= 12; sum += d;
    }
  assert(total >= 20);
  return {total,changed,mean:sum/total,fraction:changed/total};
}
