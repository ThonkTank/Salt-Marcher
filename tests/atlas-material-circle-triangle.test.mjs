import test from 'node:test';
import assert from 'node:assert/strict';
import {circleTriangleFraction} from '../tools/atlas-prototypes/circle-triangle.mjs';

const close = (actual, expected, tolerance = 2e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('analytic disk, half disk, quarter disk, and triangle-contained cases', () => {
  const disk = circleTriangleFraction([[-4,-4],[4,-4],[0,4]], [0,0], 1);
  close(disk.fraction, Math.PI / 32, 2e-14);
  const half = circleTriangleFraction([[0,-2],[0,2],[2,0]], [0,0], 1);
  close(half.fraction, Math.PI / 8, 2e-14);
  const quarter = circleTriangleFraction([[0,0],[2,0],[0,2]], [0,0], 1);
  close(quarter.fraction, Math.PI / 8, 2e-14);
  const inside = circleTriangleFraction([[0,0],[.2,0],[0,.2]], [0,0], 1);
  assert.equal(inside.fraction, 1);
  assert.ok(inside.error < 1e-12);
});

test('misses and tangencies have zero area; winding direction does not change result', () => {
  assert.deepEqual(circleTriangleFraction([[2,0],[3,0],[2,1]], [0,0], 1).fraction, 0);
  assert.equal(circleTriangleFraction([[1,0],[2,0],[1,1]], [0,0], 1).fraction, 0);
  const triangle = [[0,-2],[0,2],[2,0]];
  const forward = circleTriangleFraction(triangle, [0,0], 1);
  const reverse = circleTriangleFraction([...triangle].reverse(), [0,0], 1);
  close(forward.fraction, Math.PI / 8);
  close(reverse.fraction, forward.fraction);
  assert.ok(forward.error >= 0 && reverse.error >= 0);
});

test('normalization handles large translations and reciprocal scales', () => {
  const base = [[0,-2],[0,2],[2,0]];
  const shifted = base.map(([x,y]) => [1e9+x, -1e9+y]);
  close(circleTriangleFraction(shifted, [1e9,-1e9], 1).fraction, Math.PI / 8);
  for (const scale of [1e-120, 1e-8, 1e8, 1e120]) {
    const scaled = base.map(([x,y]) => [x*scale,y*scale]);
    close(circleTriangleFraction(scaled, [0,0], scale).fraction, Math.PI / 8);
  }
  const translated = circleTriangleFraction(base.map(([x,y])=>[1e9+x,-1e9+y]),[1e9,-1e9],1);
  assert.ok(translated.error > 0, 'world-coordinate subtraction uncertainty is included');
  assert.equal(circleTriangleFraction([[1e16,0],[1e16+2,0],[1e16,2]],[1e16,0],1), undefined,
    'coordinate resolution larger than the radius fails closed');
});

test('thin triangles and boundary slivers return broad uncertainty instead of false precision', () => {
  const thin = circleTriangleFraction([[-1,0],[1,0],[0,1e-200]],[0,0],1);
  assert.ok(thin === undefined || (Number.isFinite(thin.fraction) && thin.error > .99),
    'unresolved triangle boundary error fails closed or returns a broad allowance');
  const tangentSliver = circleTriangleFraction([[1-1e-12,-1e-6],[1+1e-12,-1e-6],[1,1e-6]],[0,0],1);
  assert.ok(tangentSliver === undefined || (tangentSliver.error > 0 &&
    (tangentSliver.error >= tangentSliver.fraction || tangentSliver.error > 1e-10)));
  assert.equal(circleTriangleFraction([[0,0],[1,0],[2,0]],[0,0],1), undefined);
});

test('area-weighted fractions conserve a disk across a triangle partition', () => {
  const lower = [[-2,-2],[2,-2],[2,2]];
  const upper = [[-2,-2],[2,2],[-2,2]];
  const areas = t => Math.abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0])) / 2;
  // Partition the square into two triangles whose union contains the disk.
  const triangles = [lower,upper];
  const reconstructed = triangles.reduce((sum,t) => sum + areas(t)*circleTriangleFraction(t,[0,0],1).fraction, 0);
  close(reconstructed, Math.PI, 2e-12);
  assert.ok(triangles.reduce((sum,t) => sum + areas(t)*circleTriangleFraction(t,[0,0],1).error, 0) < 1e-10);
});

test('edge integral agrees with a deterministic dense numeric oracle', () => {
  const cases = [
    {t:[[-1.4,-.3],[1.7,-.2],[.1,1.5]], c:[.1,.1], r:.8},
    {t:[[-1.1,.4],[.9,-1.2],[1.4,1.3]], c:[0,0], r:1},
    {t:[[-.2,-.2],[1.8,.1],[.1,1.7]], c:[.3,.2], r:.75},
  ];
  for (const {t,c,r} of cases) {
    const result = circleTriangleFraction(t,c,r);
    let hits=0, total=0;
    const [a,b,d]=t, n=900;
    for(let i=0;i<n;i++) for(let j=0;j<n;j++) {
      const u=(i+.5)/n, v=(j+.5)/n;
      if(u+v>1) continue;
      total++;
      const x=a[0]+u*(b[0]-a[0])+v*(d[0]-a[0]);
      const y=a[1]+u*(b[1]-a[1])+v*(d[1]-a[1]);
      if((x-c[0])**2+(y-c[1])**2<r*r) hits++;
    }
    const oracle=hits/total;
    assert.ok(Math.abs(result.fraction-oracle)<.003, `${result.fraction} vs ${oracle}`);
    // Dense sampling has its own discretization error; the reported analytic
    // allowance should still be finite and small for these well-scaled cases.
    assert.ok(result.error >= 0 && result.error < 1e-10);
  }
});
