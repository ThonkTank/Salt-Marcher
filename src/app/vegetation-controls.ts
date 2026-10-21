import {vegetationPresets,type VegetationSpec,type VegetationInstance,type VegetationOverride} from './vegetation';
import type {LandscapeRecord} from './atlas-landscape';

// Keep invalid/empty visible edits in the draft. The shared canonical validator
// must reject them instead of silently saving the last valid value.
const numberValue=(input:HTMLInputElement)=>input.value.trim()===''?NaN:Number(input.value);

export function vegetationControls(root:HTMLElement,prefix:string,spec:VegetationSpec,change:()=>void) {
  const label=document.createElement('label');label.textContent='Landschaftsvorlage';
  const select=document.createElement('select');select.id=prefix+'-preset';
  for(const p of vegetationPresets)select.add(new Option(p.name,p.id));
  select.value=spec.preset.id;label.append(select);root.append(label);
  const fields=document.createElement('div');root.append(fields);
  const fill=()=>{
    fields.replaceChildren();
    const species=document.createElement('label');species.textContent='Baumart';
    const tree=document.createElement('select');tree.id=prefix+'-tree';tree.add(new Option('Laubbaum','oak'));tree.add(new Option('Nadelbaum','pine'));tree.value=spec.preset.tree;
    tree.onchange=()=>{spec.preset.tree=tree.value as 'oak'|'pine';change();};species.append(tree);fields.append(species);
    for(const [key,title,min,max] of [
      ['density','Baumdichte',0,1],['size','Baumhöhe in m',1,60],
      ['undergrowth','Unterwuchs',0,1],['rocks','Steinanteil',0,1],
      ['grouping','Gruppierung / Lichtungen',0,1],['edge','Waldrand in m',0,500],
      ['slope','Maximale Hangneigung in °',0,85],
    ] as const){
      const l=document.createElement('label');l.textContent=title;
      const input=document.createElement('input');input.type='number';input.id=prefix+'-'+key;
      input.min=String(min);input.max=String(max);input.step='any';input.required=true;input.value=String(spec.preset[key]);
      input.oninput=()=>{spec.preset[key]=numberValue(input);change();};
      l.append(input);fields.append(l);
    }
  };
  select.onchange=()=>{spec.preset=structuredClone(vegetationPresets.find(p=>p.id===select.value)!);fill();change();};
  fill();
}
export function vegetationInspector(root:HTMLElement,r:LandscapeRecord,instance:VegetationInstance|undefined,
  changed:()=>void,save:()=>void,remove:()=>void,link?:(instance:VegetationOverride)=>void) {
  const spec=r.vegetation!;
  const name=document.createElement('label');name.textContent='Name der Landschaft';
  const input=document.createElement('input');input.id='vegetation-name';input.value=r.name;
  input.oninput=()=>{r.name=input.value;changed();};name.append(input);root.append(name);
  vegetationControls(root,'vegetation-edit',spec,()=>{r.values.terrain=spec.preset.terrain;changed();});
  const note=document.createElement('p');note.textContent='Vorlage, Boden und Geländeart werden gemeinsam gespeichert. Einzelkorrekturen bleiben geschützt.';root.append(note);
  const button=(text:string,fn:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;root.append(b);};
  if(instance){
    const title=document.createElement('h4');title.textContent='Einzelobjekt bearbeiten';root.append(title);
    const draft:VegetationOverride={id:instance.id,x:instance.x,y:instance.y,asset:instance.asset,size:instance.size,angle:instance.angle,...(instance.locationId?{locationId:instance.locationId}:{})};
    const apply=()=>{spec.overrides=spec.overrides.filter(x=>x.id!==draft.id);spec.overrides.push({...draft});changed();};
    const assets=document.createElement('select');assets.id='vegetation-object-asset';
    for(const [id,label]of [['oak','Laubbaum'],['pine','Nadelbaum'],['shrub','Strauch'],['grass','Grasbüschel'],['rock','Felsen']])assets.add(new Option(label!,id));
    assets.value=draft.asset;assets.onchange=()=>{draft.asset=assets.value as VegetationOverride['asset'];apply();};root.append(assets);
    for(const [key,label]of [['x','X in m'],['y','Y in m'],['size','Größe in m'],['angle','Drehung in Grad']] as const){
      const l=document.createElement('label');l.textContent=label;const n=document.createElement('input');n.type='number';n.step='any';n.id='vegetation-object-'+key;
      n.required=true;n.value=String(key==='angle'?draft.angle*180/Math.PI:draft[key]);n.oninput=()=>{draft[key]=numberValue(n)*(key==='angle'?Math.PI/180:1);apply();};l.append(n);root.append(l);
    }
    if(instance.conflict){const warning=document.createElement('p');warning.textContent='Dieses geschützte Objekt steht in Wasser, Bebauung oder ungeeignetem Gelände. Es bleibt erhalten; seine Lage kann hier korrigiert werden.';root.append(warning);}
    button('Einzelobjekt entfernen',()=>{draft.removed=true;apply();save();});
    button('Einzelkorrektur zurücksetzen',()=>{spec.overrides=spec.overrides.filter(o=>o.id!==draft.id);changed();save();});
    if(link)button('Als besonderen Ort anlegen',()=>{apply();link(draft);});
  }
  button('Landschaftsänderung speichern',save);
  button('Landschaftsfläche entfernen',remove);
}
