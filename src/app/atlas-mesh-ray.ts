export interface AtlasMetricMeshObject {id:string;positions:Float32Array;indices:Uint32Array}
export type AtlasMetricSegment = readonly [readonly [number,number,number],readonly [number,number,number]];
export interface AtlasMetricMeshHit {point:readonly [number,number,number];segmentFraction:number}

type Vec3 = [number, number, number];
interface Bounds {min: Vec3; max: Vec3}
interface TriangleBounds extends Bounds {triangle: number; center: Vec3}
interface BvhNode extends Bounds {
  left?: BvhNode;
  right?: BvhNode;
  triangles?: readonly number[];
}
interface MeshIndex {
  positions: Float32Array;
  indices: Uint32Array;
  root: BvhNode;
  buildCount: number;
}

const indexes = new WeakMap<AtlasMetricMeshObject, MeshIndex>();
const LEAF_SIZE = 8;
const PARALLEL_RELATIVE_EPSILON = Number.EPSILON * 8;

interface MeshHit {distance: number; point: Vec3}

function makeBounds(): Bounds {
  return {min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity]};
}

function includePoint(bounds: Bounds, point: Vec3): void {
  for (let axis = 0; axis < 3; axis++) {
    bounds.min[axis] = Math.min(bounds.min[axis]!, point[axis]!);
    bounds.max[axis] = Math.max(bounds.max[axis]!, point[axis]!);
  }
}

function mergeBounds(target: Bounds, source: Bounds): void {
  includePoint(target, source.min);
  includePoint(target, source.max);
}

function vertex(positions: Float32Array, index: number): Vec3 {
  const offset = index * 3;
  return [positions[offset]!, positions[offset + 1]!, positions[offset + 2]!];
}

function buildIndex(object: AtlasMetricMeshObject, previous?: MeshIndex): MeshIndex {
  const {positions, indices} = object;
  if (positions.length % 3 !== 0 || indices.length % 3 !== 0) throw new Error(`Atlas ray mesh ${object.id} has incomplete vertices or triangles`);
  for (const value of positions) if (!Number.isFinite(value)) throw new Error(`Atlas ray mesh ${object.id} contains non-finite vertices`);

  const triangles: TriangleBounds[] = [];
  const vertexCount = positions.length / 3;
  for (let triangle = 0; triangle < indices.length / 3; triangle++) {
    const ids = [indices[triangle * 3]!, indices[triangle * 3 + 1]!, indices[triangle * 3 + 2]!];
    if (ids.some(id => id >= vertexCount)) throw new Error(`Atlas ray mesh ${object.id} has an out-of-range index`);
    const points = ids.map(id => vertex(positions, id));
    const bounds = makeBounds();
    for (const point of points) includePoint(bounds, point);
    triangles.push({
      ...bounds,
      triangle,
      center: [
        (bounds.min[0] + bounds.max[0]) / 2,
        (bounds.min[1] + bounds.max[1]) / 2,
        (bounds.min[2] + bounds.max[2]) / 2
      ]
    });
  }

  const build = (items: TriangleBounds[]): BvhNode => {
    const bounds = makeBounds();
    for (const item of items) mergeBounds(bounds, item);
    if (items.length <= LEAF_SIZE) return {...bounds, triangles: items.map(item => item.triangle)};

    let axis = 0;
    for (let candidate = 1; candidate < 3; candidate++) {
      if (bounds.max[candidate]! - bounds.min[candidate]! > bounds.max[axis]! - bounds.min[axis]!) axis = candidate;
    }
    items.sort((a, b) => a.center[axis]! - b.center[axis]! || a.triangle - b.triangle);
    const middle = Math.floor(items.length / 2);
    return {...bounds, left: build(items.slice(0, middle)), right: build(items.slice(middle))};
  };

  return {
    positions,
    indices,
    root: triangles.length ? build(triangles) : {...makeBounds(), triangles: []},
    buildCount: (previous?.buildCount ?? 0) + 1
  };
}

function getIndex(object: AtlasMetricMeshObject): MeshIndex {
  const cached = indexes.get(object);
  if (cached?.positions === object.positions && cached.indices === object.indices) return cached;
  const next = buildIndex(object, cached);
  indexes.set(object, next);
  return next;
}

/** Exposed for deterministic tests and diagnostics; camera frames do not affect this count. */
export function atlasMetricMeshRayIndexBuildCount(object: AtlasMetricMeshObject): number {
  return indexes.get(object)?.buildCount ?? 0;
}

function intersectSegmentBounds(start: Vec3, direction: Vec3, bounds: Bounds, upperLimit: number, tolerance: number): number | null {
  let minimum = 0;
  let maximum = upperLimit;
  for (let axis = 0; axis < 3; axis++) {
    const delta = direction[axis]!;
    if (delta === 0) {
      if (start[axis]! < bounds.min[axis]! - tolerance || start[axis]! > bounds.max[axis]! + tolerance) return null;
      continue;
    }
    let a = (bounds.min[axis]! - tolerance - start[axis]!) / delta;
    let b = (bounds.max[axis]! + tolerance - start[axis]!) / delta;
    if (a > b) [a, b] = [b, a];
    minimum = Math.max(minimum, a);
    maximum = Math.min(maximum, b);
    if (minimum > maximum) return null;
  }
  return minimum;
}

function closestPointOnEdge(point: Vec3, a: Vec3, b: Vec3): Vec3 {
  const edge: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const lengthSquared = edge[0] ** 2 + edge[1] ** 2 + edge[2] ** 2;
  if (lengthSquared === 0) return a;
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * edge[0] + (point[1] - a[1]) * edge[1] + (point[2] - a[2]) * edge[2]) / lengthSquared));
  return [a[0] + edge[0] * t, a[1] + edge[1] * t, a[2] + edge[2] * t];
}

function closestPointOnTriangleBoundary(point: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const candidates = [closestPointOnEdge(point, a, b), closestPointOnEdge(point, b, c), closestPointOnEdge(point, c, a)];
  let best = candidates[0]!;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = (candidate[0] - point[0]) ** 2 + (candidate[1] - point[1]) ** 2 + (candidate[2] - point[2]) ** 2;
    if (distance < bestDistance) { best = candidate; bestDistance = distance; }
  }
  return best;
}

/** Two-sided Möller–Trumbore with a very small mesh-boundary correction.
 * Any corrected point is projected onto this triangle's boundary, never left
 * outside the selected surface. */
function intersectTriangle(start: Vec3, direction: Vec3, a: Vec3, b: Vec3, c: Vec3, tolerance: number): MeshHit | null {
  const edge1: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const edge2: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p: Vec3 = [direction[1] * edge2[2] - direction[2] * edge2[1],
    direction[2] * edge2[0] - direction[0] * edge2[2], direction[0] * edge2[1] - direction[1] * edge2[0]];
  const determinant = edge1[0] * p[0] + edge1[1] * p[1] + edge1[2] * p[2];
  const edge1Length = Math.hypot(...edge1), edge2Length = Math.hypot(...edge2), directionLength = Math.hypot(...direction);
  if (Math.abs(determinant) <= PARALLEL_RELATIVE_EPSILON * edge1Length * edge2Length * directionLength) return null;
  const inverse = 1 / determinant;
  const tvec: Vec3 = [start[0] - a[0], start[1] - a[1], start[2] - a[2]];
  const u = (tvec[0] * p[0] + tvec[1] * p[1] + tvec[2] * p[2]) * inverse;
  const q: Vec3 = [tvec[1] * edge1[2] - tvec[2] * edge1[1],
    tvec[2] * edge1[0] - tvec[0] * edge1[2], tvec[0] * edge1[1] - tvec[1] * edge1[0]];
  const v = (direction[0] * q[0] + direction[1] * q[1] + direction[2] * q[2]) * inverse;
  const distance = (edge2[0] * q[0] + edge2[1] * q[1] + edge2[2] * q[2]) * inverse;
  if (distance < 0 || distance > 1) return null;
  const point: Vec3 = [start[0] + direction[0] * distance, start[1] + direction[1] * distance, start[2] + direction[2] * distance];
  if (u >= 0 && v >= 0 && u + v <= 1) return {distance, point};

  const boundary = closestPointOnTriangleBoundary(point, a, b, c);
  const separation = Math.hypot(point[0] - boundary[0], point[1] - boundary[1], point[2] - boundary[2]);
  return separation <= tolerance ? {distance, point: boundary} : null;
}

function nearestHit(node: BvhNode, start: Vec3, direction: Vec3, mesh: MeshIndex, tolerance: number, best: MeshHit | null): MeshHit | null {
  if (intersectSegmentBounds(start, direction, node, best?.distance ?? 1, tolerance) === null) return best;
  if (node.triangles) {
    for (const triangle of node.triangles) {
      const offset = triangle * 3;
      const a = vertex(mesh.positions, mesh.indices[offset]!);
      const b = vertex(mesh.positions, mesh.indices[offset + 1]!);
      const c = vertex(mesh.positions, mesh.indices[offset + 2]!);
      const hit = intersectTriangle(start, direction, a, b, c, tolerance);
      if (hit && (!best || hit.distance < best.distance)) best = hit;
    }
    return best;
  }

  const upperLimit = best?.distance ?? 1;
  const leftEntry = node.left ? intersectSegmentBounds(start, direction, node.left, upperLimit, tolerance) : null;
  const rightEntry = node.right ? intersectSegmentBounds(start, direction, node.right, upperLimit, tolerance) : null;
  if (leftEntry !== null && rightEntry !== null) {
    if (leftEntry <= rightEntry) {
      best = nearestHit(node.left!, start, direction, mesh, tolerance, best);
      best = nearestHit(node.right!, start, direction, mesh, tolerance, best);
    } else {
      best = nearestHit(node.right!, start, direction, mesh, tolerance, best);
      best = nearestHit(node.left!, start, direction, mesh, tolerance, best);
    }
  } else if (leftEntry !== null) best = nearestHit(node.left!, start, direction, mesh, tolerance, best);
  else if (rightEntry !== null) best = nearestHit(node.right!, start, direction, mesh, tolerance, best);
  return best;
}

/** Intersect a finite segment with one immutable local-metre mesh. This is the
 * shared BVH primitive used by both the root-normalized MapLibre adapter and
 * the root-free Deck adapter. */
export function intersectAtlasMetricMeshSegment(query:{object:AtlasMetricMeshObject;segment:AtlasMetricSegment;toleranceMeters?:number}):AtlasMetricMeshHit|null {
  const {object,segment}=query,tolerance=query.toleranceMeters??1e-8;
  if(!object||!Number.isFinite(tolerance)||tolerance<0||segment.length!==2||segment.some(point=>point.length!==3||!point.every(Number.isFinite)))
    throw new Error('Invalid Atlas metric mesh ray query');
  const start:[number,number,number]=[...segment[0]],end:[number,number,number]=[...segment[1]];
  const direction:Vec3=[end[0]-start[0],end[1]-start[1],end[2]-start[2]];
  if(!direction.every(Number.isFinite))throw new Error('Atlas mesh ray segment overflows');
  if(direction.every(value=>value===0))return null;
  const mesh=getIndex(object),hit=nearestHit(mesh.root,start,direction,mesh,tolerance,null);
  if(!hit)return null;
  return hit.point.every(Number.isFinite)?{point:hit.point,segmentFraction:hit.distance}:null;
}

import type {AtlasTerrainTileModel} from './atlas-terrain-tile-model';
import type {AtlasTerrainFieldGeometry} from './atlas-terrain-field-presentation';
import {atlasTerrainFieldSample} from './atlas-terrain-tile-model';
import {terrainGridCoordinate,terrainGridLayout} from './terrain-grid-layout';
import type {TerrainPreparedDraw} from './atlas-terrain-prepared-contract';
import {terrainEvaluateVertex,TERRAIN_PREPARED_LAYOUT} from './atlas-terrain-prepared-field';

export interface AtlasTerrainFieldRayHit extends AtlasMetricMeshHit {model:AtlasTerrainTileModel}
export interface AtlasTerrainFieldRayIndex {intersect(segment:AtlasMetricSegment,alpha:number):AtlasTerrainFieldRayHit|null}

export interface AtlasTerrainPreparedRayGeometry {
  readonly basis:Float32Array;readonly draft:Float32Array|null;readonly indices:Uint32Array;
  readonly draws:readonly TerrainPreparedDraw[];readonly rayNodes:Uint32Array;readonly rayTriangles:Uint32Array;
}
export interface AtlasTerrainPreparedRayHit extends AtlasMetricMeshHit {readonly sourceIndex:number;readonly sourceBank:'old'|'new'}
type ClearanceInterval=readonly [number,number];
type ClearanceVertex=readonly ClearanceInterval[];
const clearanceBits=new DataView(new ArrayBuffer(8));
function clearanceOut(value:number,up:boolean){
  if(!Number.isFinite(value))throw Error('Terrain-Nahprüfung nicht endlich.');
  if(value===0)return up?Number.MIN_VALUE:-Number.MIN_VALUE;
  clearanceBits.setFloat64(0,value);let bits=clearanceBits.getBigUint64(0);
  bits+=(value>0)===up?1n:-1n;clearanceBits.setBigUint64(0,bits);return clearanceBits.getFloat64(0);
}
const clearanceSub=(a:ClearanceInterval,b:ClearanceInterval):ClearanceInterval=>[clearanceOut(a[0]-b[1],false),clearanceOut(a[1]-b[0],true)];
function clearanceLerp(a:ClearanceInterval,b:ClearanceInterval,t:ClearanceInterval):ClearanceInterval{
  const d=clearanceSub(b,a),v=[d[0]*t[0],d[0]*t[1],d[1]*t[0],d[1]*t[1]];
  return[clearanceOut(a[0]+clearanceOut(Math.min(...v),false),false),clearanceOut(a[1]+clearanceOut(Math.max(...v),true),true)];
}
/** Outward interval clipping keeps uncertain boundary vertices. It can only
 * enlarge the height hull; a narrow/degenerate edge never creates a hole. */
function clearanceClipMaximum(points:ClearanceVertex[],box:readonly number[]){
  const fullMaximum=Math.max(...points.map(p=>p[2]![1]));let scratch:ClearanceVertex[]=[];
  for(const [axis,bound,lower] of [[0,box[0]!,true],[1,box[1]!,true],[0,box[2]!,false],[1,box[3]!,false]] as const){
    const output=scratch;output.length=0;
    for(let i=0;i<points.length;i++){
      const a=points[i]!,b=points[(i+1)%points.length]!,inside=(p:ClearanceVertex)=>lower?p[axis]![1]>=bound:p[axis]![0]<=bound,ai=inside(a),bi=inside(b);
      if(ai!==bi){
        const numerator=clearanceSub([bound,bound],a[axis]!),denominator=clearanceSub(b[axis]!,a[axis]!);let t:ClearanceInterval=[0,1];
        if(denominator[0]>0||denominator[1]<0){const v=[numerator[0]/denominator[0],numerator[0]/denominator[1],numerator[1]/denominator[0],numerator[1]/denominator[1]];t=[Math.max(0,clearanceOut(Math.min(...v),false)),Math.min(1,clearanceOut(Math.max(...v),true))];}
        if(t[0]<=t[1])output.push(a.map((v,k)=>k===axis?[bound,bound]:clearanceLerp(v,b[k]!,t)));
      }
      if(bi)output.push(b);
      // Ordinary convex triangle/rectangle clipping has at most seven points.
      // If interval ambiguity enlarges that topology, use the original face's
      // height hull instead of growing scratch state or dropping a boundary.
      if(output.length>7)return fullMaximum;
    }
    scratch=points;points=output;if(!points.length)break;
  }
  return points.length?Math.max(...points.map(p=>p[2]![1])):null;
}
/** C's XY-only BVH is used without resampling any source raster. Heights are
 * reconstructed at the exact K2 triangle vertices with B's screen arithmetic. */
export function createAtlasTerrainPreparedRayIndex(geometry:AtlasTerrainPreparedRayGeometry){
  const {basis,draft,indices,draws,rayNodes,rayTriangles}=geometry;
  if(basis.length%TERRAIN_PREPARED_LAYOUT.basisFloats||draft&&draft.length/6!==basis.length/14||
    indices.length%3||rayNodes.length%8)throw Error('Terrain-Pickgeometrie ungültig.');
  const bounds=new Float32Array(rayNodes.buffer,rayNodes.byteOffset,rayNodes.length),nodeCount=rayNodes.length/8;
  const xyEntry=(node:number,start:Vec3,direction:Vec3,limit:number):number|null=>{
    const at=node*8;let enter=0,exit=limit;
    for(let axis=0;axis<2;axis++){
      const low=bounds[at+axis]!,high=bounds[at+axis+2]!,delta=direction[axis]!,value=start[axis]!;
      if(delta===0){if(value<low||value>high)return null;continue;}
      const a=(low-value)/delta,b=(high-value)/delta;
      enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
      if(enter>exit)return null;
    }return enter;
  };
  return{heightEnvelope(box:readonly [number,number,number,number],alpha:number,origin:{x:number;y:number;z:number},exaggeration:number,retireOldOnly=false){
    if(![...box,alpha,origin.x,origin.y,origin.z,exaggeration].every(Number.isFinite)||Math.fround(alpha)!==alpha||alpha<0||alpha>1||exaggeration<=0)throw Error('Terrain-Nahprüfung ungültig.');
    let maximum:number|null=null,visits=0,triangles=0;
    const e=Math.fround(exaggeration);
    for(const draw of draws){
      if(retireOldOnly&&draw.newSlot<0)continue;
      const offset=[Math.fround(draw.origin[0]-origin.x),Math.fround(draw.origin[1]-origin.y)],root=draw.rayRoot;
      if(root>=nodeCount)throw Error('Terrain-Nahindex außerhalb.');
      // The BVH stores basis-local XY. Account for the actual uploaded offset
      // and the final binary32 addition before rejecting a whole node.
      const rootAt=root*8,pad=[0,1].map(axis=>2**-24*(Math.abs(offset[axis]!)+Math.max(Math.abs(bounds[rootAt+axis]!),Math.abs(bounds[rootAt+axis+2]!)))+2**-149);
      const local=[box[0]-offset[0]!-pad[0]!,box[1]-offset[1]!-pad[1]!,box[2]-offset[0]!+pad[0]!,box[3]-offset[1]!+pad[1]!];
      const stack=[root],seen=new Set<number>();
      while(stack.length){
        const node=stack.pop()!;if(node>=nodeCount)throw Error('Terrain-Nahindex außerhalb.');if(seen.has(node))continue;seen.add(node);visits++;
        const at=node*8;if(bounds[at]!>local[2]!||bounds[at+2]!<local[0]!||bounds[at+1]!>local[3]!||bounds[at+3]!<local[1]!)continue;
        const count=rayNodes[at+7]!;if(!count){stack.push(rayNodes[at+4]!,rayNodes[at+5]!);continue;}
        if(count>8||rayNodes[at+6]!+count>rayTriangles.length)throw Error('Terrain-Nahblatt ungültig.');
        for(let i=0;i<count;i++){
          const triangle=rayTriangles[rayNodes[at+6]!+i]!;if(triangle<draw.firstIndex/3||triangle>=(draw.firstIndex+draw.indexCount)/3)throw Error('Terrain-Nahdreieck gehört nicht zum Draw.');triangles++;
          const points:ClearanceVertex[]=[0,1,2].map(corner=>{
            const vertex=indices[triangle*3+corner]!,at=vertex*14,h=terrainEvaluateVertex(basis,draft,vertex,alpha,origin.z).height;
            const relative=h-origin.z,undoError=Number.EPSILON*(Math.abs(h)+Math.abs(origin.z))+Number.MIN_VALUE;
            const x=Math.fround(offset[0]!+basis[at]!),y=Math.fround(offset[1]!+basis[at+1]!);
            const lo=Math.fround(Math.fround(relative-undoError)*e),hi=Math.fround(Math.fround(relative+undoError)*e);
            return[[x,x],[y,y],[clearanceOut(lo,false),clearanceOut(hi,true)]];
          });
          const height=clearanceClipMaximum(points,box);if(height!==null)maximum=Math.max(maximum??-Infinity,height);
        }
      }
    }
    return{maximum,visits,triangles};
  },intersect(segment:AtlasMetricSegment,alpha:number,verticalOrigin:number):AtlasTerrainPreparedRayHit|null{
    if(!Number.isFinite(verticalOrigin)||!Number.isFinite(alpha)||alpha<0||alpha>1||Math.fround(alpha)!==alpha||
      segment.length!==2||segment.some(point=>point.length!==3||!point.every(Number.isFinite)))throw Error('Terrain-Pickstrahl ungültig.');
    let best:(AtlasTerrainPreparedRayHit&{distance:number})|null=null;
    for(const draw of draws){
      if(alpha===1&&draw.newSlot<0)continue; // The confirmed endframe retires old-only screen partitions.
      if(draw.rayRoot>=nodeCount)throw Error('Terrain-Pickindex ungültig.');
      const origin=draw.origin,start:Vec3=[segment[0][0]-origin[0],segment[0][1]-origin[1],segment[0][2]],
        direction:Vec3=[segment[1][0]-segment[0][0],segment[1][1]-segment[0][1],segment[1][2]-segment[0][2]];
      const stack=[draw.rayRoot],visited=new Set<number>();
      while(stack.length){const node=stack.pop()!;
        if(node>=nodeCount)throw Error('Terrain-Pickindex außerhalb.');
        if(visited.has(node))continue;
        visited.add(node);
        if(xyEntry(node,start,direction,best?.distance??1)===null)continue;
        const at=node*8,count=rayNodes[at+7]!;
        if(count===0){stack.push(rayNodes[at+4]!,rayNodes[at+5]!);continue;}
        if(count>8||rayNodes[at+6]!+count>rayTriangles.length)throw Error('Terrain-Pickblatt ungültig.');
        for(let i=0;i<count;i++){
          const triangle=rayTriangles[rayNodes[at+6]!+i]!;
          if(triangle<draw.firstIndex/3||triangle>=(draw.firstIndex+draw.indexCount)/3)throw Error('Terrain-Pickdreieck gehört nicht zum Draw.');
          const point=(corner:number):Vec3=>{
            const vertex=indices[triangle*3+corner]!,offset=vertex*14;
            const value=terrainEvaluateVertex(basis,draft,vertex,alpha,verticalOrigin);
            return[basis[offset]!,basis[offset+1]!,value.height];
          };
          const hit=intersectTriangle(start,direction,point(0),point(1),point(2),1e-8);
          if(hit&&(!best||hit.distance<best.distance)){
            const sourceBank=draw.newSlot>=0?'new':'old',sourceIndex=sourceBank==='new'?draw.newSlot:draw.oldSlot;
            best={point:[hit.point[0]+origin[0],hit.point[1]+origin[1],hit.point[2]],segmentFraction:hit.distance,distance:hit.distance,sourceBank,sourceIndex};
          }
        }
      }
    }
    return best&&{point:best.point,segmentFraction:best.segmentFraction,sourceBank:best.sourceBank,sourceIndex:best.sourceIndex};
  }};
}

/** Immutable owner-region index for one published field. A query walks the
 * already prepared old/new lattice breakpoints; input never derives a mesh. */
export function createAtlasTerrainFieldRayIndex(geometry:AtlasTerrainFieldGeometry,oldModels:readonly AtlasTerrainTileModel[],newModels:readonly AtlasTerrainTileModel[],draftModels:readonly AtlasTerrainTileModel[]=[]):AtlasTerrainFieldRayIndex{
  const regions=geometry.draws.map(draw=>{const old=draw.oldSlot<0?undefined:oldModels[draw.oldSlot],next=draw.newSlot<0?undefined:newModels[draw.newSlot];return{draw,old,next,layouts:[old&&terrainGridLayout(old.grid.view),next&&terrainGridLayout(next.grid.view)]};});
  const sample=atlasTerrainFieldSample;
  return{intersect(segment,alpha){if(!Number.isFinite(alpha)||alpha<0||alpha>1)throw Error('Terrainfeld-Ray-Alpha ungültig.');const a=segment[0],d=segment[1].map((v,i)=>v-a[i]!),at=(t:number)=>({x:a[0]+d[0]!*t,y:a[1]+d[1]!*t});let best:AtlasTerrainFieldRayHit|null=null;
    for(const region of regions){const b=region.draw.bounds;let enter=0,exit=best?.segmentFraction??1;for(const [axis,min,max]of [[0,b.x,b.x+b.width],[1,b.y,b.y+b.height]] as const){if(d[axis]===0){if(a[axis]<min||a[axis]>max){enter=1;exit=0;break;}continue;}const t=(min-a[axis])/d[axis]!,u=(max-a[axis])/d[axis]!;enter=Math.max(enter,Math.min(t,u));exit=Math.min(exit,Math.max(t,u));}if(exit<enter)continue;
      const crossings=[enter,exit];for(const layout of region.layouts)if(layout)for(const [axis,values]of [[0,layout.x.values],[1,layout.y.values]] as const)if(d[axis])for(const value of values){const t=(value-a[axis])/d[axis]!;if(t>enter&&t<exit)crossings.push(t);}crossings.sort((x,y)=>x-y);
      const height=(t:number)=>{const p=at(t),old=region.old,next=region.next;let value=next?(!old||alpha>=1?sample(newModels,region.draw.newSlot,p):alpha<=0?sample(oldModels,region.draw.oldSlot,p):sample(oldModels,region.draw.oldSlot,p)*(1-alpha)+sample(newModels,region.draw.newSlot,p)*alpha):sample(oldModels,region.draw.oldSlot,p),draft=next&&draftModels[region.draw.newSlot];if(draft)value+=sample(draftModels,region.draw.newSlot,p)-sample(newModels,region.draw.newSlot,p);return value;};
      const intervals:number[]=[...crossings];for(let i=1;i<crossings.length;i++){const start=crossings[i-1]!,end=crossings[i]!,middle=at((start+end)/2);for(const [model,layout]of [[region.old,region.layouts[0]],[region.next,region.layouts[1]]] as const)if(model&&layout){const x=Math.min(model.grid.view.columns-2,Math.floor(terrainGridCoordinate(layout.x,middle.x))),y=Math.min(model.grid.view.rows-2,Math.floor(terrainGridCoordinate(layout.y,middle.y))),sx=layout.x.values[x+1]!-layout.x.values[x]!,sy=layout.y.values[y+1]!-layout.y.values[y]!,slope=d[0]!/sx+d[1]!/sy,t=slope?(1-(a[0]-layout.x.values[x]!)/sx-(a[1]-layout.y.values[y]!)/sy)/slope:Infinity;if(t>start&&t<end)intervals.push(t);}}intervals.sort((x,y)=>x-y);
      for(let i=1;i<intervals.length;i++){const start=intervals[i-1]!,end=intervals[i]!,f=a[2]+d[2]!*start-height(start),g=a[2]+d[2]!*end-height(end);if(f*g>0||f===g)continue;const t=Math.abs(f)<1e-8?start:start+(end-start)*f/(f-g);if(t<start||t>end)continue;const p=at(t),h=height(t),model=(region.next??region.old)!;best={point:[p.x,p.y,h],segmentFraction:t,model};break;}
    }return best;}};
}
