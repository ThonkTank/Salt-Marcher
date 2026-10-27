/** P CPU/VS ABI. K2 XY, indices and draw origins are supplied unchanged. */
export const TERRAIN_PREPARED_LAYOUT={basisFloats:14,basisBytes:56,draftFloats:6,draftBytes:24,
 x:0,y:1,old:2,next:8,height:0,gradientX:2,gradientY:4} as const;
export type TerrainDoubleSingle=readonly [number,number];
export interface TerrainPreparedValue {height:number;gradientX:number;gradientY:number}

/** This is a derived producer envelope, not a clamp or a new authoring rule.
 * 49 saturated bands plus legacy give 50e6. Each of 32 uncheckpointed closed
 * gestures and the active gesture can replace one band by at most 2e6.
 * Only confirmed absolute alpha-1 drafts may become a following old endpoint
 * (116e6, never the composed intermediate field); new stays50e6.
 * K4's smallest physical support is 1/64m. A one-sided difference has the
 * same worst bound as a two-sided difference: 2H/support. */
export const TERRAIN_PREPARED_RANGE={canonicalHeight:50e6,draftHeight:116e6,minimumSupport:1/64,
 canonicalGradient:2*50e6*64,draftGradient:2*116e6*64,
 transitionOldHeight:116e6,transitionOldGradient:2*116e6*64,displayedHeight:282e6,displayedGradient:2*282e6*64} as const;
/** Seven vertex attributes, with no source slots encoded per vertex. */
export const TERRAIN_PREPARED_ATTRIBUTES={
 xy:{size:2,offset:0,stride:56},oldHeight:{size:2,offset:8,stride:56},oldGradient:{size:4,offset:16,stride:56},
 newHeight:{size:2,offset:32,stride:56},newGradient:{size:4,offset:40,stride:56},
 draftHeight:{size:2,offset:0,stride:24},draftGradient:{size:4,offset:8,stride:24}
} as const;

/** Conservative conditional forward bound for THIS operation graph. The
 * handoff derives the 128 coefficient; it is not a GPU/compiler guarantee.
 * Final single-float rounding is separate and depends on the relative range. */
export function terrainPreparedErrorBound(oldMagnitude:number,newMagnitude:number,draftMagnitude:number,originMagnitude=0){
 if(![oldMagnitude,newMagnitude,draftMagnitude,originMagnitude].every(v=>Number.isFinite(v)&&v>=0))throw Error('Terrain-Fehlerhülle prüfen.');
 const terms=oldMagnitude+2*newMagnitude+draftMagnitude+originMagnitude;
 return{pack:2**-48*(oldMagnitude+newMagnitude+draftMagnitude+originMagnitude)+4*2**-150,
  arithmeticAndPack:128*2**-48*terms+256*2**-149,
  finalRelativeRound:2**-24*(oldMagnitude+newMagnitude+draftMagnitude+originMagnitude)+2**-150};
}

export function terrainSplit(value:number):TerrainDoubleSingle {
 if(!Number.isFinite(value))throw Error('Terrainfeldwert nicht endlich.');
 const hi=Math.fround(value),lo=Math.fround(value-hi);
 if(!Number.isFinite(hi)||!Number.isFinite(lo))throw Error('Terrainfeldwert nicht darstellbar.');
 return[hi,lo];
}
function put(out:Float32Array,at:number,v:TerrainPreparedValue){
 for(const [offset,value] of [[0,v.height],[2,v.gradientX],[4,v.gradientY]] as const){const p=terrainSplit(value);out[at+offset]=p[0];out[at+offset+1]=p[1];}
}
function validateValue(v:TerrainPreparedValue,height:number,gradient:number){if(!Number.isFinite(v.height)||Math.abs(v.height)>height||!Number.isFinite(v.gradientX)||!Number.isFinite(v.gradientY)||Math.max(Math.abs(v.gradientX),Math.abs(v.gradientY))>gradient)throw Error('Terrain-Feldhülle prüfen.');}
export function terrainPackBasis(out:Float32Array,vertex:number,xy:readonly [number,number],old:TerrainPreparedValue,next:TerrainPreparedValue,newAbsent=false){
 validateValue(old,TERRAIN_PREPARED_RANGE.transitionOldHeight,TERRAIN_PREPARED_RANGE.transitionOldGradient);if(newAbsent){if(old.height!==next.height||old.gradientX!==next.gradientX||old.gradientY!==next.gradientY)throw Error('Terrain-Abwesenheitsalias prüfen.');}else validateValue(next,TERRAIN_PREPARED_RANGE.canonicalHeight,TERRAIN_PREPARED_RANGE.canonicalGradient);
 const at=vertex*TERRAIN_PREPARED_LAYOUT.basisFloats;
 if(!Number.isSafeInteger(vertex)||vertex<0||at+14>out.length||!xy.every(Number.isFinite))throw Error('Terrainbasisposition prüfen.');
 out[at]=xy[0];out[at+1]=xy[1];if(!Number.isFinite(out[at])||!Number.isFinite(out[at+1]))throw Error('Terrain-XY nicht darstellbar.');put(out,at+2,old);if(newAbsent)out.set(out.subarray(at+2,at+8),at+8);else put(out,at+8,next);
}
export function terrainPackDraft(out:Float32Array,vertex:number,value:TerrainPreparedValue){
 validateValue(value,TERRAIN_PREPARED_RANGE.draftHeight,TERRAIN_PREPARED_RANGE.draftGradient);
 const at=vertex*6;if(!Number.isSafeInteger(vertex)||vertex<0||at+6>out.length)throw Error('Terraindraftposition prüfen.');put(out,at,value);
}

interface Arithmetic<T>{add(a:T,b:T):T;sub(a:T,b:T):T;mul(a:T,b:T):T;constant(n:number):T}
type Pair<T>=readonly [T,T];
/** One operation graph emits both JS float operations and GLSL statements.
 * Round-to-nearest binary32, separate operations, no reassociation/contraction
 * are prerequisites. Actual compiled shader/readback remains a separate gate. */
function arithmetic<T>(o:Arithmetic<T>){
 const sum=(a:T,b:T):Pair<T>=>{const s=o.add(a,b),v=o.sub(s,a);return[s,o.add(o.sub(a,o.sub(s,v)),o.sub(b,v))];};
 const add=(a:Pair<T>,b:Pair<T>):Pair<T>=>{const s=sum(a[0],b[0]),t=o.add(o.add(s[1],a[1]),b[1]);return sum(s[0],t);};
 const sub=(a:Pair<T>,b:Pair<T>):Pair<T>=>add(a,[o.sub(o.constant(0),b[0]),o.sub(o.constant(0),b[1])]);
 const split=(a:T):Pair<T>=>{const c=o.mul(o.constant(4097),a),h=o.sub(c,o.sub(c,a));return[h,o.sub(a,h)];};
 const scale=(a:Pair<T>,b:T):Pair<T>=>{const p=o.mul(a[0],b),x=split(a[0]),y=split(b);
  const e=o.add(o.add(o.add(o.sub(o.mul(x[0],y[0]),p),o.mul(x[0],y[1])),o.mul(x[1],y[0])),o.mul(x[1],y[1]));
  return sum(p,o.add(e,o.mul(a[1],b)));
 };
 const mix=(a:Pair<T>,b:Pair<T>,alpha:T)=>add(a,scale(sub(b,a),alpha));
 const field=(a:Pair<T>,b:Pair<T>,d:Pair<T>,alpha:T)=>add(mix(a,b,alpha),sub(d,b));
 return{add,sub,scale,mix,field};
}
const f=Math.fround;
const cpu=arithmetic<number>({add:(a,b)=>f(a+b),sub:(a,b)=>f(a-b),mul:(a,b)=>f(a*b),constant:f});
/** The alpha is the actual uploaded float, never a fresh clock quotient. */
export function terrainEvaluatePair(old:TerrainDoubleSingle,next:TerrainDoubleSingle,draft:TerrainDoubleSingle|null,alpha:number):TerrainDoubleSingle {
 if(!Number.isFinite(alpha)||alpha<0||alpha>1||f(alpha)!==alpha)throw Error('Terrain-Screenalpha prüfen.');
 if(alpha===1)return draft??next;
 const canonical=alpha===0?old:cpu.mix(old,next,alpha);
 return !draft||draft[0]===next[0]&&draft[1]===next[1]?canonical:cpu.add(canonical,cpu.sub(draft,next));
}
export function terrainEvaluateVertex(basis:Float32Array,draft:Float32Array|null,vertex:number,alpha:number,origin=0):TerrainPreparedValue {
 const at=vertex*14,dt=vertex*6;
 if(!Number.isSafeInteger(vertex)||vertex<0||at+14>basis.length||draft&&dt+6>draft.length)throw Error('Terrainfeldposition prüfen.');
 const component=(c:number)=>terrainEvaluatePair([basis[at+2+c]!,basis[at+3+c]!],[basis[at+8+c]!,basis[at+9+c]!],draft?[draft[dt+c]!,draft[dt+c+1]!]:null,alpha);
 const h=cpu.sub(component(0),terrainSplit(origin)),gx=component(2),gy=component(4);
 // CPU picking reconstructs the height actually sent to clip-space. Keep the
 // Double origin outside the final float; raw gradients receive one final round.
 return{height:origin+f(h[0]+h[1]),gradientX:f(gx[0]+gx[1]),gradientY:f(gy[0]+gy[1])};
}
/** Unrounded hi/lo sum for diagnostics, not the displayed Float32 position. */
export function terrainPairValue(value:TerrainDoubleSingle){return value[0]+value[1];}

function glslFunction(name:string,args:string,run:(o:ReturnType<typeof arithmetic<string>>)=>Pair<string>){
 let serial=0;const lines:string[]=[];
 const op=(symbol:string)=>(a:string,b:string)=>{const v=`t${serial++}`;lines.push(`  float ${v} = ${a} ${symbol} ${b};`);return v;};
 const value=run(arithmetic<string>({add:op('+'),sub:op('-'),mul:op('*'),constant:n=>`${n}.0`}));
 return`vec2 ${name}(${args}) {\n${lines.join('\n')}\n  return vec2(${value[0]}, ${value[1]});\n}`;
}
/** D embeds this source once. Endpoints/no-change are deliberately explicit. */
export const TERRAIN_PREPARED_GLSL=[
 glslFunction('terrainPreparedSubtract','vec2 a, vec2 b',o=>o.sub(['a.x','a.y'],['b.x','b.y'])),
 glslFunction('terrainPreparedMix','vec2 a, vec2 b, float alpha',o=>o.mix(['a.x','a.y'],['b.x','b.y'],'alpha')),
 glslFunction('terrainPreparedAdd','vec2 a, vec2 b',o=>o.add(['a.x','a.y'],['b.x','b.y'])),
 `vec2 terrainPreparedValue(vec2 oldValue, vec2 newValue, vec2 draftValue, float alpha, bool hasDraft) {
  if (alpha == 1.0) return hasDraft ? draftValue : newValue;
  vec2 base = alpha == 0.0 ? oldValue : terrainPreparedMix(oldValue, newValue, alpha);
  if (!hasDraft || all(equal(draftValue, newValue))) return base;
  return terrainPreparedAdd(base, terrainPreparedSubtract(draftValue, newValue));
}
float terrainPreparedRelative(vec2 value, vec2 origin) {
  vec2 relative = terrainPreparedSubtract(value, origin);
  return relative.x + relative.y;
}`
].join('\n');
