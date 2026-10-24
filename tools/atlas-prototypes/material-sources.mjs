// Isolated adapter prototype: authored LandscapeRecord materials -> generic
// material-area layers. Hard covers, legacy pigment and v2 pigment
// follow the reference's source rules (final composition uses float channels).
// Soft covers opt into the authored-world contract. Not in production.
import polygonClipping from 'polygon-clipping';
import {authoredFeatherRegions} from './general-feather.mjs';
import {pigmentStrokeSource} from './pigment-stroke.mjs';
import {baseRange,scratchRange,editRange,legacyPartRange,coverRange,pigmentRange,materialIntervalError} from './material-interval.mjs';
import {makeSmoothState,baseSmooth,scratchSmooth,editSmooth,legacyPartSmooth,coverSmooth,pigmentSmooth} from './material-smooth.mjs';

const rgb = value => {
  if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) throw Error('Material color missing or invalid');
  return [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
};
const geometry = polygons => (polygons ?? []).map(p => [p.outer, ...(p.holes ?? [])].map(r => r.map(p => [p.x, p.y])));
const clip = (kind, a, b) => !a.length ? [] : !b.length ? (kind === 'difference' ? a : []) : polygonClipping[kind](a, b);
const isPaint = r => !!r.paint;
const constantAlpha=value=>({value,gradient:0,hessian:0,error:0,range:[value,value]});

/**
 * Produce layers for integrateMaterialArea. Channel vector:
 * [baseR,baseG,baseB,baseA,forest,premultipliedR,premultipliedG,premultipliedB,overlayA,
 *  finalR,finalG,finalB,finalA,densityScratch]. Values are normalized floats. Keep the
 * overlay channels separate so later pigment erases pigment without erasing
 * the forest or the ground beneath it. Supply the palette from terrainColors.
 * `waterGeometry` is an already-supplied physical footprint; this adapter
 * never samples or interpolates heights. Arrays are consumed in their given
 * order, matching the caller's stream order. Legacy records require the actual
 * production colorParts helper; its original stamp geometry is not regenerated.
 */
export function landscapeMaterialLayers({baseRecords=[], coverRecords=[], colorRecords=[], palette, colorParts, waterGeometry=[], seaColor, landColor, edgePolicy='reject'}={}) {
  if (!palette || typeof palette !== 'object') throw Error('Inject production terrainColors as palette');
  if(!['reject','authored-world'].includes(edgePolicy))throw Error('Unknown material edge policy');
  const water = geometry(waterGeometry);
  seaColor ??= palette.water;
  const land=rgb(landColor),sea=rgb(seaColor),layers = [];
  const setFinal = v => { for(let c=0;c<4;c++)v[9+c]=v[c]; };
  if(water.length)layers.push({geometry:water,materialRange:baseRange(sea,0),materialSmooth:baseSmooth(sea,0),paint(v){for(let c=0;c<3;c++)v[c]=sea[c];v[3]=1;v[4]=0;setFinal(v);}});

  for (const r of baseRecords) {
    if (r.propertyOnly) continue;
    if (r.mask || r.height || r.route || r.terrainSettings || r.surface === 'freshwater') throw Error('Base masks and field-driven terrain are unsupported; supply the resolved field explicitly');
    if (r.kind !== 'patch' || !r.values?.terrain) throw Error('Unsupported base material record');
    const color=palette[r.values.terrain]; if(!color) throw Error(`Missing terrain palette entry: ${r.values.terrain}`);
    const [cr,cg,cb]=rgb(color), g=geometry(r.polygons);
    if(!g.length)continue;
    // Actual field water replaces the displayed color with the water color.
    const dry=clip('difference',g,water),wet=clip('intersection',g,water);
    const basePaint=(c,alpha,forest)=>v=>{
      v[0]=c[0];v[1]=c[1];v[2]=c[2];v[3]=alpha;setFinal(v);
      v[4]=forest;
    };
    if(dry.length)layers.push({geometry:dry,materialRange:baseRange(cr===sea[0]&&cg===sea[1]&&cb===sea[2]?land:[cr,cg,cb],r.values.terrain==='forest'?1:0),materialSmooth:baseSmooth(cr===sea[0]&&cg===sea[1]&&cb===sea[2]?land:[cr,cg,cb],r.values.terrain==='forest'?1:0),paint:basePaint(cr===sea[0]&&cg===sea[1]&&cb===sea[2]?land:[cr,cg,cb],1,r.values.terrain==='forest'?1:0)});
    if(wet.length)layers.push({geometry:wet,materialRange:baseRange(sea,0),materialSmooth:baseSmooth(sea,0),paint:basePaint(rgb(seaColor),1,0)});
  }

  for (const r of coverRecords) {
    if(!r.vegetation)throw Error('Cover record has no vegetation specification');
    const v=r.vegetation,p=v.preset;
    if(p.edge>0&&edgePolicy!=='authored-world')throw Error('Soft-edged vegetation covers require the explicit authored-world policy');
    const g=geometry(r.polygons);if(!g.length)continue;
    const edits=(v.edits??[]).map(e=>{
      if(!['clear','thin','dense'].includes(e.mode))throw Error(`Unsupported vegetation edit: ${e.mode}`);
      return {mode:e.mode,geometry:geometry(e.polygons)};
    });
    const color=rgb(p.ground);
    // Each edit contributes its own geometry to the arrangement. Evaluating
    // contains(point) inside a constant face would lose subpixel edit boundaries.
    const dry=clip('difference',g,water);
    if(dry.length){
      layers.push({geometry:dry,materialRange:scratchRange(p.density),materialSmooth:scratchSmooth(p.density),paint(vect){vect[13]=p.density;}});
      for(const edit of edits){
        const affected=clip('intersection',dry,edit.geometry);
        if(affected.length)layers.push({geometry:affected,materialRange:editRange(edit.mode),materialSmooth:editSmooth(edit.mode),paint(vect){
          vect[13]=edit.mode==='clear'?0:edit.mode==='thin'?vect[13]*.3:Math.min(1,vect[13]+.5);
        }});
      }
      const regions=p.edge>0?authoredFeatherRegions(r.polygons,p.edge):[{geometry:g,fade:()=>1,varying:false}];
      for(const region of regions){
        const visible=clip('difference',region.geometry,water);if(!visible.length)continue;
        // Only affine boundary distance yields cubic ground opacity. General
        // segment distance includes corner arcs and must retain unknown degree.
        const degree=region.varying?(region.polynomialDegree===1?3:undefined):0;
        const polynomialDegreeOnTriangle=region.polynomialDegreeOnTriangle?triangle=>{
          const local=region.polynomialDegreeOnTriangle(triangle);
          return local===0?0:local===1?3:undefined;
        }:undefined;
        const materialDerivativesOnTriangle=triangle=>{
          const feature=region.varying?(region.featureOnTriangle?.(triangle)??(region.polynomialDegree===1?{kind:'affine'}:undefined)):{kind:'constant'};
          if(!feature)return undefined;
          if(feature.kind==='constant')return {gradient:0,hessian:0};
          // Radial smoothstep has Hessian eigenvalues bounded by 6/r²;
          // linear forest distance needs separation from its endpoint.
          const gradient=1.17/p.edge,hessian=Math.max(4.68/p.edge**2,feature.kind==='point'?1/(p.edge*feature.minDistance):0);
          return Number.isFinite(gradient)&&Number.isFinite(hessian)?{gradient,hessian}:undefined;
        };
        layers.push({geometry:visible,varying:region.varying,polynomialDegree:degree,polynomialDegreeOnTriangle,materialDerivativesOnTriangle,materialRange:coverRange(color,region,p.edge),materialSmooth:coverSmooth(color,region,p.edge),paint(vect,point){
          if(vect[3]!==1)throw Error('Material adapter requires its opaque canonical background');
          const t=region.fade(point),smooth=t*t*(3-2*t),a=.78*smooth;
          for(let c=0;c<3;c++)vect[c]=color[c]*a+vect[c]*(1-a);
          vect[4]=vect[4]*(1-t)+Math.min(1,vect[13]/.8)*t;setFinal(vect);
        }});
      }
    }
  }

  const waterG=water;
  for (const r of colorRecords) {
    if(!isPaint(r))throw Error('Color record has no pigment specification');
    const p=r.paint;
    if(r.mask || p.visibility)throw Error('Pigment masks require a supplied resolved field');
    const source=geometry(r.polygons),target=p.target==='water'?clip('intersection',source,waterG):p.target==='ground'?clip('difference',source,waterG):null;
    if(!target)throw Error('Unknown pigment target'); if(!target.length)continue;
    const color=rgb(p.color),alpha=p.opacity;
    if(p.version===1){
      if(typeof colorParts!=='function')throw Error('Inject production colorParts for legacy pigment');
      if(typeof p.opacity!=='number'||!Number.isFinite(p.opacity)||p.opacity<0||p.opacity>1)throw Error('Invalid legacy pigment opacity');
      const parts=colorParts(r);if(!parts.length)continue;
      // colorParts already clips every stamp to the record polygon. Reset and
      // composite over that target so empty/zero-coverage stamps have no effect.
      layers.push({geometry:target,materialRange:scratchRange(0),materialSmooth:scratchSmooth(0),paint(v){v[13]=0;}});
      for(const part of parts){
        if(part.color!==p.color)throw Error('Legacy pigment parts must preserve the record color');
        const g=geometry(part.polygons).map(poly=>p.target==='water'?clip('intersection',[poly],waterG):clip('difference',[poly],waterG)).flat();if(!g.length||!part.opacity)continue;
        // Match polygonSteps: use raw opacity in source-over, then round the
        // composed alpha to Uint8 after each part.
        layers.push({geometry:g,materialRange:legacyPartRange(part.opacity),materialSmooth:legacyPartSmooth(part.opacity),paint(v){v[13]=Math.round((part.opacity+v[13]*(1-part.opacity))*255)/255;}});
      }
      layers.push({geometry:target,materialRange:pigmentRange(color,'paint',v=>v[13].map(x=>x*p.opacity)),materialSmooth:pigmentSmooth(color,'paint',state=>constantAlpha(state.value[13]*p.opacity)),paint(v){
        const recordAlpha=v[13]*p.opacity;
        if(!recordAlpha)return;
        for(let c=0;c<3;c++){
          v[5+c]=color[c]*recordAlpha+v[5+c]*(1-recordAlpha);
          v[9+c]=color[c]*recordAlpha+v[9+c]*(1-recordAlpha);
        }
        v[8]=recordAlpha+v[8]*(1-recordAlpha);v[12]=1;
      }});
    }else if(p.version===2){
      const stroke=p.fill?null:pigmentStrokeSource(r);
      if(!Number.isFinite(alpha)||alpha<0||alpha>1)throw Error('Invalid pigment opacity');
      if(!['paint','erase'].includes(p.operation))throw Error('Unsupported pigment operation');
      layers.push({geometry:target,varying:!!stroke,discontinuous:!!stroke,integrationCut:stroke?.integrationCut,
        polynomialDegreeOnTriangle:stroke?triangle=>{const [lo,hi]=stroke.alphaRange(triangle);return lo===hi?0:undefined;}:undefined,
        materialRange:pigmentRange(color,p.operation,(_v,triangle)=>stroke?stroke.alphaRange(triangle):[alpha,alpha]),
        materialSmooth:pigmentSmooth(color,p.operation,(_state,triangle,point)=>stroke?stroke.smooth(triangle,point):constantAlpha(alpha)),
        paint(v,point){
        const alpha=stroke?stroke.alpha(point):p.opacity;
        if(!alpha)return;
        for(let c=0;c<3;c++){
          v[5+c]=(p.operation==='erase'?0:color[c])*alpha+v[5+c]*(1-alpha);
          v[9+c]=(p.operation==='erase'?v[c]:color[c])*alpha+v[9+c]*(1-alpha);
        }
        v[8]=(p.operation==='erase'?0:1)*alpha+v[8]*(1-alpha);v[12]=1;
      }});
    }else throw Error('Unsupported pigment version');
  }
  // All other operations are spatially constant on their partition face.
  // They set/contract base and final channels; pigment scratch stays constant.
  for(const layer of layers)if(!layer.varying&&!layer.materialDerivativesOnTriangle)layer.materialDerivativesOnTriangle=()=>({gradient:0,hessian:0});
  return layers;
}

/** Trusted final-channel mean error for THIS adapter's normalized, opaque
 * composition. Unknown layer/feature means no second-order certificate. */
export function landscapeMaterialCentroidError(activeLayers,triangle,context){
  if(activeLayers.some(layer=>layer.discontinuous))return materialIntervalError(activeLayers,triangle,context);
  let gradient=0,hessian=0;
  for(const layer of activeLayers){
    const bound=layer.materialDerivativesOnTriangle?.(triangle);if(!bound)return undefined;
    hessian+=bound.hessian+2*gradient*bound.gradient;
    gradient+=bound.gradient;
  }
  const local=triangle.map(p=>({x:p.x-triangle[0].x,y:p.y-triangle[0].y}));
  const center={x:local.reduce((s,p)=>s+p.x,0)/3,y:local.reduce((s,p)=>s+p.y,0)/3};
  const moment=local.reduce((s,p)=>s+(p.x-center.x)**2+(p.y-center.y)**2,0)/24;
  const error=hessian*moment;return Number.isFinite(error)?error:undefined;
}

/** Opaque canonical default land, before authored base patches and field water. */
export function landscapeMaterialBackground(landColor){
  const land=rgb(landColor);return [...land,1,0,0,0,0,0,...land,1,0];
}

/** Componentwise bound inside a partition face for normalized source-over
 * channels. Densities and water/pigment masks are constant within that face. */
export function landscapeMaterialLipschitz(coverRecords){
  return coverRecords.reduce((sum,r)=>sum+(r.vegetation.preset.edge>0?1.17/r.vegetation.preset.edge:0),0);
}

/** Alternative mean estimate with an explicit source-rounding error budget. */
export function landscapeMaterialTriangleEstimate(active,triangle,context){
  if(!active.some(layer=>layer.discontinuous))return undefined;
  const state=makeSmoothState(context.background);
  const a=triangle[0],center={x:a.x+(triangle[1].x-a.x)/3+(triangle[2].x-a.x)/3,y:a.y+(triangle[1].y-a.y)/3+(triangle[2].y-a.y)/3};
  for(const layer of active)if(!layer.materialSmooth?.(state,triangle,center))return undefined;
  const moment=triangle.reduce((s,p)=>s+(p.x-center.x)**2+(p.y-center.y)**2,0)/24;
  const coordinateGuard=64*Number.EPSILON*Math.max(1,...triangle.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]));
  const error=Math.max(...state.hessian.map((h,c)=>h*moment+state.error[c]+state.gradient[c]*coordinateGuard))+active.length*64*Number.EPSILON;
  return Number.isFinite(error)?{value:state.value,error}:undefined;
}
