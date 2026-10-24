// Scalar, conservative source for version-2 landscape pigment strokes.
// Keep stamp generation and Float32 accumulation aligned with
// src/app/landscape-pigment-coverage.ts.
const f32 = Math.fround;
const MAX_STAMPS = 4000;
const EPS = Number.EPSILON;
const MIN_NORMAL = 2 ** -1022;

function fail(message) { throw new Error(`Invalid pigment stroke: ${message}`); }
function textureValue(x, y, p) {
  let n = (Math.imul(Math.floor(x / p.radius * 24), 374761393) ^
    (Math.imul(Math.floor(y / p.radius * 24), 668265263) ^ p.seed));
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return .15 + .85 * ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function cell(x, radius) { return Math.floor(x / radius * 24); }
// Widen a computed squared-distance ratio by a few binary64 rounding units.
// These bounds feed the interval proof, while point coverage intentionally
// retains the production arithmetic exactly. Subnormal radius squares are
// rejected: relative rounding guards cannot bound their quantization error.
function lowerGuard(x) { return Math.max(0, x * (1 - 8 * EPS)); }
function upperGuard(x) { return x * (1 + 8 * EPS); }

// Adjacent finite binary64 values bracket a texture transition. Both sides
// are retained as cuts: the narrow uncertain strip keeps its range bound.
const bits = new DataView(new ArrayBuffer(8));
function adjacent(value,direction){
  if(value===0)return direction*Number.MIN_VALUE;
  bits.setFloat64(0,value);let raw=bits.getBigUint64(0);
  raw+=(value>0)===(direction>0)?1n:-1n;
  bits.setBigUint64(0,raw);return bits.getFloat64(0);
}
function textureCut(points,radius){
  for(const axis of ['x','y']){
    const min=Math.min(...points.map(q=>q[axis])),max=Math.max(...points.map(q=>q[axis]));
    const first=cell(min,radius),last=cell(max,radius);
    if(first===last||!Number.isSafeInteger(first)||!Number.isSafeInteger(last))continue;
    const boundary=first+Math.floor((last-first)/2)+1;
    const edge=boundary/24*radius;
    if(!Number.isFinite(edge))continue;
    // Leave a visible binary64 uncertainty strip across local/world conversion.
    // Adjacent world values alone can collapse to the same pixel-local value.
    const coordinateScale=Math.max(Math.abs(edge),Math.abs(radius),Number.MIN_VALUE);
    const guard=64*EPS*coordinateScale,margin=8*EPS*coordinateScale;
    let lo=edge-guard,hi=edge+guard;
    // Bounded search only. Extreme coordinate resolution can force the normal
    // interval path; never invent a constant texture value or loop unboundedly.
    for(let i=0;i<8&&cell(lo,radius)>=boundary;i++)lo=adjacent(lo,-1);
    for(let i=0;i<8&&cell(hi,radius)<boundary;i++)hi=adjacent(hi,1);
    if(cell(lo,radius)>=boundary||cell(hi,radius)<boundary)continue;
    if(lo>min+margin&&lo<max-margin)return {axis,value:lo};
    if(hi>min+margin&&hi<max-margin)return {axis,value:hi};
  }
  return undefined;
}

export function pigmentStrokeSource(record) {
  const p = record?.paint;
  if (!p || p.version !== 2 || !['round', 'soft', 'textured'].includes(p.tip) ||
      !Number.isFinite(p.radius) || p.radius <= 0 || !Number.isFinite(p.radius ** 2) || p.radius ** 2 < MIN_NORMAL || p.radius * .5 === 0 || !Number.isFinite(p.flow) || p.flow < .1 || p.flow > 1 ||
      !Number.isFinite(p.opacity) || p.opacity < .1 || p.opacity > 1 || !Number.isSafeInteger(p.seed) || p.seed < 0 || p.seed > 0xffffffff)
    fail('parameters');
  const strokes = p.strokes ?? [record.points];
  if (!Array.isArray(strokes)) fail('strokes');
  if (p.fill !== undefined && p.fill !== false) fail('stroke-only paint');
  if (p.operation !== undefined && !['paint', 'erase'].includes(p.operation)) fail('operation');
  if (p.target !== undefined && !['ground', 'water'].includes(p.target)) fail('target');
  const stamps = [];
  for (const stroke of strokes) {
    if (!Array.isArray(stroke)) fail('stroke');
    if (!stroke.length) continue;
    for (const q of stroke) {
      if (!Number.isFinite(q?.x) || !Number.isFinite(q?.y)) fail('point');
      if (p.tip === 'textured' && (![q.x / p.radius * 24, q.y / p.radius * 24].every(Number.isFinite))) fail('texture extent');
    }
    stamps.push({ x: stroke[0].x, y: stroke[0].y });
    for (let n = 1; n < stroke.length; n++) {
      const a = stroke[n - 1], b = stroke[n];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (p.radius * .5)));
      if (stamps.length + steps > MAX_STAMPS) fail('more than 4000 stamps');
      for (let j = 1; j <= steps; j++) stamps.push({ x: a.x + (b.x - a.x) * j / steps, y: a.y + (b.y - a.y) * j / steps });
    }
    if (stamps.length > MAX_STAMPS) fail('more than 4000 stamps');
  }
  const radius2 = p.radius ** 2;
  function coverage(point) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) fail('sample point');
    if (p.tip === 'textured' && ![point.x / p.radius * 24, point.y / p.radius * 24].every(Number.isFinite)) fail('texture extent');
    let c = 0;
    for (const stamp of stamps) {
      const r2 = ((point.x - stamp.x) ** 2 + (point.y - stamp.y) ** 2) / radius2;
      if (r2 > 1) continue;
      let strength = p.tip === 'round' ? 1 : (1 - r2) ** 2;
      if (p.tip === 'textured') strength *= textureValue(point.x, point.y, p);
      c = f32(1 - (1 - c) * (1 - p.flow * strength));
    }
    return c;
  }
  function alpha(point) { return Math.round(255 * coverage(point)) / 255 * p.opacity; }

  function alphaRange(triangle) {
    const pts = Array.isArray(triangle) ? triangle : triangle?.points;
    if (!Array.isArray(pts) || pts.length !== 3 || pts.some(q => !Number.isFinite(q?.x) || !Number.isFinite(q?.y))) fail('triangle');
    if (p.tip === 'textured' && pts.some(q => ![q.x / p.radius * 24, q.y / p.radius * 24].every(Number.isFinite))) fail('texture extent');
    const minX = Math.min(...pts.map(q => q.x)), maxX = Math.max(...pts.map(q => q.x));
    const minY = Math.min(...pts.map(q => q.y)), maxY = Math.max(...pts.map(q => q.y));
    let lo = 0, hi = 0;
    for (const stamp of stamps) {
      const dx = stamp.x < minX ? minX - stamp.x : stamp.x > maxX ? stamp.x - maxX : 0;
      const dy = stamp.y < minY ? minY - stamp.y : stamp.y > maxY ? stamp.y - maxY : 0;
      const far = Math.max(...pts.map(q => (q.x - stamp.x) ** 2 + (q.y - stamp.y) ** 2));
      const nearRaw = (dx * dx + dy * dy) / radius2;
      const farRaw = far / radius2;
      const near = lowerGuard(nearRaw), farR = upperGuard(farRaw);
      if (near > 1) continue;
      let strengthLo = farR > 1 ? 0 : p.tip === 'round' ? 1 : (1 - farR) ** 2;
      let strengthHi = p.tip === 'round' ? 1 : (1 - Math.min(1, near)) ** 2;
      if (p.tip === 'textured') {
        const sameCell = cell(minX, p.radius) === cell(maxX, p.radius) && cell(minY, p.radius) === cell(maxY, p.radius);
        if (sameCell) {
          const t = textureValue(pts[0].x, pts[0].y, p);
          strengthLo *= t; strengthHi *= t;
        } else { strengthLo *= .15; strengthHi *= 1; }
      }
      // The recurrence is monotone, so guarded kernel bounds remain bounds
      // after each production-compatible Float32 rounding step.
      lo = f32(1 - (1 - lo) * (1 - p.flow * strengthLo));
      hi = f32(1 - (1 - hi) * (1 - p.flow * strengthHi));
    }
    const byteLo = Math.round(255 * lo) / 255 * p.opacity;
    const byteHi = Math.round(255 * hi) / 255 * p.opacity;
    return [byteLo, byteHi];
  }
  function smooth(triangle,point){
    const range=alphaRange(triangle);
    if(range[0]===range[1])return {value:range[0],gradient:0,hessian:0,error:0,range};
    if(p.tip==='round')return undefined;
    const minX=Math.min(...triangle.map(q=>q.x)),maxX=Math.max(...triangle.map(q=>q.x));
    const minY=Math.min(...triangle.map(q=>q.y)),maxY=Math.max(...triangle.map(q=>q.y));
    if(p.tip==='textured'&&(cell(minX,p.radius)!==cell(maxX,p.radius)||cell(minY,p.radius)!==cell(maxY,p.radius)))return undefined;
    const factor=p.flow*(p.tip==='textured'?textureValue(point.x,point.y,p):1);
    let value=0,gradient=0,hessian=0,count=0;
    let coordinateScale=Math.max(1,Math.abs(point.x),Math.abs(point.y));
    for(const stamp of stamps){
      const dx=stamp.x<minX?minX-stamp.x:stamp.x>maxX?stamp.x-maxX:0;
      const dy=stamp.y<minY?minY-stamp.y:stamp.y>maxY?stamp.y-maxY:0;
      if(lowerGuard((dx*dx+dy*dy)/radius2)>1)continue;
      count++;coordinateScale=Math.max(coordinateScale,Math.abs(stamp.x),Math.abs(stamp.y));
      // max(0,1-d²/r²)² is C1, including its circle boundary. Its gradient
      // maximum is 8/(3sqrt(3)r), and Hessian operator norm is at most 8/r².
      const g=factor*8/(3*Math.sqrt(3)*p.radius),h=factor*8/radius2;
      hessian+=h+2*gradient*g;gradient+=g;
      const r2=((point.x-stamp.x)**2+(point.y-stamp.y)**2)/radius2;
      const strength=Math.max(0,1-r2)**2*factor;
      value=1-(1-value)*(1-strength);
    }
    // Each Float32 recurrence is nonexpansive in previous coverage. Half an
    // ulp on [0,1] is at most 2^-25; the final byte contributes half a byte.
    // Binary64 arithmetic receives a separate conservative operation allowance.
    const error=(count*2**-25+1/510+count*32*EPS+gradient*64*EPS*coordinateScale)*p.opacity;
    const result={value:value*p.opacity,gradient:gradient*p.opacity,hessian:hessian*p.opacity,error,
      range:[Math.max(0,range[0]-error),Math.min(1,range[1]+error)]};
    return [result.value,result.gradient,result.hessian,error].every(Number.isFinite)?result:undefined;
  }
  return { coverage, alpha, alphaRange, stampCount: stamps.length, smooth,
    integrationCut:p.tip==='textured'?triangle=>textureCut(triangle,p.radius):undefined };
}
