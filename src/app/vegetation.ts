import {vegetationRandom,vegetationRepresentative,vegetationStride,vegetationGrid} from './vegetation-lod';
export {vegetationRandom} from './vegetation-lod';
import type {Point, Polygon} from './contracts';
import {contains, segmentDistance, bounds, type LandscapeRecord, type LandscapeBox} from './atlas-landscape';
import type {Terrain} from './world-contracts';
import {TerrainSampler} from './terrain-height';
import {linePoints} from './landscape-line';

export type PlantAsset = 'oak' | 'pine' | 'shrub' | 'grass' | 'rock';
export interface VegetationPreset {
  id:string; name:string; terrain:Terrain; ground:string;
  tree:'oak'|'pine'; density:number; size:number; undergrowth:number;
  rocks:number; grouping:number; edge:number; slope:number;
}
/** Copied into authored areas. Library updates never silently rewrite a campaign. */
export const vegetationPresets:readonly VegetationPreset[] = [
  {id:'deciduous',name:'Laubwald',terrain:'forest',ground:'#89956b',tree:'oak',density:.8,size:14,undergrowth:.45,rocks:.06,grouping:.55,edge:16,slope:42},
  {id:'conifer',name:'Nadelwald',terrain:'forest',ground:'#768c71',tree:'pine',density:.85,size:18,undergrowth:.3,rocks:.12,grouping:.5,edge:12,slope:46},
  {id:'meadow',name:'Wiese',terrain:'plains',ground:'#b3bb7c',tree:'oak',density:0,size:12,undergrowth:.8,rocks:.02,grouping:.35,edge:8,slope:45},
  {id:'scrub',name:'Buschland',terrain:'plains',ground:'#a2a579',tree:'oak',density:.08,size:9,undergrowth:.85,rocks:.15,grouping:.65,edge:10,slope:48},
  {id:'scree',name:'Geröllfeld',terrain:'hills',ground:'#aaa18c',tree:'pine',density:0,size:10,undergrowth:.08,rocks:.9,grouping:.6,edge:6,slope:65},
  {id:'rocky',name:'Felsiger Boden',terrain:'hills',ground:'#a49c87',tree:'oak',density:.03,size:12,undergrowth:.2,rocks:.5,grouping:.5,edge:8,slope:70},
];
export interface VegetationEdit {polygons:Polygon[]; mode:'clear'|'thin'|'dense'}
export interface VegetationInstance extends Point {
  id:string; asset:PlantAsset; size:number; angle:number; z:number;
  normal:Point & {z:number}; protected?:boolean; conflict?:boolean; locationId?:string;
}
export interface VegetationOverride extends Point {
  id:string; asset:PlantAsset; size:number; angle:number;
  removed?:boolean; locationId?:string;
}
export interface VegetationSpec {
  version:1; seed:number; preset:VegetationPreset;
  layout:'natural'|'row'; spacing:number;
  edits:VegetationEdit[]; overrides:VegetationOverride[];
}
export interface VegetationView {
  instances:VegetationInstance[]; mode:'individual'|'canopy'|'surface';
}
export interface VegetationScene {
  revision:number; fence?:string; box:LandscapeBox; records:LandscapeRecord[];
  grid:{columns:number;rows:number;heights:number[];colors:string[]};
  instances:(VegetationInstance & {areaId:string})[];
  buildings:Polygon[];
  texture?:{width:number;height:number;pixels:Uint8Array};
}
export const vegetationSpec=(id='deciduous',seed=1):VegetationSpec=>({
  version:1,seed,preset:structuredClone(vegetationPresets.find(p=>p.id===id)??vegetationPresets[0]!),
  layout:'natural',spacing:12,edits:[],overrides:[],
});
const finite=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const validPoint=(p:Point)=>p&&finite(p.x,-1e12,1e12)&&finite(p.y,-1e12,1e12);
const assets:PlantAsset[]=['oak','pine','shrub','grass','rock'];
export function validateVegetation(r:LandscapeRecord) {
  if(!r.vegetation){if(r.kind==='vegetation')throw Error('Landschaftsvorlage fehlt.');return;}
  const v=r.vegetation,p=v.preset;
  if(r.kind!=='vegetation'||v.version!==1||!Number.isInteger(v.seed)||!finite(v.seed,0,4294967295)||
    !p||!vegetationPresets.some(x=>x.id===p.id&&x.terrain===p.terrain)||r.values.terrain!==p.terrain||
    !/^#[a-fA-F0-9]{6}$/.test(p.ground)||typeof p.name!=='string'||p.name.length>100||
    !['oak','pine'].includes(p.tree)||!['natural','row'].includes(v.layout)||
    !finite(v.spacing,2,1000)||!finite(p.size,1,60)||!finite(p.edge,0,500)||!finite(p.slope,0,85)||
    ![p.density,p.undergrowth,p.rocks,p.grouping].every(x=>finite(x,0,1))||
    !Array.isArray(v.edits)||v.edits.length>1000||!Array.isArray(v.overrides)||v.overrides.length>2000||
    !r.polygons.length||r.polygons.some(p=>p.outer.length<3)||r.points.some(p=>!validPoint(p))||
    v.layout==='row'&&r.points.length<2)
    throw Error('Bewuchsfläche oder Vorlage prüfen.');
  let vertices=0;
  for(const edit of v.edits){
    if(!edit||!['clear','thin','dense'].includes(edit.mode)||!Array.isArray(edit.polygons)||!edit.polygons.length)throw Error('Bestandskorrektur prüfen.');
    for(const p of edit.polygons){
      if(!p||!Array.isArray(p.outer)||p.outer.length<3||!Array.isArray(p.holes)||p.holes.some(h=>!Array.isArray(h)||h.length<3))throw Error('Korrekturfläche prüfen.');
      for(const ring of [p.outer,...p.holes]){vertices+=ring.length;if(ring.some(p=>!validPoint(p)))throw Error('Korrekturpunkte prüfen.');}
    }
  }
  if(vertices>50000)throw Error('Zu viele Korrekturpunkte.');
  const ids=new Set<string>();
  for(const o of v.overrides){
    if(!o||typeof o.id!=='string'||!o.id||o.id.length>150||ids.has(o.id)||!validPoint(o)||
      !assets.includes(o.asset)||!finite(o.size,.2,100)||!finite(o.angle,-Math.PI*100,Math.PI*100)||
      o.removed!==undefined&&typeof o.removed!=='boolean'||o.locationId!==undefined&&(typeof o.locationId!=='string'||!o.locationId))
      throw Error('Einzelkorrektur prüfen.');
    ids.add(o.id);
  }
}
// World-addressed randomness: camera, tile boundaries, density and unrelated edits
// do not enter a candidate's identity or position.
function edgeDistance(p:Point,polygons:Polygon[]) {
  let d=Infinity;
  for(const poly of polygons)for(const ring of [poly.outer,...poly.holes])for(let i=0;i<ring.length;i++)d=Math.min(d,segmentDistance(p,ring[i]!,ring[(i+1)%ring.length]!));
  return d;
}
export interface VegetationEnvironment {
  terrain:TerrainSampler; covers:LandscapeRecord[];
  roads:LandscapeRecord[]; buildings:Polygon[];
}
export function vegetationEnvironment(records:LandscapeRecord[],buildings:Polygon[]=[]):VegetationEnvironment {
  return {terrain:new TerrainSampler(records),covers:records.filter(r=>r.vegetation).sort((a,b)=>b.resolution-a.resolution||(a.order??0)-(b.order??0)),
    roads:records.filter(r=>r.kind==='road'||r.kind==='river'),buildings};
}
export function vegetationOwner(env:VegetationEnvironment,p:Point) {
  let owner:LandscapeRecord|undefined;for(const r of env.covers)if(contains(p,r.polygons))owner=r;return owner;
}
export function vegetationBlocked(env:VegetationEnvironment,p:Point,radius=0) {
  if(env.terrain.water(p))return true;
  for(const r of env.roads){const pts=linePoints(r);if(pts.some((b,i)=>i>0&&segmentDistance(p,pts[i-1]!,b)<=r.width/2+radius+1))return true;}
  return contains(p,env.buildings)||radius>0&&edgeDistance(p,env.buildings)<radius;
}
const inBox=(p:Point,b:LandscapeBox,pad=0)=>p.x>=b.x-pad&&p.y>=b.y-pad&&p.x<=b.x+b.width+pad&&p.y<=b.y+b.height+pad;
export const VEGETATION_SURFACE_MPP=80;
export function generateVegetation(r:LandscapeRecord,environment:VegetationEnvironment|((point:Point,radius:number)=>VegetationEnvironment),box:LandscapeBox,mpp:number):VegetationView {
  const sourceAt=(point:Point,radius:number)=>typeof environment==='function'?environment(point,radius):environment;
  const v=r.vegetation!;
  if(!v)return{instances:[],mode:'surface'};
  const instances:VegetationInstance[]=[],p=v.preset,overrides=new Map(v.overrides.map(o=>[o.id,o]));
  const base=v.spacing;
  const extent=bounds(r),pad=60;
  const clipped={x:Math.max(box.x-pad,extent.x),y:Math.max(box.y-pad,extent.y),
    right:Math.min(box.x+box.width+pad,extent.x+extent.width),bottom:Math.min(box.y+box.height+pad,extent.y+extent.height)};
  const grid=vegetationGrid(base,mpp,clipped),stride=v.layout==='row'?vegetationStride(base,mpp):grid.stride;
  const detail=mpp<=2&&stride===1,mode=mpp>VEGETATION_SURFACE_MPP?'surface':detail?'individual':'canopy';
  const emit=(id:string,at:Point,asset:PlantAsset,size:number,angle:number,chance:number,random:number)=>{
    const env=sourceAt(at,size*.25);
    if(overrides.has(id)||!inBox(at,box,pad)||vegetationOwner(env,at)?.id!==r.id)return;
    const surface=env.terrain.query(at);
    if(surface.water||surface.slopeDegrees>p.slope||vegetationBlocked(env,at,asset==='rock'?size*.25:size*.12))return;
    let density=chance;
    for(const edit of v.edits)if(contains(at,edit.polygons))density=edit.mode==='clear'?0:edit.mode==='thin'?density*.3:Math.min(1,density+ .5);
    if(p.edge)density*=Math.min(1,edgeDistance(at,r.polygons)/p.edge);
    if(random>density)return;
    instances.push({id,...at,asset,size,angle,z:surface.heightM,normal:surface.normal});
  };
  if(mode!=='surface'){
    if(v.layout==='row'){
      let index=0,travel=0,next=0;
      for(let i=1;i<r.points.length;i++){
        const a=r.points[i-1]!,b=r.points[i]!,length=Math.hypot(b.x-a.x,b.y-a.y);
        if(!length)continue;
        // Skip distant portions without iterating a continent's worth of trees.
        const start=Math.max(next,travel),end=travel+length;
        const segmentBox={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};
        const count=Math.max(0,Math.ceil((end-start)/base));
        if(segmentBox.x<=box.x+box.width+pad&&segmentBox.x+segmentBox.width>=box.x-pad&&segmentBox.y<=box.y+box.height+pad&&segmentBox.y+segmentBox.height>=box.y-pad){
          let lo=0,hi=1;
          for(const [origin,delta,min,max] of [[a.x,b.x-a.x,box.x-pad,box.x+box.width+pad],[a.y,b.y-a.y,box.y-pad,box.y+box.height+pad]]){
            if(delta){const u=(min!-origin!)/delta,w=(max!-origin!)/delta;lo=Math.max(lo,Math.min(u,w));hi=Math.min(hi,Math.max(u,w));}
          }
          const first=Math.max(0,Math.ceil((travel+lo*length-start)/base)),last=Math.min(count-1,Math.floor((travel+hi*length-start)/base));
          if((last-first)/stride>20000)throw Error('Baumreihe: näheren Abschnitt wählen.');
          for(let n=first;n<=last;n++){const k=index+n;if(k%stride)continue;const t=(start+n*base-travel)/length;
            emit('row:'+k,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},p.tree,p.size,vegetationRandom(v.seed,k,0,4)*Math.PI*2,p.density,vegetationRandom(v.seed,k,0,5));}
        }
        index+=count;next=start+count*base;travel=end;
      }
    }else{
      const {x0,y0,x1,y1}=grid;
      for(let row=y0;row<=y1;row+=stride)for(let column=x0;column<=x1;column+=stride){
        // Coarser levels retain a nested subset of the same local candidates.
        const {x,y}=vegetationRepresentative(v.seed,column,row,stride);
        const rand=(salt:number)=>vegetationRandom(v.seed,x,y,salt);
        const at={x:(x+.2+rand(1)*.6)*base,y:(y+.2+rand(2)*.6)*base},
          cluster=1-p.grouping+p.grouping*(.2+.8*vegetationRandom(v.seed,Math.floor(x/8),Math.floor(y/8),42));
        emit(`tree:${x}:${y}`,at,p.tree,p.size*(.75+rand(3)*.5),rand(4)*Math.PI*2,p.density*cluster,rand(5));
        if(detail){
          const small={x:(x+.12+rand(6)*.76)*base,y:(y+.12+rand(7)*.76)*base};
          emit(`rock:${x}:${y}`,small,'rock',1+rand(8)*4,rand(9)*Math.PI*2,p.rocks*cluster,rand(10));
          emit(`under:${x}:${y}`,{x:(x+rand(11))*base,y:(y+rand(12))*base},p.id==='meadow'?'grass':'shrub',p.id==='meadow'?.7:1+rand(13)*2,rand(14)*Math.PI*2,p.undergrowth*cluster,rand(15));
        } else if(!p.density&&p.rocks>.2)emit(`rock:${x}:${y}`,{x:(x+.12+rand(6)*.76)*base,y:(y+.12+rand(7)*.76)*base},'rock',1+rand(8)*4,rand(9)*Math.PI*2,p.rocks*cluster,rand(10));
      }
    }
  }
  // Protected objects remain visible even when their original candidate becomes
  // unsuitable. Conflicts are reported; author decisions are never deleted.
  for(const o of overrides.values())if(!o.removed&&inBox(o,box,pad)){
    const env=sourceAt(o,o.size*.15);
    const surface=env.terrain.query(o);
    instances.push({...o,z:surface.heightM,normal:surface.normal,protected:true,
      conflict:vegetationBlocked(env,o,o.size*.15)||surface.slopeDegrees>p.slope});
  }
  return {instances,mode};
}
