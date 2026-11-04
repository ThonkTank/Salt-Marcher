import {
  bezier,
  distance,
  type Intent,
  type Road,
  type WorldPoint,
} from "./model";
/** Pick only an edge and parameter; the backend owns the De-Casteljau split. */
export function roadInsertion(
  road: Road,
  p: WorldPoint,
): Extract<Intent, { type: "insertRoadNode" }> {
  let best = { index: 0, t: 0.5, distance: Infinity };
  for (let i = 0; i < road.nodes.length - 1; i++) {
    const a = road.nodes[i],
      b = road.nodes[i + 1];
    const at = (t: number) =>
      distance(
        p,
        bezier(
          a.point,
          a.outgoing ?? a.point,
          b.incoming ?? b.point,
          b.point,
          t,
        ),
      );
    // A bounded coarse search followed by local refinement, never a topology edit.
    for (let j = 1; j < 100; j++) {
      const t = j / 100,
        d = at(t);
      if (d < best.distance) best = { index: i, t, distance: d };
    }
  }
  const a = road.nodes[best.index],
    b = road.nodes[best.index + 1];
  let lo = Math.max(1e-6, best.t - 0.01),
    hi = Math.min(1 - 1e-6, best.t + 0.01);
  const at = (t: number) =>
    distance(
      p,
      bezier(a.point, a.outgoing ?? a.point, b.incoming ?? b.point, b.point, t),
    );
  for (let j = 0; j < 24; j++) {
    const l = lo + (hi - lo) / 3,
      r = hi - (hi - lo) / 3;
    if (at(l) < at(r)) hi = r;
    else lo = l;
  }
  return {
    type: "insertRoadNode",
    roadId: road.id,
    afterNodeId: a.id,
    t: (lo + hi) / 2,
  };
}
