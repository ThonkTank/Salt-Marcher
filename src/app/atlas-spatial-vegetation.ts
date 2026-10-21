import {vegetationGeometry,crownInk} from './vegetation-geometry';
import {crownTone} from './vegetation-shape';
import {vegetationInstances} from './vegetation-projection';
import {vegetationDisplay,type VegetationDisplay} from './vegetation-display';
import {vegetationScaleLimit} from './vegetation-lod';
import * as THREE from 'three';
import type {LandscapeRecord} from './atlas-landscape';
import type {VegetationInstance} from './vegetation';
import type {AtlasSpatialSurface} from './atlas-spatial-surface';
import {vegetationColors} from './vegetation-view';

/** Disposable instanced vegetation in the main Atlas scene. No camera or canvas. */
export class AtlasSpatialVegetation {
  readonly group=new THREE.Group();
  private pickers:THREE.InstancedMesh[]=[];
  constructor(records:LandscapeRecord[],surface:AtlasSpatialSurface){
    const allInstances=records.flatMap(r=>vegetationInstances(r.vegetationView).map(i=>({...i,areaId:r.id,limit:vegetationScaleLimit(i,r.vegetation)})));
    for(const asset of ['oak','pine','rock','shrub','grass'] as const){
      const instances=allInstances.filter(i=>i.asset===asset);if(!instances.length)continue;
      for(const part of asset==='oak'||asset==='pine'?['trunk','crown'] as const:['crown'] as const){
        const mesh=new THREE.InstancedMesh(vegetationGeometry(asset,part),new THREE.MeshLambertMaterial({color:part==='trunk'?'#766044':vegetationColors[asset],flatShading:part!=='crown'||!(asset==='oak'||asset==='pine'),vertexColors:part==='crown'&&(asset==='oak'||asset==='pine')}),instances.length);
        const obj=new THREE.Object3D(),color=new THREE.Color(),policies:VegetationDisplay[]=[];
        instances.forEach((i,index)=>{
          obj.position.set(i.x-surface.origin.x,surface.origin.y-i.y,(i.z-surface.focusM)*surface.exaggeration);
          obj.quaternion.identity();
          if(asset==='rock')obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(i.normal.x,-i.normal.y,i.normal.z));
          obj.rotateZ(i.angle);obj.scale.setScalar(i.size);
          policies.push({size:i.size,limit:i.limit,overviewWidth:!i.protected&&part==='crown'&&(asset==='oak'||asset==='pine')?8:0});
          obj.updateMatrix();mesh.setMatrixAt(index,obj.matrix);
          color.set(i.conflict?'#cb7747':'#ffffff');if(!i.conflict&&part==='crown'&&(asset==='oak'||asset==='pine'))color.multiplyScalar(crownTone(i.id));mesh.setColorAt(index,color);
        });
        vegetationDisplay(mesh,policies);if(part==='crown'&&(asset==='oak'||asset==='pine'))crownInk(mesh.material as THREE.MeshLambertMaterial);mesh.instanceMatrix.needsUpdate=true;mesh.userData.instances=instances;mesh.computeBoundingSphere();this.group.add(mesh);this.pickers.push(mesh);
      }
    }

  }
  hit(ray:THREE.Raycaster,keys:string[],terrainDistance?:number){
    const filter=keys.includes('vegetation-trees')?'trees':keys.includes('vegetation-rocks')?'rocks':keys.includes('vegetation-undergrowth')?'undergrowth':'all';
    if(!keys.some(k=>['landscapeId','vegetationInstance','vegetation-trees','vegetation-rocks','vegetation-undergrowth'].includes(k)))return null;
    for(const hit of ray.intersectObjects(this.pickers,false)){
      if(hit.instanceId===undefined||terrainDistance!==undefined&&hit.distance>terrainDistance+.1)continue;
      const i=hit.object.userData.instances[hit.instanceId] as VegetationInstance & {areaId:string};
      if(filter==='trees'&&!['oak','pine'].includes(i.asset)||filter==='rocks'&&i.asset!=='rock'||filter==='undergrowth'&&!['shrub','grass'].includes(i.asset))continue;
      return {data:{landscapeId:i.areaId,vegetationInstance:i.id}};
    }
    return null;
  }
  dispose(){for(const mesh of this.pickers){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}this.pickers=[];this.group.clear();}
}
