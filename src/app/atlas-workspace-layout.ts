import {bindAnchoredPopup} from './anchored-popup';

type Family='navigation'|'terrain'|'city'|'interior'|'decoration'|'travel';
type Section='terrain'|'city'|'interior';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const button=(id:string,text:string)=>{const b=document.createElement('button');b.id=id;b.type='button';b.textContent=text;return b;};
const toolNames:Record<string,[string,string]>={select:['↖','Auswahl'],paint:['◒','Gelände'],hex:['⬡','Hexfläche'],reset:['↺','Zurücksetzen'],river:['≋','Fluss'],road:['╱','Weg'],place:['⚑','Ort'],measure:['↔','Messen'],district:['▧','Viertel'],plaza:['□','Platz'],water:['≈','Wasser'],wall:['▥','Wand'],building:['⌂','Haus'],'room-rectangle':['▭','Raum'],'room-polygon':['⬠','Freier Raum'],'room-cave':['◒','Höhle'],'room-erase':['◐','Radieren'],'room-hole':['◯','Aussparung'],door:['⊓','Tür / Portal'],stairs:['▤','Treppe'],light:['☼','Licht'],object:['♧','Objekt'],scatter:['⁙','Streuen'],path:['╱','Pfad'],terrain:['▧','Terrain'],roof:['⌂','Dach'],text:['T','Text'],feature:['◇','Feature']};

/** Layout owns presentation, never copies a form or its domain event handlers. */
export class AtlasWorkspaceLayout {
 private active=false;
 private family:Section='terrain';
 private slots=new Map<HTMLElement,Comment>();
 private familyNodes:HTMLElement[]=[];
 private shellNodes:HTMLElement[]=[];
 private extraNodes:HTMLElement[]=[];
 private auxiliary:string|null=null;
 private selectionKey:string|null=null;
 private contextVisible=false;
 private width=240;
 private detailWidth=340;
 private popups:ReturnType<typeof bindAnchoredPopup>[]=[];
 private palette=document.createElement('div');
 readonly tools=document.createElement('section');
 readonly selection=document.createElement('section');
 private secondary=document.createElement('aside');
 private secondaryContent=document.createElement('div');
 private menu=document.createElement('div');
 private viewMenu=document.createElement('div');
 private importMenu=document.createElement('div');
 private notices=document.createElement('div');
 private keyHandler=(e:KeyboardEvent)=>{
  // Native access keys also need a guard: their original buttons remain in the shell.
  if(this.active&&e.altKey&&!e.ctrlKey&&!e.metaKey&&e.key.toLowerCase()==='p'){e.preventDefault();e.stopImmediatePropagation();}
 };
 constructor(private root:HTMLElement,private host:{exit:()=>Promise<void>;prepare:()=>Promise<boolean>;tool:(family:Family,id:string,value:string)=>Promise<boolean>;navigation:(pan:boolean)=>Promise<void>;error:(e:unknown)=>void}){
  this.root.dataset.editorSection='terrain';
  this.tools.id='atlas-workspace-tools';this.selection.id='atlas-workspace-selection';
  this.secondary.id='atlas-secondary';this.secondary.hidden=true;this.secondary.setAttribute('aria-label','Kontext und Eigenschaften');
  const heading=document.createElement('div');heading.className='atlas-secondary-heading';
  const title=document.createElement('strong');title.id='atlas-secondary-title';
  const close=button('atlas-secondary-close','×');close.title='Details schließen';close.setAttribute('aria-label','Details schließen');close.onclick=()=>this.hideContext();
  heading.append(title,close);this.secondaryContent.id='atlas-secondary-content';
  this.selection.hidden=true;this.secondaryContent.append(this.selection);
  this.secondary.append(heading,this.secondaryContent);this.root.querySelector('.atlas-layout')!.append(this.secondary);
  const families=el('atlas-families');
  const main=document.createElement('div');main.className='atlas-dock-body';
  main.append(this.tools,el('atlas-edit-panel'));
  const dock=el('atlas-panel');this.palette.id='atlas-tool-palette';dock.append(families,this.palette,main);
  this.tools.append(el('atlas-tool-fields'));
  this.selection.append(el('atlas-selection-title'));
  el('atlas-hint').classList.add('atlas-editor-hint');main.append(el('atlas-hint'));
  this.root.querySelector('.atlas-stage')!.prepend(el('atlas-scale'));
  try{const p=JSON.parse(localStorage.getItem('atlas-editor-layout-v2')??'null');if(p){this.width=Math.max(200,Math.min(300,Number(p.width)||240));this.detailWidth=Math.max(280,Math.min(480,Number(p.detailWidth)||340));this.root.dataset.collapsed=String(p.collapsed===true);}}catch{/* optional preference */}
  this.resizer(dock,'atlas-panel-width','Werkzeugleiste verbreitern',false);
  this.resizer(this.secondary,'atlas-details-width','Kontextleiste verbreitern',true);
  this.createHeader();
  document.addEventListener('keydown',this.keyHandler,true);
  new ResizeObserver(()=>this.applyWidth()).observe(this.root);
  document.addEventListener('atlas-key-panel',()=>{if(this.active)this.openContext('key','Raumbeschreibung',[el('key-dialog')]);});
  el('key-dialog').addEventListener('close',()=>{if(this.auxiliary==='key')this.clearContext();});
  this.root.addEventListener('change',e=>{
   const input=e.target as HTMLSelectElement;
   if(input.id==='drawing-tool'&&['object','scatter'].includes(input.value))void this.requestContext('library','Objekte wählen',[el('drawing-tool-options')]);
   else if(input.id==='drawing-tool'&&this.auxiliary==='library')this.clearContext();
   this.sync();
  });
  this.applyWidth();
 }
 private move(node:HTMLElement,target:HTMLElement,list:HTMLElement[]){
  if(!this.slots.has(node)){const slot=document.createComment('Atlas control: '+node.id);node.before(slot);this.slots.set(node,slot);}
  target.append(node);if(!list.includes(node))list.push(node);
 }
 private restore(nodes:HTMLElement[]){for(const node of [...nodes].reverse()){const slot=this.slots.get(node);if(slot?.parentNode){slot.replaceWith(node);this.slots.delete(node);}}nodes.length=0;}
 private saveLayout(){try{localStorage.setItem('atlas-editor-layout-v2',JSON.stringify({width:this.width,detailWidth:this.detailWidth,collapsed:this.root.dataset.collapsed==='true'}));}catch{/* optional preference */}}
 private resizer(parent:HTMLElement,id:string,label:string,right:boolean){
  const handle=document.createElement('div');handle.id=id;handle.className='atlas-resizer';handle.tabIndex=0;handle.role='separator';handle.setAttribute('aria-label',label);handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-valuemin',String(right?280:200));handle.setAttribute('aria-valuemax',String(right?480:300));parent.append(handle);
  const change=(value:number)=>{if(right)this.detailWidth=Math.max(280,Math.min(480,value));else this.width=Math.max(200,Math.min(300,value));this.applyWidth();this.saveLayout();};
  handle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const old=right?this.detailWidth:this.width;change(e.key==='Home'?(right?280:200):e.key==='End'?(right?480:300):old+(e.key==='ArrowRight'?1:-1)*(right?-10:10));};
  let drag:{id:number;x:number;width:number}|null=null;
  handle.onpointerdown=e=>{if(e.button)return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,width:right?this.detailWidth:this.width};handle.setPointerCapture(e.pointerId);};
  handle.onpointermove=e=>{if(drag?.id===e.pointerId)change(drag.width+(e.clientX-drag.x)*(right?-1:1));};
  const end=()=>{drag=null;};handle.onpointerup=end;handle.onpointercancel=end;handle.onlostpointercapture=end;
 }
 private symbol(node:HTMLElement,text:string,label:string){node.textContent=text;node.title=label;node.setAttribute('aria-label',label);node.classList.add('atlas-icon-button');return node;}
 private popup(node:HTMLElement,id:string,trigger:HTMLButtonElement,width:number){node.id=id;node.setAttribute('popover','auto');node.className='atlas-popup';document.body.append(node);const api=bindAnchoredPopup(trigger,node,width);trigger.onclick=()=>api.toggle();this.popups.push(api);return api;}
 private createHeader(){
  const header=this.root.querySelector<HTMLElement>('.atlas-command-bar')!;
  header.querySelector('strong')!.remove();
  const manage=document.createElement('div'),navigate=document.createElement('div');manage.className='atlas-header-management';navigate.className='atlas-header-navigation';
  const nav=button('atlas-navigation','Atlas ▾'),view=button('atlas-view','Ansicht ▾'),imports=button('atlas-import','Import ▾'),status=button('atlas-status','Gesichert');
  const menu=this.popup(this.menu,'atlas-navigation-popup',nav,300);this.popup(this.viewMenu,'atlas-view-popup',view,300);this.popup(this.importMenu,'atlas-import-popup',imports,290);this.popup(this.notices,'atlas-status-popup',status,380);
  this.menu.onclick=e=>{if((e.target as Element).closest('button'))menu.close();};
  const exit=button('atlas-exit','Atlas verlassen');exit.onclick=()=>void this.host.exit().catch(this.host.error);this.menu.append(exit);
  const search=el('atlas-search').closest('label')!;search.classList.add('atlas-header-search');search.firstChild!.textContent='';el<HTMLInputElement>('atlas-search').placeholder='Ort, Haus oder Raum suchen';el('atlas-search').setAttribute('aria-label','Ort finden');
  const pick=button('atlas-select',''),pan=button('atlas-pan','');this.symbol(pick,'↖','Auswahl');this.symbol(pan,'✥','Hand');
  pick.onclick=()=>void this.host.navigation(false).catch(this.host.error);pan.onclick=()=>void this.host.navigation(true).catch(this.host.error);
  this.symbol(el('atlas-undo'),'↶','Rückgängig');this.symbol(el('atlas-redo'),'↷','Wiederholen');
  const controls=this.root.querySelector<HTMLElement>('.map-canvas-controls')!;
  const camera=[...controls.querySelectorAll<HTMLButtonElement>('button')].filter(b=>b.id!=='atlas-output-open');
  for(const [i,s]of ['+','−','←','→'].entries()){const b=camera[i]!;this.symbol(b,s,b.textContent!.replace(/^[+−←] /,''));}
  const reset=button('atlas-reset-view','Ansicht zurücksetzen');reset.onclick=()=>camera[4]!.click();this.viewMenu.append(reset,el('atlas-room-view'));camera[4]!.classList.add('atlas-reset-control');
  el<HTMLDetailsElement>('atlas-room-view').open=true;
  this.symbol(el('atlas-overview'),'◎','Weltübersicht');
  const toggle=button('atlas-context-toggle','');this.symbol(toggle,'▥','Details einblenden');toggle.onclick=()=>this.toggleContext();
  const tools=button('atlas-tools-toggle','Werkzeugleiste ein-/ausblenden');tools.onclick=()=>{this.root.dataset.collapsed=String(this.root.dataset.collapsed!=='true');this.applyWidth();this.saveLayout();};this.viewMenu.append(tools);
  const focus=button('atlas-focus-map','Beide Seitenleisten ausblenden');focus.onclick=()=>{this.root.dataset.collapsed='true';this.contextVisible=false;this.applyWidth();this.saveLayout();};this.viewMenu.append(focus);
  this.viewMenu.append(el('land-grid').closest('label')!,el('land-auto-level').closest('label')!);
  const grid=button('atlas-view-grid','Hexgröße einstellen');grid.onclick=()=>{this.popups.forEach(p=>p.close());void this.requestContext('grid','Hexraster',[el('atlas-hex-level').closest('label')!]);};this.viewMenu.append(grid);
  const reference=button('atlas-import-reference','Nachzeichenvorlage…');reference.onclick=()=>{this.popups.forEach(p=>p.close());void this.requestContext('reference-image','Nachzeichenvorlage',[el('land-reference').closest('details')!]);};this.importMenu.append(reference);
  status.setAttribute('aria-live','polite');status.setAttribute('aria-label','Speicherstatus und Meldungen');this.notices.append(el('atlas-recover'),el('atlas-region-retry'));
  el('atlas-output-open').textContent='Export';
  manage.append(nav,search,el('atlas-reference-open'),view,imports,el('atlas-output-open'),status,toggle);
  controls.replaceChildren(camera[2]!,camera[3]!,camera[0]!,camera[1]!,camera[4]!);navigate.append(el('atlas-undo'),el('atlas-redo'),pick,pan,controls,el('atlas-overview'));
  header.append(manage,navigate);
  // The shell keeps runtime controls. They never enter an editor popup.
  el('atlas-to-party').classList.add('atlas-runtime-control');
  const observer=new MutationObserver(()=>{
   const pending=!el('atlas-recover').hidden||!el('commit-pending').hidden||!el('error-actions').hidden||!el('backup-status').hidden||!el('world-write-recovery').hidden;
   const failed=pending||el('atlas-save-status').dataset.error==='true'||el('status').dataset.error==='true';
   const message=el('atlas-save-status').textContent||el('status').textContent||'Gesichert';
   status.textContent=failed?'Speicherstand prüfen':message.startsWith('Kartenausschnitt')?'Gesichert':message;status.title=message;status.dataset.error=String(failed);status.setAttribute('aria-label','Status: '+status.textContent);
  });
  for(const id of ['status','atlas-save-status','atlas-recover','commit-pending','error-actions','backup-status','world-write-recovery','graph-preview-banner'])observer.observe(el(id),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','data-error']});
  el('atlas-search-results').classList.add('atlas-search-popup');
 }
 setActive(active:boolean){
  if(this.active===active)return;this.active=active;document.body.classList.toggle('atlas-workspace',active);
  if(active){
   for(const id of ['campaign-header-name','rename-campaign','new-campaign','campaign-manager','application-settings','help'])this.move(el(id),this.menu,this.shellNodes);
   this.move(el('import'),this.importMenu,this.shellNodes);
   for(const id of ['status','commit-pending','error-actions','backup-status','world-write-recovery','graph-preview-banner','atlas-save-status'])this.move(el(id),this.notices,this.shellNodes);
   const party=el('party-popover');if(party.matches(':popover-open'))party.hidePopover();
  }else{for(const p of this.popups)p.close();if(this.auxiliary==='key')el('key-close').click();this.restore(this.shellNodes);this.contextVisible=false;this.applyWidth();}
  document.dispatchEvent(new Event('workspace-layout-changed'));
 }
 private applyWidth(){
  this.root.style.setProperty('--atlas-dock-width',this.width+'px');this.root.style.setProperty('--atlas-details-width',this.detailWidth+'px');
  const left=this.root.dataset.collapsed==='true'?0:this.width;this.root.style.setProperty('--atlas-left-space',left+'px');
  this.root.dataset.secondary=String(this.contextVisible);
  this.root.dataset.overlay=String(this.root.clientWidth-left-this.detailWidth<560);
  this.secondary.hidden=!this.contextVisible;
  const toggle=el<HTMLButtonElement>('atlas-context-toggle');if(toggle){toggle.disabled=!this.auxiliary&&!this.selectionKey;toggle.setAttribute('aria-expanded',String(this.contextVisible));toggle.setAttribute('aria-label',this.contextVisible?'Details ausblenden':'Details einblenden');toggle.title=toggle.getAttribute('aria-label')!;}
  el('atlas-panel-width')?.setAttribute('aria-valuenow',String(this.width));el('atlas-details-width')?.setAttribute('aria-valuenow',String(this.detailWidth));
 }
 private hideContext(){this.contextVisible=false;this.applyWidth();}
 private toggleContext(){if(this.contextVisible)this.hideContext();else if(this.auxiliary){this.contextVisible=true;this.applyWidth();}else if(this.selectionKey)this.openSelection();}
 private clearContext(){this.restore(this.extraNodes);this.auxiliary=null;this.contextVisible=false;this.selection.hidden=true;delete this.root.dataset.task;this.applyWidth();}
 private openContext(kind:string,title:string,nodes:HTMLElement[]){
  if(this.auxiliary==='key'&&el<HTMLDialogElement>('key-dialog').open&&kind!=='key')return;
  if(this.auxiliary!==kind){this.clearContext();this.auxiliary=kind;this.root.dataset.task=kind;for(const node of nodes)this.move(node,this.secondaryContent,this.extraNodes);}
  el('atlas-secondary-title').textContent=title;this.selection.hidden=kind!=='selection';this.contextVisible=true;
  if(kind==='library')el<HTMLDetailsElement>('drawing-tool-options').open=true;
  if(kind==='grid')el('atlas-hex-level').closest('label')!.hidden=false;
  if(kind==='reference-image')el<HTMLDetailsElement>('land-reference').closest('details')!.open=true;
  this.applyWidth();
 }
 private releaseDescription(){if(this.auxiliary==='key')el<HTMLDialogElement>('key-dialog').close();}
 private async requestContext(kind:string,title:string,nodes:HTMLElement[]){try{if(await this.host.prepare()){this.releaseDescription();this.openContext(kind,title,nodes);}}catch(e){this.host.error(e);}}
 comparison(open:boolean){this.root.dataset.comparing=String(open);if(open){this.releaseDescription();this.openContext('comparison','Größe vergleichen',[el('atlas-reference-panel')]);}else if(this.auxiliary==='comparison')this.clearContext();}
 output(open:boolean){if(open){this.releaseDescription();this.openContext('output','Bild exportieren',[el('atlas-output')]);}else if(this.auxiliary==='output')this.clearContext();}
 // Compatibility for domain callers: selection never replaces the tool panel.
 showPane(pane:'tool'|'selection'){if(pane==='selection')this.openSelection();}
 private openSelection(){this.openContext('selection','Eigenschaften',[this.selection]);}
 selectionChanged(key:string|null,explicit=false){if(key===this.selectionKey&&!explicit)return;this.selectionKey=key;if(key)this.openSelection();else if(this.auxiliary==='selection')this.clearContext();}
 beforeTool(){if(this.auxiliary&&this.auxiliary!=='key'&&this.auxiliary!=='selection')this.clearContext();}
 setFamily(family:Family){
  if(family==='travel')return;
  const section:Section=family==='navigation'?this.family:family==='decoration'?'interior':family;
  if(section===this.family&&this.familyNodes.length){this.sync();return;}
  if(this.auxiliary!=='key')this.clearContext();this.restore(this.familyNodes);this.family=section;this.selectionKey=null;this.root.dataset.editorSection=section;
  this.root.querySelectorAll('[data-family-action]').forEach(n=>n.remove());this.selection.querySelectorAll('[data-family-action]').forEach(n=>n.remove());
  this.root.querySelectorAll<HTMLElement>('[data-tool-buttons]').forEach(n=>n.hidden=true);
  const add=(node:HTMLElement|null,target=this.tools)=>{if(node)this.move(node,target,this.familyNodes);};
  add(el('atlas-placement'),this.selection);add(el('atlas-building-interior'),this.selection);
  if(section==='terrain'){
   add(el('atlas-landscape-tools'));add(el('land-selection'),this.selection);
   const template=button('atlas-template-open','▧ Vorlage');template.onclick=()=>void this.requestContext('reference-image','Nachzeichenvorlage',[el('land-reference').closest('details')!]);template.dataset.familyAction='true';this.palette.append(template);
   el('land-reference').closest('details')!.classList.add('atlas-extra-only');
   this.toolButtons('land-tool');
  }
  if(section==='city'){
   add(el('atlas-create-city'),this.palette);add(el('city-tool').closest('label'));add(el('city-draw-width').closest('label'));add(el('city-path-hint'));add(el('city-finish').parentElement);
   const generation=button('atlas-generation-open','▧ Viertel bebauen');generation.dataset.familyAction='true';generation.onclick=()=>void this.openGeneration();this.palette.append(generation);
   add(el('city-inspector'),this.selection);add(el('city-empty'));add(el('city-count'),this.selection);add(el('city-demographics'),this.selection);add(el('city-factions'),this.selection);
   const extra=document.createElement('details');extra.dataset.familyAction='true';extra.innerHTML='<summary>Stadtdarstellung und Ausgabe</summary>';this.selection.append(extra);
   for(const id of ['city-export-svg','city-export-json'])add(el(id),extra);add(el('city-paper').closest('details'),extra);this.toolButtons('city-tool');
  }
  if(section==='interior'){
   add(el('atlas-floor-field'));add(el('atlas-create-dungeon'),this.palette);add(el('atlas-connect-entrance'),this.selection);
   for(const id of ['drawing-element-size-field','drawing-light-radius-field','drawing-text-field'])add(el(id),el('drawing-toolbar'));
   el('drawing-tool-options').classList.add('atlas-extra-only');
   el('key-open').textContent='Beschreibung bearbeiten…';add(el('key-open'),this.selection);add(el('empty'),this.selection);add(el('editor'),this.selection);
   for(const node of [...el('inspector').querySelector('.drawing-tools')!.children] as HTMLElement[])add(node,this.selection);
   const analysis=document.createElement('section');analysis.id='atlas-room-analysis';analysis.dataset.familyAction='true';this.tools.append(analysis);analysis.className='atlas-extra-only';
   for(const id of ['search','rooms','add-room','dungeon-binder-open','graph-open','volume-open','trigger-fields-open','dungeon-content-open','path-open','drawing-show-section','drawing-slice-y','drawing-section'])add(el(id).matches('input')&&id.startsWith('drawing-')?el(id).closest('label'):el(id),analysis);
   const open=button('atlas-analysis-open','▤ Räume und Analyse');open.dataset.familyAction='true';open.onclick=()=>void this.requestContext('analysis','Räume und Analyse',[analysis]);this.palette.append(open);this.toolButtons('drawing-tool');
  }
  this.sync();
 }
 private toolButtons(id:string){
  const select=el<HTMLSelectElement>(id);if(!this.root.contains(select))return;
  let group=this.root.querySelector<HTMLElement>('[data-tool-buttons="'+id+'"]');
  if(!group){group=document.createElement('div');group.className='atlas-tool-buttons';group.dataset.toolButtons=id;group.setAttribute('aria-label','Werkzeuge');
   for(const option of select.options){const [symbol,label]=toolNames[option.value]??['◇',option.textContent??option.value];const b=button('',label);const icon=document.createElement('span');icon.className='atlas-tool-icon';icon.setAttribute('aria-hidden','true');icon.textContent=symbol;b.prepend(icon);b.title=option.textContent??label;b.setAttribute('aria-label',b.title);b.dataset.toolSelect=id;b.dataset.toolValue=option.value;b.onclick=()=>void this.host.tool(id==='land-tool'?'terrain':id==='city-tool'?'city':'interior',id,option.value).then(()=>this.sync()).catch(this.host.error);group.append(b);}
   select.closest('label')!.classList.add('atlas-native-tool-select');select.addEventListener('change',()=>this.sync());
  }
  group.hidden=false;this.palette.prepend(group);
 }
 private async openGeneration(){const nodes:HTMLElement[]=[];for(const id of ['city-district','city-seed','city-density','city-size','city-reach','city-use'])nodes.push(el(id).closest('label')!);for(const id of ['city-generate','city-cancel-preview','city-preview-summary','city-preview-actions'])nodes.push(el(id));await this.requestContext('generation','Viertel bebauen',nodes);}
 sync(){
  if(!this.active)return;
  const name=el('atlas-new-name').closest('label')!;
  if(this.family!=='terrain')name.hidden=(this.family==='city'&&this.root.dataset.citySelected==='true'&&!this.root.dataset.placing)||(this.family==='interior'&&!this.root.dataset.placing);
  if(this.family==='city'){const tool=el<HTMLSelectElement>('city-tool').value;el('city-draw-width').closest('label')!.hidden=!['road','wall'].includes(tool);const count=Number(el('city-path-hint').textContent?.match(/^(\d+) Punkte/)?.[1]??0);el('city-finish').hidden=!count;el('city-cancel-path').hidden=!count;}
  const navigating=this.root.dataset.family==='navigation';
  for(const id of ['land-tool','city-tool','drawing-tool']){const select=el<HTMLSelectElement>(id);for(const b of this.root.querySelectorAll<HTMLButtonElement>('[data-tool-select="'+id+'"]')){b.setAttribute('aria-pressed',String(!navigating&&b.dataset.toolValue===select.value));b.disabled=select.disabled;}}
  el('atlas-select').setAttribute('aria-pressed',String(navigating&&this.root.dataset.panMode!=='true'));el('atlas-pan').setAttribute('aria-pressed',String(this.root.dataset.panMode==='true'));
 }
}
