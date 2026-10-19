import {newLine,lineParts,roadStyles,type LandscapeLine} from './landscape-line';
import type {BrushMode,LandscapeColor} from './landscape-brush';
import type {LandscapeRecord} from './atlas-landscape';
const field=(root:ParentNode,id:string)=>root.querySelector<HTMLInputElement|HTMLSelectElement>('#'+id)!;
const check=(root:ParentNode,id:string)=>root.querySelector<HTMLInputElement>('#'+id)!;
export function lineControls(root:HTMLElement,prefix:string,value:LandscapeLine,river:boolean,changed:()=>void){
  root.innerHTML=`<strong>${prefix==='land-new'?'Vorgaben für neue Verläufe':'Eigenschaften der Auswahl'}</strong><label>Kurve<select id="${prefix}-curve"><option value="smooth">Geschwungen</option><option value="linear">Gerade Teilstücke</option></select></label><label>Farbe<input id="${prefix}-color" type="color"></label><label>Rauheit<input id="${prefix}-roughness" type="range" min="0" max="${river?3:1}" step="0.01"></label>`+
    (river?`<label>Mäanderabstand<input id="${prefix}-meander" type="range" min="0" max="1" step="0.01"></label><label><input id="${prefix}-fade" type="checkbox"> Quelle schmal auslaufen lassen</label>`:
    `<label>Straßenstil<select id="${prefix}-style">${roadStyles.map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select></label><svg id="${prefix}-preview" viewBox="0 0 200 44" role="img" aria-label="Vorschau des Straßenstils" style="width:100%;height:44px;background:#edf0df"></svg><label><input id="${prefix}-over" type="checkbox"> Über Ortssymbolen zeichnen</label>`);
  for(const [id,v] of [['curve',value.curve],['color',value.color],['roughness',value.roughness],['meander',value.meander],['style',value.style]] as const){const f=field(root,prefix+'-'+id);if(f)f.value=String(v);}
  const fade=check(root,prefix+'-fade'),over=check(root,prefix+'-over');if(fade)fade.checked=value.fadeIn;if(over)over.checked=value.overSymbols;
  const preview=()=>{
    const svg=root.querySelector('#'+prefix+'-preview');if(!svg)return;
    svg.replaceChildren();const line=readLineControls(root,prefix,value),record={kind:'road',width:5,points:[{x:12,y:30},{x:85,y:15},{x:185,y:28}],line} as LandscapeRecord;
    for(const part of lineParts(record)){
      const n=document.createElementNS('http://www.w3.org/2000/svg',part.polygons?'polygon':'polyline');
      n.setAttribute('points',(part.polygons?.[0]?.outer??part.points).map(p=>p.x+','+p.y).join(' '));n.setAttribute('fill',part.polygons?part.color:'none');n.setAttribute('stroke',part.color);n.setAttribute('stroke-width',String(part.width));if(part.dash)n.setAttribute('stroke-dasharray',part.dash.join(' '));if(part.dashOffset)n.setAttribute('stroke-dashoffset',String(part.dashOffset));n.setAttribute('stroke-linecap','round');n.setAttribute('stroke-linejoin','round');n.setAttribute('opacity',String(part.opacity));svg.append(n);
    }
  };
  root.oninput=()=>{preview();changed();};root.onchange=()=>{preview();changed();};preview();
}
export function readLineControls(root:ParentNode,prefix:string,base:LandscapeLine):LandscapeLine{
  const result={...base};for(const key of ['curve','color','style'] as const){const f=field(root,prefix+'-'+key);if(f)(result as any)[key]=f.value;}
  for(const key of ['roughness','meander'] as const){const f=field(root,prefix+'-'+key);if(f)result[key]=Number(f.value);}
  const fade=check(root,prefix+'-fade'),over=check(root,prefix+'-over');if(fade)result.fadeIn=fade.checked;if(over)result.overSymbols=over.checked;return result;
}
export class LandscapeToolSettings{
  readonly lineRoot=document.createElement('div');readonly brushRoot=document.createElement('div');
  private brushMode:BrushMode='land';
  private sizes:Record<string,number>={land:500,'land-erase':500,fractal:500};
  private last='';private lines={road:newLine('road'),river:newLine('river')};
  eyedropper=false;
  constructor(panel:HTMLElement,private changed:()=>void,private canChange:()=>boolean=()=>true){
    this.lineRoot.id='land-line-options';this.brushRoot.id='land-brush-options';
    panel.querySelector('#land-width')!.closest('label')!.after(this.lineRoot);
    panel.querySelector('#land-radius')!.closest('label')!.before(this.brushRoot);
    this.brushRoot.innerHTML=`<label>Pinselwirkung<select id="land-brush-mode"><option value="terrain">Geländeart / Eigenschaft</option><option value="land">Land hinzufügen</option><option value="land-erase">Land radieren</option><option value="raise">Fraktal erhöhen</option><option value="lower">Fraktal absenken</option><option value="freshwater">Süßwasser malen</option><option value="freshwater-erase">Süßwasser radieren</option><option value="ground-color">Geländefarbe</option><option value="water-color">Wasserfarbe</option><option value="color-erase">Farbe radieren</option></select></label><label id="land-coast-roughness-label">Rauheit<input id="land-coast-roughness" type="range" min="0.1" max="2" step="0.1" value="1"></label><div id="land-color-options"><label>Pinselspitze<select id="land-tip"><option value="round">Rund</option><option value="soft">Weich</option><option value="textured">Strukturiert</option></select></label><label>Farbe<input id="land-paint-color" type="color" value="#739355"></label><div id="land-palette" class="toolbar"></div><button id="land-palette-add" type="button">Farbe merken</button><button id="land-pipette" type="button">Farbe aufnehmen</button><label>Deckkraft<input id="land-paint-opacity" type="range" min="0.1" max="1" step="0.05" value="1"></label><label>Auftragsstärke<input id="land-paint-flow" type="range" min="0.1" max="1" step="0.05" value="1"></label><label><input id="land-fill" type="checkbox"> Zusammenhängende Fläche füllen</label></div>`;
    const selector=field(this.brushRoot,'land-brush-mode');selector.value='land';
    const buttons=document.createElement('div');buttons.className='toolbar';buttons.setAttribute('aria-label','Land bearbeiten');
    for(const [mode,label]of [['land','Land zeichnen'],['land-erase','Land radieren'],['raise','Fraktal erhöhen'],['lower','Fraktal absenken']]){const button=document.createElement('button');button.type='button';button.textContent=label!;button.dataset.landMode=mode;button.onclick=()=>{selector.value=mode!;this.changeMode(panel);};buttons.append(button);}this.brushRoot.prepend(buttons);
    this.brushRoot.oninput=this.brushRoot.onchange=()=>{this.changeMode(panel);};
    const palette=this.brushRoot.querySelector('#land-palette')!,add=(color:string)=>{if(palette.querySelector(`[data-color="${color}"]`))return;const b=document.createElement('button');b.type='button';b.dataset.color=color;b.title=color;b.setAttribute('aria-label','Farbe '+color);b.textContent='●';b.style.color=color;b.onclick=()=>{field(this.brushRoot,'land-paint-color').value=color;this.changed();};palette.append(b);};
    ['#739355','#d8c397','#aa8170','#629ebc','#f1ead8'].forEach(add);
    try{const saved=JSON.parse(localStorage.getItem('atlas-color-palette-v1')??'[]');if(Array.isArray(saved))saved.slice(0,48).filter(c=>typeof c==='string'&&/^#[a-f0-9]{6}$/i.test(c)).forEach(add);}catch{/* A palette is optional; authored color remains in the campaign. */}
    this.brushRoot.querySelector<HTMLButtonElement>('#land-palette-add')!.onclick=()=>{add(field(this.brushRoot,'land-paint-color').value);try{localStorage.setItem('atlas-color-palette-v1',JSON.stringify([...palette.querySelectorAll<HTMLElement>('[data-color]')].map(b=>b.dataset.color).slice(-48)));}catch{/* Current-session palette remains available. */}};
    this.brushRoot.querySelector<HTMLButtonElement>('#land-pipette')!.onclick=()=>{this.eyedropper=true;this.changed();};
  }
  private changeMode(root:ParentNode){
    const selector=field(this.brushRoot,'land-brush-mode'),next=selector.value as BrushMode;
    if(next!==this.brushMode){
      if(!this.canChange()){selector.value=this.brushMode;return;}
      const key=(m:string)=>m==='raise'||m==='lower'?'fractal':m,radius=field(root,'land-radius');this.sizes[key(this.brushMode)]=Number(radius.value);radius.value=String(this.sizes[key(next)]??500);this.brushMode=next;
    }
    this.show(this.last);this.changed();
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
      if(tool==='road'||tool==='river')lineControls(this.lineRoot,'land-new',this.lines[tool],tool==='river',this.changed);
    }
    for(const b of this.brushRoot.querySelectorAll<HTMLButtonElement>('[data-land-mode]'))b.setAttribute('aria-pressed',String(b.dataset.landMode===this.mode()));
    this.lineRoot.hidden=!['river','road'].includes(tool);this.brushRoot.hidden=tool!=='paint';
    this.brushRoot.querySelector<HTMLElement>('#land-color-options')!.hidden=!['ground-color','water-color'].includes(this.mode());
    this.brushRoot.querySelector<HTMLElement>('#land-coast-roughness-label')!.hidden=!['raise','lower'].includes(this.mode());
  }
}
