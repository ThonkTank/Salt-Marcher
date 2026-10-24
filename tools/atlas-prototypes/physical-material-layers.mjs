// Isolated adapter: compose authored material sources with an exact physical
// water field. The fifteenth channel records sampled water (0/1).
import {landscapeMaterialLayers} from './material-sources.mjs';
import {materialIntervalError,takeMaterialIntervalEstimate} from './material-interval.mjs';

const rgb=value=>{
  if(typeof value!=='string'||!/^#[\da-f]{6}$/i.test(value))throw Error('Material color missing or invalid');
  return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255);
};
const geometry=box=>[[[[box.x,box.y],[box.x+box.width,box.y],[box.x+box.width,box.y+box.height],[box.x,box.y+box.height],[box.x,box.y]]]];
const boxOf=points=>{
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
  return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};
};
const same=a=>a[0]===a[1];
const hull=(a,b)=>[Math.min(a[0],b[0]),Math.max(a[1],b[1])];
const copyRanges=r=>r.map(x=>[...x]);
const singleton=x=>[x,x];

/** Opaque canonical land with the physical-water channel appended. */
export function physicalMaterialBackground(landColor){
  const land=rgb(landColor);
  return [...land,1,0,0,0,0,0,...land,1,0,0];
}

/**
 * Adapt authored sources to a sampled physical field. The field supplies
 * diagnostics.query, sample(point), range(box), and integrationCut(triangle).
 * Source ordering, validation, and composition remain owned by
 * landscapeMaterialLayers.
 */
export function physicalMaterialLayers({field,box,baseRecords=[],coverRecords=[],colorRecords=[],palette,colorParts,landColor,seaColor,edgePolicy='reject',strokeSupport=true}={}){
  if(!field||typeof field.sample!=='function'||typeof field.range!=='function'||typeof field.integrationCut!=='function'||!field.diagnostics?.query)
    throw Error('Physical material field is incomplete');
  if(!box||![box.x,box.y,box.width,box.height].every(Number.isFinite)||box.width<=0||box.height<=0)
    throw Error('Invalid physical material box');
  const samples=new WeakMap(),ranges=new WeakMap(),cuts=new WeakMap();
  const sampleAt=point=>{
    let result=samples.get(point);if(!result){result=field.sample(point);if(typeof result?.water!=='boolean')throw Error('Physical field sample has no water state');samples.set(point,result);}
    return result;
  };
  const fieldRange=triangle=>{
    let result=ranges.get(triangle);if(!result){result=field.range(boxOf(triangle));
      if(!Array.isArray(result?.water)||result.water.length!==2||!result.water.every(v=>v===0||v===1)||result.water[0]>result.water[1])throw Error('Invalid physical water range');
      ranges.set(triangle,result);
    }return result;
  };
  const baseAndCover=landscapeMaterialLayers({baseRecords,coverRecords,palette,colorParts,
    waterGeometry:[],landColor,seaColor,edgePolicy,strokeSupport});
  const land=rgb(landColor),sea=rgb(seaColor??palette?.water);
  const full=geometry(box);
  const layers=[{
    geometry:full,varying:true,discontinuous:true,
    polynomialDegreeOnTriangle(triangle){const w=fieldRange(triangle).water;return same(w)?0:undefined;},
    materialRange(v,triangle){
      const w=fieldRange(triangle).water,lo=w[0]===1?sea:land,hi=w[1]===1?sea:land;
      for(let c=0;c<3;c++)v[c]=hull(singleton(lo[c]),singleton(hi[c]));
      v[3]=singleton(1);v[4]=singleton(0);
      for(let c=0;c<4;c++)v[9+c]=[...v[c]];
      v[13]=singleton(0);v[14]=[...w];
    },
    integrationCut(triangle){return cutFor(triangle);},
    paint(v,point){
      const wet=sampleAt(point).water,color=wet?sea:land;
      for(let c=0;c<3;c++)v[c]=color[c];v[3]=1;v[4]=0;
      for(let c=0;c<4;c++)v[9+c]=v[c];v[13]=0;v[14]=wet?1:0;
    }
  }];
  function cutFor(triangle){
    if(cuts.has(triangle))return cuts.get(triangle);
    const w=fieldRange(triangle).water;
    const cut=same(w)?undefined:field.integrationCut(triangle);
    cuts.set(triangle,cut);return cut;
  }
  const wrap=(original,gate)=>{
    const waterRange=triangle=>fieldRange(triangle).water;
    return {...original,varying:true,discontinuous:true,polynomialDegree:undefined,
      paint(v,point){const wet=sampleAt(point).water;if((gate==='wet')!==wet)return;original.paint(v,point);},
      materialRange(v,triangle){
        const before=copyRanges(v),after=copyRanges(v);original.materialRange(after,triangle);
        const w=waterRange(triangle),enabled=gate==='wet'?[1,1]:[0,0];
        if(same(w)&&w[0]===enabled[0]){for(let c=0;c<v.length;c++)v[c]=after[c];return;}
        if(same(w))return;
        for(let c=0;c<v.length;c++)v[c]=hull(before[c],after[c]);
      },
      polynomialDegreeOnTriangle(triangle){
        const w=waterRange(triangle),enabled=gate==='wet'?1:0;
        if(same(w)&&w[0]!==enabled)return 0;
        if(!same(w))return undefined;
        if(!original.varying)return 0;
        if(original.polynomialDegreeOnTriangle)return original.polynomialDegreeOnTriangle(triangle);
        return original.polynomialDegree;
      },
      integrationCut(triangle){
        const physical=cutFor(triangle);if(physical!==undefined)return physical;
        return original.integrationCut?.(triangle);
      }
    };
  };
  // Base and cover layers retain their original relative ordering and are dry-gated.
  for(const original of baseAndCover)layers.push(wrap(original,'dry'));
  // Construct pigments one record at a time so every emitted layer inherits
  // exactly that record's target, including each legacy stamp layer.
  for(const record of colorRecords){
    const target=record.paint?.target;
    if(target!=='water'&&target!=='ground')throw Error('Unknown pigment target');
    // Generate the original pigment geometry without asking the helper to add
    // its automatic water-base layer. The physical target is restored below
    // as a sampled gate, and the authored record remains untouched.
    const sourceRecord={...record,paint:{...record.paint,target:'ground'}};
    const recordLayers=landscapeMaterialLayers({colorRecords:[sourceRecord],palette,colorParts,
      waterGeometry:[],landColor,seaColor,edgePolicy,strokeSupport});
    const gate=target==='water'?'wet':'dry';
    for(const original of recordLayers)layers.push(wrap(original,gate));
  }
  return layers;
}

/** 15-channel centroid error callback compatible with integrateMaterialArea. */
export function physicalMaterialCentroidError(active,triangle,context){
  if(active.some(layer=>layer.discontinuous))return materialIntervalError(active,triangle,context);
  return undefined;
}

/** Certified 15-channel estimate for discontinuous physical gates. */
export function physicalMaterialTriangleEstimate(active,triangle,context){
  if(!active.some(layer=>layer.discontinuous))return undefined;
  return takeMaterialIntervalEstimate(context);
}
