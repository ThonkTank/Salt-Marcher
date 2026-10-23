import type {Point} from './contracts';
import type {TerrainGrid} from './terrain-spatial-model';
import type {AtlasMetricRoot} from './atlas-metric-space';
import {metricProjectionParameters} from './atlas-metric-space';
import {buildAtlasCanonicalSceneModel, type AtlasSceneSelectionTarget} from './atlas-scene-geometry';
import type {AtlasRegionView} from './atlas-region-contracts';

export type AtlasMapLibreSelectionTarget = AtlasSceneSelectionTarget;

export interface AtlasMapLibreSceneObject {
  id:string;
  target:AtlasMapLibreSelectionTarget;
  positions:Float32Array;
  indices:Uint32Array;
}
export interface AtlasMapLibreSceneModel {
  readonly root:Readonly<AtlasMetricRoot>;
  readonly sceneOrigin:Readonly<Point>;
  objects:AtlasMapLibreSceneObject[];
  targets:ReadonlyMap<string,AtlasMapLibreSelectionTarget>;
  coverage:{complete:boolean;supportedKinds:readonly ('terrain'|'room'|'building')[];unsupported:{code:string;detail:string}[]};
  verticalOriginM:0;
  verticalExaggeration:number;
}
export interface BuildAtlasMapLibreSceneModelOptions {
  view:AtlasRegionView;
  terrain:TerrainGrid|null;
  root:AtlasMetricRoot;
  sceneOrigin:Point;
  display?:{metersPerPixel:number;roofs:boolean;scopeId:string|null};
}

const FLOAT32_MAX=3.4028234663852886e38;

/** Legacy MapLibre transport wrapper. Canonical geometry is built once in
 * Float64 world metres, then encoded into this renderer's fixed root. */
export function buildAtlasMapLibreSceneModel(options:BuildAtlasMapLibreSceneModelOptions):AtlasMapLibreSceneModel {
  const {root,sceneOrigin}=options;
  if(!root||!sceneOrigin||![root.x,root.y,root.size,sceneOrigin.x,sceneOrigin.y].every(Number.isFinite)||root.size<=0)
    throw new Error('Invalid Atlas scene domain');
  metricProjectionParameters(root);
  const canonical=buildAtlasCanonicalSceneModel(options);
  const objects=canonical.objects.map(object=>{
    const positions=new Float32Array(object.positions.length);
    for(let i=0;i<object.positions.length;i+=3){
      const x=object.positions[i]!,y=object.positions[i+1]!,z=object.positions[i+2]!;
      if(x<root.x||y<root.y||x>root.x+root.size||y>root.y+root.size)
        throw new Error('Atlas scene geometry lies outside its fixed metric root');
      const local:[number,number,number]=[(x-sceneOrigin.x)/root.size,(y-sceneOrigin.y)/root.size,z*canonical.verticalExaggeration/root.size];
      if(!local.every(Number.isFinite)||local.some(value=>Math.abs(value)>FLOAT32_MAX))
        throw new Error('Atlas scene vertex cannot be represented in root-local GPU coordinates');
      positions.set(local,i);
    }
    return {id:object.id,target:object.target,positions,indices:object.indices};
  });
  return {root:Object.freeze({...root}),sceneOrigin:Object.freeze({...sceneOrigin}),objects,targets:canonical.targets,
    coverage:canonical.coverage,verticalOriginM:0,verticalExaggeration:canonical.verticalExaggeration};
}
