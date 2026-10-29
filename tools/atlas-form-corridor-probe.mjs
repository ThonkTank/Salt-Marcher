/** Physical form checks follow each concrete first-hit section. A silhouette
 * does not authorize a world segment between unrelated surface points. */
export function formCorridorMetrics(plan, radius, before, after) {
  const drops = [],
    profile = [];
  for (const section of plan.sections) {
    const a = section.point(0),
      b = section.point(1),
      count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (radius / 4)));
    for (let j = 0; j < count; j++) {
      const p = section.point((j + 0.5) / count);
      drops.push(before.sample(p).heightM - after.sample(p).heightM);
    }
    const p = section.point(0.5),
      length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) continue;
    const nx = (-(b.y - a.y) / length) * radius * 0.5,
      ny = ((b.x - a.x) / length) * radius * 0.5,
      centre = after.sample(p).heightM,
      banks =
        (after.sample({ x: p.x + nx, y: p.y + ny }).heightM +
          after.sample({ x: p.x - nx, y: p.y - ny }).heightM) /
        2;
    profile.push({ x: p.x, y: p.y, centre, banks, incisionM: banks - centre });
  }
  return {
    minDropM: Math.min(...drops),
    maxDropM: Math.max(...drops),
    sampleCount: drops.length,
    profile,
    incised: profile.filter((p) => p.incisionM > 0.05).length,
  };
}
