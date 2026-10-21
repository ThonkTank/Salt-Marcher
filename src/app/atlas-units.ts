/** Presentation units only. Storage and geometry always retain their native units. */
export type AtlasUnits = 'dnd' | 'metric';
export const FOOT = .3048, MILE = 1609.344;
let units: AtlasUnits = 'dnd';
export const atlasUnits = () => units;
const number = (n:number) => n.toLocaleString('de-DE',{maximumSignificantDigits:3});
export function lengthLabel(meters:number,system=units) {
 const large=system==='dnd'?MILE:1000,small=system==='dnd'?FOOT:1;
 return Math.abs(meters)>=large ? `${number(meters/large)} ${system==='dnd'?(Math.abs(meters/large-1)<1e-10?'Meile':'Meilen'):'km'}` : `${number(meters/small)} ${system==='dnd'?'ft':'m'}`;
}
export function areaLabel(squareMeters:number,system=units) {
 const large=system==='dnd'?MILE*MILE:1e6,small=system==='dnd'?FOOT*FOOT:1;
 return squareMeters>=large?`${number(squareMeters/large)} ${system==='dnd'?'mi²':'km²'}`:`${number(squareMeters/small)} ${system==='dnd'?'ft²':'m²'}`;
}

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type Definition = {meters:number;list?:boolean};
const definitions=new Map<string,Definition>();
const register=(ids:string,meters=1,list=false)=>ids.split(' ').forEach(id=>definitions.set(id,{meters,list}));
register('land-height-target land-x land-y land-record-width land-radius land-width land-calibration-distance atlas-binding-x atlas-binding-y atlas-slice drawing-brush drawing-element-size drawing-light-radius drawing-grid drawing-slice-y drawing-dx drawing-dy drawing-ceiling drawing-floor-elevation drawing-width drawing-height drawing-z-offset drawing-vertical drawing-trigger-radius drawing-sound-range city-draw-width city-size city-reach city-unit-width city-x city-y city-house-width city-house-depth city-new-width city-new-height');
register('city-ground-offset city-wall-height city-roof-height terrain-entrance-offset');
register('room-group-width room-group-depth route-width route-corridor route-cut route-fill route-shoulder route-depth route-clearance');
register('points drawing-element-points city-unit-points path-waypoints',1,true);
register('volume-height volume-slice volume-brush-radius volume-box-x0 volume-box-x1 volume-box-y0 volume-box-y1 volume-box-z0 volume-box-z1 path-from-x path-from-y path-from-z path-to-x path-to-y path-to-z',1.524);
register('path-widths path-heights',1.524,true);
export const atlasUnitFieldIds=()=>[...definitions.keys()];
type Bound={definition:Definition;canonical:string;shown:string;min:string;max:string;step:string};
const fields=new Map<Field,Bound>();
let enabled=false;
function numeric(text:string,factor:number,displayOnly:boolean){const n=Number(text)*factor;if(!Number.isFinite(n))return text;return String(displayOnly?Number(n.toPrecision(12)):n);}
function convert(text:string,factor:number,list=false,displayOnly=false):string {
 if(!text.trim())return text;
 if(list)return text.split(/([,;\s]+)/).map(part=>part.trim()&&!/^[,;\s]+$/.test(part)?numeric(part,factor,displayOnly):part).join('');
 return numeric(text,factor,displayOnly);
}
function factor(d:Definition,system=units){return d.meters/(system==='dnd'?FOOT:1);}
function caption(field:Field){
 const suffix=units==='dnd'?'ft':'m';
 const aria=field.getAttribute('aria-label');
 if(aria&&field.dataset.atlasUnit==='meters')field.setAttribute('aria-label',aria.replace(/\s*\((?:ft|m)\)$/, '')+` (${suffix})`);
 const label=field.closest('label')??field.ownerDocument.querySelector<HTMLLabelElement>(`label[for="${field.id}"]`);if(!label)return;
 for(const node of Array.from(label.childNodes))if(node.nodeType===3&&node.textContent?.trim()){
  const text=node.textContent.replace(/\s*\((?:ft|m)\)\s*$/, '').replace(/\s*(?:in )?(?:5-Fuß-Schritten|Rasterzellen|Metern|Meter|m|ft)(?=\s*(?:\(|$))/g,'').trim();
  node.textContent=text+` (${suffix}) `;break;
 }
 if(field.id==='land-calibration-distance')(field as HTMLInputElement).placeholder=suffix;
}
function display(field:Field,b:Bound){
 b.shown=convert(b.canonical,factor(b.definition),b.definition.list,true);field.value=b.shown;
 if(field.tagName==='INPUT'){
  const input=field as HTMLInputElement;
  for(const key of ['min','max','step'] as const){const value=b[key];if(value&&value!=='any')input[key]=convert(value,factor(b.definition));else input[key]=value;}
 }
 caption(field);
}
function bind(field:Field):Bound|undefined {
 if(!enabled)return undefined;
 const old=fields.get(field);if(old)return old;
 const definition=definitions.get(field.id)??(field.dataset.atlasUnit==='meters'?{meters:1}:undefined);if(!definition)return undefined;
 const input=field as HTMLInputElement,b={definition,canonical:field.value,shown:field.value,min:input.min??'',max:input.max??'',step:input.step||'any'};
 fields.set(field,b);display(field,b);return b;
}
/** Read the original domain unit, including voxel counts for discrete editors. */
export function atlasFieldValue(field:Field):string {
 const b=bind(field);if(!b)return field.value;
 if(field.value!==b.shown){b.canonical=convert(field.value,1/factor(b.definition),b.definition.list);b.shown=field.value;}
 return b.canonical;
}
export function setAtlasFieldValue(field:Field,value:string|number){
 const b=bind(field);if(!b){field.value=String(value);return;}
 b.canonical=String(value);display(field,b);
}
export function setAtlasElevationField(field:Field,metric:boolean){
 if(metric===definitions.has(field.id))return;
 const b=fields.get(field);if(b){atlasFieldValue(field);field.value=b.canonical;fields.delete(field);}
 definitions.delete(field.id);
 if(!metric){const label=field.closest('label');if(label)for(const node of Array.from(label.childNodes))if(node.nodeType===3)node.textContent=node.textContent?.replace(/\s*\((?:ft|m)\)\s*$/, ' ')??'';}
 if(metric){definitions.set(field.id,{meters:1});bind(field);}
}
export function setAtlasUnits(next:AtlasUnits):boolean {
 if(next===units)return true;
 for(const [field,b] of fields){
  if(!field.isConnected){fields.delete(field);continue;}
  const raw=field.value,values=b.definition.list?raw.trim().split(/[,;\s]+/):[raw];
  if((field as HTMLInputElement).validity?.badInput||raw.trim()&&values.some(v=>!Number.isFinite(Number(v)))){
   field.setCustomValidity('Bitte zuerst ein gültiges Maß eingeben.');field.reportValidity();field.focus();field.addEventListener('input',()=>field.setCustomValidity(''),{once:true});return false;
  }
 }
 for(const field of fields.keys())atlasFieldValue(field);
 units=next;
 for(const [field,b] of fields)display(field,b);
 try{localStorage.setItem('atlas-units-v1',units);}catch{/* Optional local preference. */}
 if(typeof document!=='undefined')document.dispatchEvent(new Event('atlas-units-changed'));
 return true;
}
export function initAtlasUnits(doc:Document){
 if(enabled)return;enabled=true;
 try{units=localStorage.getItem('atlas-units-v1')==='metric'?'metric':'dnd';}catch{units='dnd';}
 const scan=(root:ParentNode)=>root.querySelectorAll<Field>('input[id],textarea[id]').forEach(bind);
 scan(doc);
 new (doc.defaultView!.MutationObserver)(records=>{for(const record of records)for(const node of Array.from(record.addedNodes))if(node.nodeType===1){const element=node as Element;if(element.matches('input[id],textarea[id]'))bind(element as Field);scan(element);}}).observe(doc.body,{childList:true,subtree:true});
}

/** Release transient dialogs without retaining their detached inputs. */
export function releaseAtlasUnits(root:HTMLElement){for(const field of fields.keys())if(root.contains(field))fields.delete(field);}
