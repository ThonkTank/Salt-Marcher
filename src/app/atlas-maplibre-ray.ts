import {Matrix4} from '@math.gl/core';
import {atlasMapLibreViewMatrices} from './atlas-maplibre-matrices';
import type {AtlasMapLibreFrame} from './atlas-maplibre-bridge';
import type {AtlasMetricRoot} from './atlas-metric-space';
import type {AtlasMapLibreSceneObject} from './atlas-maplibre-scene-model';
import {atlasMetricMeshRayIndexBuildCount, intersectAtlasMetricMeshSegment} from './atlas-mesh-ray';

export interface AtlasMapLibreRayHit {
  point:{x:number;y:number;heightM:number};
  clipDistance:number;
}
export interface AtlasMapLibreRayQuery {
  object:AtlasMapLibreSceneObject;
  frame:Pick<AtlasMapLibreFrame,'projection'|'mainMatrix'|'nearZ'|'farZ'>;
  viewport:Readonly<{x:number;y:number;width:number;height:number}>;
  pixel:Readonly<{x:number;y:number}>;
  root:Readonly<AtlasMetricRoot>;
  sceneOrigin:Readonly<{x:number;y:number}>;
  verticalOriginM:number;
  verticalExaggeration:number;
}
type Vec3=[number,number,number];
const finite=(...values:number[])=>values.every(Number.isFinite);

export function atlasMapLibreRayIndexBuildCount(object:AtlasMapLibreSceneObject):number {
  return atlasMetricMeshRayIndexBuildCount(object);
}

function unproject(matrix:Matrix4,x:number,y:number,z:number):Vec3|null {
  const point=matrix.transformPoint([x,y,z]),result:Vec3=[point[0]!,point[1]!,point[2]!];
  return result.every(Number.isFinite)?result:null;
}

export interface AtlasMapLibreRaySegmentQuery {
  frame:Pick<AtlasMapLibreFrame,'projection'|'mainMatrix'|'nearZ'|'farZ'>;
  viewport:Readonly<{x:number;y:number;width:number;height:number}>;
  pixel:Readonly<{x:number;y:number}>;
  root:Readonly<AtlasMetricRoot>;
  sceneOrigin:Readonly<{x:number;y:number}>;
}

/** Unproject one canvas point through the captured shared-camera matrix.
 * The returned segment is clipped to WebGL NDC depth [-1,+1]. */
export function atlasMapLibreRaySegment(query:AtlasMapLibreRaySegmentQuery):readonly [Vec3,Vec3]|null {
  const {frame,viewport,pixel,root,sceneOrigin}=query;
  if(!frame||frame.projection.length!==16||!finite(...frame.projection)
    ||frame.mainMatrix.length!==16||!finite(...frame.mainMatrix)
    ||!finite(frame.nearZ,frame.farZ)||frame.nearZ<=0||frame.farZ<=frame.nearZ
    ||!finite(viewport.x,viewport.y,viewport.width,viewport.height)||viewport.width<=0||viewport.height<=0
    ||!finite(pixel.x,pixel.y)||!finite(root.x,root.y,root.size)||root.size<=0
    ||!finite(sceneOrigin.x,sceneOrigin.y))throw new Error('Invalid Atlas ray segment query');
  if(pixel.x<viewport.x||pixel.x>viewport.x+viewport.width||pixel.y<viewport.y||pixel.y>viewport.y+viewport.height)return null;
  const matrices=atlasMapLibreViewMatrices(frame,root,sceneOrigin);
  if(!matrices)return null;
  const localClip=matrices.projectionMatrix.multiplyRight(matrices.viewMatrix),determinant=localClip.determinant();
  if(!Number.isFinite(determinant)||determinant===0)return null;
  const inverse=localClip.invert();
  if(!Array.from(inverse).every(Number.isFinite))return null;
  const ndcX=(pixel.x-viewport.x)/viewport.width*2-1,ndcY=1-(pixel.y-viewport.y)/viewport.height*2;
  const start=unproject(inverse,ndcX,ndcY,-1),end=unproject(inverse,ndcX,ndcY,1);
  return start&&end?[start,end]:null;
}

/** Refine only the MapLibre/Deck-selected mesh; its shared-depth result remains
 * the sole visibility and object-selection decision. */
export function refineAtlasMapLibreRayHit(query:AtlasMapLibreRayQuery):AtlasMapLibreRayHit|null {
  const {object,frame,viewport,pixel,root,sceneOrigin,verticalOriginM,verticalExaggeration}=query;
  if(!object||!finite(verticalOriginM,verticalExaggeration)||verticalExaggeration<=0)throw new Error('Invalid Atlas ray query');
  const segment=atlasMapLibreRaySegment({frame,viewport,pixel,root,sceneOrigin});
  if(!segment)return null;
  const tolerance=1e-8*Math.min(1,verticalExaggeration)/root.size;
  const hit=intersectAtlasMetricMeshSegment({object,segment,toleranceMeters:tolerance});
  if(!hit)return null;
  const point={x:sceneOrigin.x+hit.point[0]*root.size,y:sceneOrigin.y+hit.point[1]*root.size,
    heightM:verticalOriginM+hit.point[2]*root.size/verticalExaggeration};
  return Object.values(point).every(Number.isFinite)?{point,clipDistance:hit.segmentFraction}:null;
}
