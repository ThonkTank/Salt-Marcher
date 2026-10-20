import * as THREE from 'three';
import type {TerrainObject} from './terrain-objects';

/** Room-derived footprints retain disconnected components and courtyard holes.
 * Floors are horizontal; only the foundation's lower edge follows the ground. */
export function terrainObjectMeshes(object:TerrainObject,origin:{x:number;y:number;z:number},exaggeration:number){
  const meshes:THREE.Mesh[]=[];
  if(object.closed===false)return meshes;
  const add=(vertices:number[],color:string)=>{
    if(!vertices.length)return;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
    const normal=geometry.getAttribute('normal'),base=new THREE.Color(color),colors:number[]=[];
    for(let i=0;i<normal.count;i++){
      const shade=.68+.32*Math.abs(normal.getX(i)*.5+normal.getY(i)*.4+normal.getZ(i)*.76);
      colors.push(base.r*shade,base.g*shade,base.b*shade);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
    mesh.userData.terrainObject={atlasObject:'true',id:object.id,kind:object.kind,cityId:object.cityId,roomId:object.roomId};meshes.push(mesh);
  };
  for(const [part,polygon]of (object.footprint??[{outer:object.outline,holes:[]}]).entries()){
    const rings=[polygon.outer,...polygon.holes];if(polygon.outer.length<3)continue;
    const at=(ring:number,i:number,z:number)=>{const p=rings[ring]![i]!;return[p.x-origin.x,origin.y-p.y,(z-origin.z)*exaggeration];};
    const walls:number[]=[],foundation:number[]=[],roof:number[]=[];
    const quad=(out:number[],a:number[],b:number[],c:number[],d:number[])=>out.push(...a,...b,...c,...c,...b,...d);
    for(const [r,ring]of rings.entries())for(let i=0;i<ring.length;i++){
      const j=(i+1)%ring.length,a=at(r,i,object.baseM),b=at(r,j,object.baseM);
      quad(walls,a,b,at(r,i,object.topM),at(r,j,object.topM));
      const ground=object.footprintGroundM?.[part]?.[r]??object.groundM;
      quad(foundation,at(r,i,Math.min(object.baseM,ground[i]??object.baseM)),at(r,j,Math.min(object.baseM,ground[j]??object.baseM)),a,b);
    }
    const shape=rings.map(r=>r.map(p=>new THREE.Vector2(p.x-origin.x,origin.y-p.y))),outer=shape[0]!;
    let sign=0,convex=rings.length===1;
    for(let i=0;i<outer.length;i++){
      const a=outer[i]!,b=outer[(i+1)%outer.length]!,c=outer[(i+2)%outer.length]!,cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
      if(Math.abs(cross)<1e-8)continue;if(sign&&sign*Math.sign(cross)<0)convex=false;sign=Math.sign(cross);
    }
    if(convex&&object.roofM>0){
      const centre=[outer.reduce((sum,p)=>sum+p.x,0)/outer.length,outer.reduce((sum,p)=>sum+p.y,0)/outer.length,(object.topM+object.roofM-origin.z)*exaggeration];
      for(let i=0;i<outer.length;i++)roof.push(...at(0,i,object.topM),...at(0,(i+1)%outer.length,object.topM),...centre);
    }else{
      const points=shape.flat();
      for(const triangle of THREE.ShapeUtils.triangulateShape(outer,shape.slice(1)))for(const i of triangle){const p=points[i]!;roof.push(p.x,p.y,(object.topM+object.roofM-origin.z)*exaggeration);}
      if(object.roofM>0)for(const [r,ring]of rings.entries())for(let i=0;i<ring.length;i++){
        const j=(i+1)%ring.length;quad(roof,at(r,i,object.topM),at(r,j,object.topM),at(r,i,object.topM+object.roofM),at(r,j,object.topM+object.roofM));
      }
    }
    add(foundation,'#857c67');add(walls,object.kind==='entrance'?'#343432':'#d9c9ac');add(roof,object.color);
  }
  return meshes;
}

/** Reuse unchanged objects across terrain frames; own and dispose only this layer's GPU resources. */
export class TerrainObjectLayer {
  readonly group=new THREE.Group();
  readonly closedIds=new Set<string>();
  readonly heights=new Map<string,number>();
  readonly scopeBases=new Map<string,number>();
  private entries=new Map<string,{key:string;meshes:THREE.Mesh[]}>();
  get meshes(){return [...this.entries.values()].flatMap(e=>e.meshes);}
  update(objects:TerrainObject[],origin:{x:number;y:number;z:number},exaggeration:number){
    const heights=new Map(objects.filter(o=>o.closed!==false).map(o=>[o.id,o.topM+o.roofM])),bases=new Map(objects.filter(o=>o.scopeId).map(o=>[o.scopeId!,o.baseM]));
    let changed=JSON.stringify([...bases])!==JSON.stringify([...this.scopeBases]);
    this.heights.clear();for(const [id,z]of heights)this.heights.set(id,z);
    this.scopeBases.clear();for(const [id,z]of bases)this.scopeBases.set(id,z);
    const ids=new Set(objects.filter(o=>o.closed!==false).map(o=>o.id));
    const remove=(id:string)=>{const entry=this.entries.get(id)!;for(const mesh of entry.meshes){this.group.remove(mesh);mesh.geometry.dispose();for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])m.dispose();}this.entries.delete(id);changed=true;};
    for(const id of this.entries.keys())if(!ids.has(id))remove(id);
    for(const o of objects){
      if(o.closed===false)continue;
      const key=JSON.stringify([o,origin,exaggeration]);if(this.entries.get(o.id)?.key===key)continue;
      if(this.entries.has(o.id))remove(o.id);
      const meshes=terrainObjectMeshes(o,origin,exaggeration);this.group.add(...meshes);this.entries.set(o.id,{key,meshes});changed=true;
    }
    this.closedIds.clear();for(const id of this.entries.keys())this.closedIds.add(id);
    return changed;
  }
  hit(ray:THREE.Raycaster,keys:string[],terrainDistance=Infinity){
    if(!keys.includes('atlasObject'))return null;
    const hit=ray.intersectObjects(this.meshes,false).find(h=>h.distance<=terrainDistance+Math.max(1e-6,terrainDistance*1e-5));
    return hit?{data:hit.object.userData.terrainObject as Record<string,string>}:null;
  }
  dispose(){this.update([],{x:0,y:0,z:0},1);}
}
