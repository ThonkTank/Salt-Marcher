import {randomUUID} from 'node:crypto';
import {bounds, contains, type LandscapeRecord, type LandscapeAction} from '../atlas-landscape';
import {brushFootprint,intersectPolygons,subtractPolygons,unionPolygons,validateColor,colorParts} from '../landscape-brush';
import type {Polygon} from '../contracts';
import {landscapeRegion,putLandscape} from './atlas-landscape';

/** Runs inside the existing Atlas transaction/history, never as a renderer-side read/modify/write. */
export function executeBrush(db:any,cam:string,a:Extract<LandscapeAction,{kind:'landscape-brush'}>){
  const r=structuredClone(a.record);
  if(r.kind!=='patch'||!r.polygons.length||!Number.isFinite(a.radius)||a.radius<=0||!Number.isFinite(a.roughness)||a.roughness<0||a.roughness>2||
    !['land','land-erase','raise','lower','freshwater','freshwater-erase','ground-color','water-color','color-erase'].includes(a.mode))throw Error('Landschaftspinsel prüfen.');
  const points=[...r.points,...r.polygons.flatMap(p=>[...p.outer,...p.holes.flat()])];
  if(points.length>100000||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))||r.polygons.some(p=>p.outer.length<3)||!Number.isSafeInteger(a.seed)||a.seed<0||a.seed>0xffffffff||typeof a.fill!=='boolean'||a.fill!==!!r.paint?.fill)throw Error('Pinselgeometrie prüfen.');
  validateColor(r);
  let box=bounds(r),records:LandscapeRecord[];
  if(a.fill){
    // Filling is explicit, not a camera read. A bounded author set avoids unbounded global allocation.
    if(db.prepare("SELECT count(*) n FROM atlas_landscape WHERE campaign_id=? AND json_extract(payload,'$.kind')='patch'").get(cam).n>10000)throw Error('Zu viele Flächen zum Füllen. Mit dem Farbpinsel abschnittsweise malen.');
    records=landscapeRegion(db,cam);
    const p=r.points[0];if(!p)throw Error('Füllpunkt fehlt.');
    const ordered=records.filter(x=>x.kind==='patch'&&x.values.terrain).sort((x,y)=>y.resolution-x.resolution||(x.order??0)-(y.order??0));
    const selected=ordered.filter(x=>contains(p,x.polygons)).at(-1);
    if(!selected)throw Error('Zum Füllen eine angelegte Land- oder Wasserfläche anklicken.');
    let area:Polygon[]=[];const water=selected.values.terrain==='water';
    for(const x of ordered)area=(x.values.terrain==='water')===water?unionPolygons(area,x.polygons):subtractPolygons(area,x.polygons);
    r.polygons=area.filter(poly=>contains(p,[poly]));
    if(!r.polygons.length)throw Error('Keine zusammenhängende Fläche am Füllpunkt.');
    box=bounds(r);
  }else{
    const pad=a.radius*2;
    records=landscapeRegion(db,cam,{x:box.x-pad,y:box.y-pad,width:box.width+pad*2,height:box.height+pad*2});
  }
  if(a.mode==='color-erase'||a.mode==='freshwater-erase'){
    for(const old of records){
      if(a.mode==='color-erase'?!old.paint:old.surface!=='freshwater')continue;
      if(!intersectPolygons(old.polygons,r.polygons).length)continue;
      const polygons=subtractPolygons(old.polygons,r.polygons);
      if(polygons.length)putLandscape(db,cam,{...old,polygons},old.revision);
      else db.prepare('DELETE FROM atlas_landscape WHERE campaign_id=? AND id=?').run(cam,old.id);
    }
    return;
  }
  if(a.mode==='ground-color'||a.mode==='water-color'){
    if(!r.paint||r.paint.target!==(a.mode==='water-color'?'water':'ground'))throw Error('Farbziel prüfen.');
    colorParts(r);putLandscape(db,cam,r,null);return;
  }
  if(r.paint)throw Error('Landpinsel darf keine Farbmaske enthalten.');
  if(a.mode==='raise'||a.mode==='lower'){
    const pad=a.radius*2,b={x:box.x-pad,y:box.y-pad,width:box.width+pad*2,height:box.height+pad*2};
    const extent:Polygon[]=[{outer:[{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}],holes:[]}];
    let land=extent;
    for(const old of records.filter(x=>x.kind==='patch'&&x.values.terrain).sort((x,y)=>y.resolution-x.resolution||(x.order??0)-(y.order??0))){
      const patch=intersectPolygons(old.polygons,extent);
      land=old.values.terrain==='water'?subtractPolygons(land,patch):unionPolygons(land,patch);
    }
    let edge:Polygon[]=[];
    for(const poly of land)for(const ring of [poly.outer,...poly.holes]){
      if(ring.length>1900)throw Error('Küste zu komplex für diesen Zug. Kleineren Pinsel verwenden.');
      edge=unionPolygons(edge,brushFootprint([...ring,ring[0]!],a.radius*.25,a.roughness,a.seed));
    }
    r.polygons=intersectPolygons(r.polygons,a.mode==='raise'?subtractPolygons(edge,land):intersectPolygons(edge,land));
    if(!r.polygons.length)return;
  }
  const water=['land-erase','lower','freshwater'].includes(a.mode);
  r.surface=a.mode==='freshwater'?'freshwater':water?'sea':'land';
  r.values={terrain:water?'water':r.values.terrain&&r.values.terrain!=='water'?r.values.terrain:'plains'};
  // Fine authored overrides remain authoritative, as with the existing terrain brush.
  putLandscape(db,cam,{...r,id:r.id||randomUUID()},null);
}
