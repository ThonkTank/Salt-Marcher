import {Matrix4,Quaternion,Vector3,Ray,Color} from 'three';
import {SimpleMeshLayer} from '@deck.gl/mesh-layers';
import {COORDINATE_SYSTEM} from '@deck.gl/core';
import {vegetationGeometry} from './vegetation-geometry';
import {vegetationInstances} from './vegetation-projection';
import {vegetationScaleLimit,vegetationOpacity,vegetationCrownScale} from './vegetation-lod';
import {vegetationColors} from './vegetation-view';
import {crownTone} from './vegetation-shape';
import type {LandscapeRecord} from './atlas-landscape';
import type {AtlasMetricFrame} from './atlas-metric-camera';
import type {VegetationInstance} from './vegetation';
import type {Point} from './contracts';
type Instance=VegetationInstance & {areaId:string;limit:number};

/** One unit mesh per species/part; visible plants remain instances, including exact filtered hits. */
export class AtlasDeckVegetation {
  private batches:ReturnType<AtlasDeckVegetation['build']>;
  constructor(records:LandscapeRecord[]){this.batches=this.build(records);}
  private build(records:LandscapeRecord[]){
    const instances:Instance[]=records.flatMap(r=>vegetationInstances(r.vegetationView).map(i=>({...i,areaId:r.id,limit:vegetationScaleLimit(i,r.vegetation)})));
    return (['oak','pine','rock','shrub','grass'] as const).flatMap(asset=>{
      const data=instances.filter(i=>i.asset===asset);if(!data.length)return [];
      return (asset==='oak'||asset==='pine'?['trunk','crown'] as const:['crown'] as const).map(part=>{
        const geometry=vegetationGeometry(asset,part);geometry.scale(1,-1,1);
        const positions=Float32Array.from(geometry.getAttribute('position').array),normals=Float32Array.from(geometry.getAttribute('normal').array),colors=geometry.getAttribute('color');
        const indices=geometry.index?Uint32Array.from(geometry.index.array):Uint32Array.from({length:positions.length/3},(_,i)=>i);
        const mesh={attributes:{POSITION:{size:3,value:positions},NORMAL:{size:3,value:normals},...(colors?{COLOR_0:{size:3,value:Float32Array.from(colors.array)}}:{})},indices:{size:1,value:indices}};geometry.dispose();
        const color=new Color(part==='trunk'?'#766044':vegetationColors[asset]).convertLinearToSRGB();
        return{asset,part,data,mesh,positions,indices,color:[color.r*255,color.g*255,color.b*255]};
      });
    });
  }
  layers(frame:AtlasMetricFrame,prefix:string){return this.batches.map(b=>new SimpleMeshLayer<Instance>({
    id:`atlas-vegetation:${prefix}:${b.asset}:${b.part}`,data:b.data.filter(i=>vegetationOpacity(frame.camera.metersPerPixel,i.limit)>=.001),mesh:b.mesh,coordinateSystem:COORDINATE_SYSTEM.CARTESIAN,
    getPosition:i=>[i.x-frame.origin.x,i.y-frame.origin.y,(i.z-frame.origin.z)*frame.camera.exaggeration],
    getTransformMatrix:i=>this.transform(i,b.part,frame).elements,
    getColor:i=>{const tone=b.part==='crown'&&(i.asset==='oak'||i.asset==='pine')?crownTone(i.id):1;const alpha=255*vegetationOpacity(frame.camera.metersPerPixel,i.limit);return i.conflict?[203,119,71,alpha]:[b.color[0]!*tone,b.color[1]!*tone,b.color[2]!*tone,alpha];},
    material:{ambient:.7,diffuse:.3,shininess:0},pickable:false,
    updateTriggers:{getPosition:[frame.origin.x,frame.origin.y,frame.origin.z,frame.camera.exaggeration],getTransformMatrix:[frame.camera.exaggeration,frame.camera.metersPerPixel],getColor:frame.camera.metersPerPixel},
    parameters:{depthWriteEnabled:true,depthCompare:'less-equal',cullMode:'none'}
  }));}
  private transform(i:Instance,part:string,frame:AtlasMetricFrame){
    const rotation=new Quaternion();if(i.asset==='rock')rotation.setFromUnitVectors(new Vector3(0,0,1),new Vector3(i.normal.x,i.normal.y,i.normal.z));
    rotation.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-i.angle));
    const tree=i.asset==='oak'||i.asset==='pine',crown=part==='crown'&&tree&&!i.protected?vegetationCrownScale(i.size,frame.camera.metersPerPixel,8):1;
    return new Matrix4().makeScale(1,1,frame.camera.exaggeration).multiply(new Matrix4().compose(new Vector3(),rotation,new Vector3(i.size*crown,i.size*crown,i.size)));
  }
  hit(frame:AtlasMetricFrame,pixel:Point,keys:string[],terrainDistance=Infinity){
    if(!keys.some(k=>['landscapeId','vegetationInstance','vegetation-trees','vegetation-rocks','vegetation-undergrowth'].includes(k)))return null;
    const segment=frame.ray(pixel);if(!segment)return null;
    const filter=keys.includes('vegetation-trees')?'trees':keys.includes('vegetation-rocks')?'rocks':keys.includes('vegetation-undergrowth')?'undergrowth':'all';
    let best:{data:Record<string,string>;distance:number}|undefined;
    const a=new Vector3(...segment[0]),direction=new Vector3(...segment[1]).sub(a).normalize(),v0=new Vector3(),v1=new Vector3(),v2=new Vector3(),point=new Vector3();
    for(const b of this.batches)for(const i of b.data){
      const category=i.asset==='oak'||i.asset==='pine'?'trees':i.asset==='rock'?'rocks':'undergrowth';
      if(filter!=='all'&&filter!==category||vegetationOpacity(frame.camera.metersPerPixel,i.limit)<.001)continue;
      // Hit uses physical heights, with the same horizontal overview crown as display.
      const matrix=this.transform(i,b.part,{...frame,camera:{...frame.camera,exaggeration:1}}).setPosition(i.x,i.y,i.z),inverse=matrix.clone().invert();
      const ray=new Ray(a.clone(),direction.clone()).applyMatrix4(inverse);
      if(ray.distanceSqToPoint(new Vector3(0,0,.5))>4)continue;
      for(let t=0;t<b.indices.length;t+=3){v0.fromArray(b.positions,b.indices[t]!*3);v1.fromArray(b.positions,b.indices[t+1]!*3);v2.fromArray(b.positions,b.indices[t+2]!*3);
        if(!ray.intersectTriangle(v0,v1,v2,false,point))continue;
        const distance=point.applyMatrix4(matrix).distanceTo(a);
        if(distance>terrainDistance+.1||best&&distance>=best.distance)continue;
        best={distance,data:{landscapeId:i.areaId,vegetationInstance:i.id,['vegetation-'+category]:i.id}};
      }
    }
    return best?{data:best.data}:null;
  }
  dispose(){this.batches=[];}
}
