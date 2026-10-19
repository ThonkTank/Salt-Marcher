import {lineTypes,lineType,type LineTypeId} from './line-types';
import {newLine,lineParts,type LandscapeLine} from './landscape-line';
import type {BrushMode,LandscapeColor} from './landscape-brush';
import type {LandscapeRecord} from './atlas-landscape';
const field=(root:ParentNode,id:string)=>root.querySelector<HTMLInputElement|HTMLSelectElement>('#'+id)!;
const check=(root:ParentNode,id:string)=>root.querySelector<HTMLInputElement>('#'+id)!;
const setValue=(f:HTMLInputElement|HTMLSelectElement,value:string)=>{if(f.tagName==='SELECT'){for(const o of (f as HTMLSelectElement).options)o.selected=o.value===value;}else f.value=value;};
export function lineControls(root:HTMLElement,prefix:string,value:LandscapeLine,river:boolean,changed:()=>void){
  const isNew=prefix.endsWith('new');
  root.innerHTML=`<strong>${isNew?'Vorgaben für neue Verläufe':'Eigenschaften der Auswahl'}</strong><label>${river?'Gewässertyp':'Straßentyp'}<select id="${prefix}-type">${value.version===1?'<option value="">Bisherige Gestaltung behalten</option>':''}${lineTypes.filter(t=>t.kind===(river?'river':'road')).map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select></label><button type="button" id="${prefix}-type-width">Typbreite übernehmen</button><svg id="${prefix}-preview" viewBox="0 0 200 44" role="img" aria-label="Vorschau des Verlaufstyps" style="width:100%;height:44px;background:#edf0df"></svg><label>Kurve<select id="${prefix}-curve"><option value="smooth">Geschwungen</option><option value="linear">Gerade Teilstücke</option></select></label><label>Rauheit<input id="${prefix}-roughness" type="range" min="0" max="${river?3:1}" step="0.01"></label>`+
    (river?`<label>Mäanderabstand<input id="${prefix}-meander" type="range" min="0" max="1" step="0.01"></label><label><input id="${prefix}-fade" type="checkbox"> Quelle schmal auslaufen lassen</label>`:`<label><input id="${prefix}-over" type="checkbox"> Über Ortssymbolen zeichnen</label>`);
  for(const [id,v] of [['type',value.type??''],['curve',value.curve],['roughness',value.roughness],['meander',value.meander]] as const){const f=field(root,prefix+'-'+id);if(f)setValue(f,String(v));}
  const fade=check(root,prefix+'-fade'),over=check(root,prefix+'-over');if(fade)fade.checked=value.fadeIn;if(over)over.checked=value.overSymbols;
  const widthId=prefix==='land-new'?'land-width':prefix==='land-edit'?'land-record-width':prefix==='city-new'?'city-draw-width':'city-unit-width';
  const applyWidth=()=>{const t=lineType(field(root,prefix+'-type').value),w=document.getElementById(widthId) as HTMLInputElement|null;if(t&&w){w.value=String(t.width);w.dispatchEvent(new Event('input',{bubbles:true}));changed();}};
  root.querySelector<HTMLButtonElement>('#'+prefix+'-type-width')!.onclick=applyWidth;
  const preview=()=>{
    const svg=root.querySelector('#'+prefix+'-preview')!;svg.replaceChildren();const line=readLineControls(root,prefix,value),record={kind:river?'river':'road',width:8,points:[{x:12,y:30},{x:85,y:15},{x:185,y:28}],line} as LandscapeRecord;
    for(const part of lineParts(record)){
      const n=document.createElementNS('http://www.w3.org/2000/svg',part.polygons?'polygon':'polyline');
      n.setAttribute('points',(part.polygons?.[0]?.outer??part.points).map(p=>p.x+','+p.y).join(' '));n.setAttribute('fill',part.polygons?part.color:'none');n.setAttribute('stroke',part.color);n.setAttribute('stroke-width',String(part.width));if(part.dash)n.setAttribute('stroke-dasharray',part.dash.join(' '));if(part.dashOffset)n.setAttribute('stroke-dashoffset',String(part.dashOffset));n.setAttribute('stroke-linecap','round');n.setAttribute('stroke-linejoin','round');n.setAttribute('opacity',String(part.opacity));svg.append(n);
    }
    root.querySelector<HTMLButtonElement>('#'+prefix+'-type-width')!.disabled=!lineType(line.type);
  };
  root.oninput=()=>{preview();changed();};root.onchange=e=>{if((e.target as HTMLElement)?.id===prefix+'-type'&&isNew){applyWidth();const t=field(root,prefix+'-type').value as LineTypeId,defaults=newLine(river?'river':'road',value.seed,t);for(const key of ['curve','roughness','meander'] as const){const f=field(root,prefix+'-'+key);if(f)setValue(f,String(defaults[key]));}if(fade)fade.checked=defaults.fadeIn;}preview();changed();};preview();
}
export function readLineControls(root:ParentNode,prefix:string,base:LandscapeLine):LandscapeLine{
  const type=field(root,prefix+'-type')?.value;
  const result:LandscapeLine=type?{...base,version:2,type:type as LineTypeId,catalogVersion:1}:{...base};
  if(type){delete result.color;delete result.style;}
  const curve=field(root,prefix+'-curve');if(curve)result.curve=curve.value as LandscapeLine['curve'];
  for(const key of ['roughness','meander'] as const){const f=field(root,prefix+'-'+key);if(f)result[key]=Number(f.value);}
  const fade=check(root,prefix+'-fade'),over=check(root,prefix+'-over');if(fade)result.fadeIn=fade.checked;if(over)result.overSymbols=over.checked;return result;
}
export class LandscapeToolSettings{
  readonly lineRoot=document.createElement('div');readonly brushRoot=document.createElement('div');
  private last='';private lines={road:newLine('road'),river:newLine('river')};
  eyedropper=false;
  constructor(panel:HTMLElement,private changed:()=>void){
    this.lineRoot.id='land-line-options';this.brushRoot.id='land-brush-options';
    panel.querySelector('#land-width')!.closest('label')!.after(this.lineRoot);
    panel.querySelector('#land-radius')!.closest('label')!.before(this.brushRoot);
    this.brushRoot.innerHTML=`<label>Pinselwirkung<select id="land-brush-mode"><option value="terrain">Geländeart / Eigenschaft</option><option value="land">Land hinzufügen</option><option value="land-erase">Land radieren</option><option value="raise">Küste anheben</option><option value="lower">Küste absenken</option><option value="freshwater">Süßwasser malen</option><option value="freshwater-erase">Süßwasser radieren</option><option value="ground-color">Geländefarbe</option><option value="water-color">Wasserfarbe</option><option value="color-erase">Farbe radieren</option></select></label><label id="land-coast-roughness-label">Küstenrauheit<input id="land-coast-roughness" type="range" min="0" max="2" step="0.1" value="0.6"></label><div id="land-color-options"><label>Pinselspitze<select id="land-tip"><option value="round">Rund</option><option value="soft">Weich</option><option value="textured">Strukturiert</option></select></label><label>Farbe<input id="land-paint-color" type="color" value="#739355"></label><div id="land-palette" class="toolbar"></div><button id="land-palette-add" type="button">Farbe merken</button><button id="land-pipette" type="button">Farbe aufnehmen</button><label>Deckkraft<input id="land-paint-opacity" type="range" min="0.1" max="1" step="0.05" value="1"></label><label>Auftragsstärke<input id="land-paint-flow" type="range" min="0.1" max="1" step="0.05" value="1"></label><label><input id="land-fill" type="checkbox"> Zusammenhängende Fläche füllen</label></div>`;
    this.brushRoot.oninput=this.brushRoot.onchange=()=>{this.show(this.last);this.changed();};
    const palette=this.brushRoot.querySelector('#land-palette')!,add=(color:string)=>{if(palette.querySelector(`[data-color="${color}"]`))return;const b=document.createElement('button');b.type='button';b.dataset.color=color;b.title=color;b.setAttribute('aria-label','Farbe '+color);b.textContent='●';b.style.color=color;b.onclick=()=>{field(this.brushRoot,'land-paint-color').value=color;this.changed();};palette.append(b);};
    ['#739355','#d8c397','#aa8170','#629ebc','#f1ead8'].forEach(add);
    try{const saved=JSON.parse(localStorage.getItem('atlas-color-palette-v1')??'[]');if(Array.isArray(saved))saved.slice(0,48).filter(c=>typeof c==='string'&&/^#[a-f0-9]{6}$/i.test(c)).forEach(add);}catch{/* A palette is optional; authored color remains in the campaign. */}
    this.brushRoot.querySelector<HTMLButtonElement>('#land-palette-add')!.onclick=()=>{add(field(this.brushRoot,'land-paint-color').value);try{localStorage.setItem('atlas-color-palette-v1',JSON.stringify([...palette.querySelectorAll<HTMLElement>('[data-color]')].map(b=>b.dataset.color).slice(-48)));}catch{/* Current-session palette remains available. */}};
    this.brushRoot.querySelector<HTMLButtonElement>('#land-pipette')!.onclick=()=>{this.eyedropper=true;this.changed();};
  }
  mode():BrushMode{return field(this.brushRoot,'land-brush-mode').value as BrushMode;}
  roughness(){return Number(field(this.brushRoot,'land-coast-roughness').value);}
  fill(){return check(this.brushRoot,'land-fill').checked;}
  color(radius:number,seed:number):LandscapeColor{return {version:1,target:this.mode()==='water-color'?'water':'ground',color:field(this.brushRoot,'land-paint-color').value,
    opacity:Number(field(this.brushRoot,'land-paint-opacity').value),flow:Number(field(this.brushRoot,'land-paint-flow').value),tip:field(this.brushRoot,'land-tip').value as LandscapeColor['tip'],radius,seed,fill:this.fill()};}
  sample(color:string){field(this.brushRoot,'land-paint-color').value=color;this.eyedropper=false;this.changed();}
  line(kind:'road'|'river',seed:number){return {...(this.last===kind?readLineControls(this.lineRoot,'land-new',this.lines[kind]):this.lines[kind]),seed};}
  show(tool:string){
    if(tool!==this.last){
      if(this.last==='road'||this.last==='river')this.lines[this.last]=readLineControls(this.lineRoot,'land-new',this.lines[this.last]);
      this.last=tool;
      if(tool==='road'||tool==='river'){lineControls(this.lineRoot,'land-new',this.lines[tool],tool==='river',this.changed);const w=document.getElementById('land-width') as HTMLInputElement;w.value=String(lineType(this.lines[tool].type)!.width);}
    }
    this.lineRoot.hidden=!['river','road'].includes(tool);this.brushRoot.hidden=tool!=='paint';
    this.brushRoot.querySelector<HTMLElement>('#land-color-options')!.hidden=!['ground-color','water-color'].includes(this.mode());
    this.brushRoot.querySelector<HTMLElement>('#land-coast-roughness-label')!.hidden=!['land','land-erase','raise','lower','freshwater','freshwater-erase'].includes(this.mode());
  }
}
