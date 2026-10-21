/** Display geometry only. Authored positions, size, species and IDs stay in
 * VegetationSpec; both the flat fallback and the spatial crown use this rim. */
export function crownRadius(asset:'oak'|'pine',angle:number){
  return asset==='oak'
    ? .95+.09*Math.cos(angle*5+.4)+.04*Math.sin(angle*3-.7)
    : .82+.18*Math.cos(angle*6);
}

/** A small, stable colour variation belonging to the object, never the camera. */
export function crownTone(id:string){
  let hash=2166136261;for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);
  return .88+(hash>>>0)/4294967295*.22;
}
