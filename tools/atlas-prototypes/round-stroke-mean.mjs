import {circleTriangleFraction} from './circle-triangle.mjs';

// A round record uses one flow for every stamp. Its exact stored alpha is
// therefore a function of hit count, including each Float32 and byte rounding.
// Equal centers are grouped, but distinct overlapping disks are NOT treated
// as independent. Convex/concave envelopes bound any joint hit distribution
// having the measured expected count.
export function roundStrokeMean(stamps, {radius, flow, opacity}) {
  const groups = new Map();
  for (const p of stamps) {
    const key = `${p.x},${p.y}`;
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, {...p, count: 1});
  }
  const alpha = [0];
  let coverage = 0;
  for (let i = 0; i < stamps.length; i++) {
    coverage = Math.fround(1 - (1 - coverage) * (1 - flow));
    alpha.push(Math.round(255 * coverage) / 255 * opacity);
  }
  const radius2 = radius * radius, eps = Number.EPSILON;
  function envelope(k, m, lower) {
    const hull = [];
    for (let n = 0; n <= m; n++) {
      const p = [n, alpha[k + n]];
      while (hull.length > 1) {
        const a = hull.at(-2), b = hull.at(-1);
        const cross = (b[0]-a[0])*(p[1]-b[1])-(b[1]-a[1])*(p[0]-b[0]);
        if (lower ? cross > 0 : cross < 0) break;
        hull.pop();
      }
      hull.push(p);
    }
    return x => {
      let i = 1;
      while (i < hull.length-1 && hull[i][0] < x) i++;
      const a = hull[i-1], b = hull[i];
      return a[1] + (b[1]-a[1]) * ((x-a[0])/(b[0]-a[0]));
    };
  }
  return triangle => {
    const minX = Math.min(...triangle.map(p=>p.x)), maxX = Math.max(...triangle.map(p=>p.x));
    const minY = Math.min(...triangle.map(p=>p.y)), maxY = Math.max(...triangle.map(p=>p.y));
    let full = 0, possible = 0, meanLo = 0, meanHi = 0;
    const partial = [];
    for (const group of groups.values()) {
      const dx = Math.max(minX-group.x, 0, group.x-maxX), dy = Math.max(minY-group.y, 0, group.y-maxY);
      const near = (dx*dx+dy*dy)/radius2;
      if (near-8*eps*Math.max(1,near) > 1) continue;
      const far = Math.max(...triangle.map(p=>((p.x-group.x)**2+(p.y-group.y)**2)/radius2));
      if (far+8*eps*Math.max(1,far) < 1) { full += group.count; continue; }
      const result = circleTriangleFraction(triangle.map(p=>[p.x,p.y]), [group.x,group.y], radius);
      if (!result || !Number.isFinite(result.fraction) || !Number.isFinite(result.error)) return undefined;
      const lo = Math.max(0,result.fraction-result.error), hi = Math.min(1,result.fraction+result.error);
      partial.push({count:group.count, lo, hi});
      possible += group.count;
      meanLo += group.count * lo;
      meanHi += group.count * hi;
    }
    const range = [alpha[full], alpha[full+possible]];
    if (range[0] === range[1]) return {range, mean:[...range]};
    let lo, hi;
    if (partial.length === 1) {
      // All hits of this group occur together; preserve that stronger fact.
      lo = range[0]+(range[1]-range[0])*partial[0].lo;
      hi = range[0]+(range[1]-range[0])*partial[0].hi;
    } else {
      lo = envelope(full,possible,true)(Math.max(0,Math.min(possible,meanLo)));
      hi = envelope(full,possible,false)(Math.max(0,Math.min(possible,meanHi)));
    }
    const guard = 128*eps*(1+possible);
    return {range, mean:[Math.max(range[0],lo-guard),Math.min(range[1],hi+guard)]};
  };
}
