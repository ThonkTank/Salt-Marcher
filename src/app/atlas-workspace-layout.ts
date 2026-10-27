import {initAtlasUnits,atlasUnits,setAtlasUnits} from './atlas-units';
import {bindAnchoredPopup} from './anchored-popup';
import {atlasSections,availableAtlasGroups,atlasToolMatches,type AtlasSection,type AtlasTool,type AtlasToolGroup} from './atlas-tool-catalog';

type Family='navigation'|'terrain'|'city'|'interior'|'decoration'|'travel';
type Section=AtlasSection;
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const button=(id:string,text:string)=>{const b=document.createElement('button');b.id=id;b.type='button';b.textContent=text;return b;};
const text=(node:HTMLElement,value:string)=>{if(node.textContent!==value)node.textContent=value;};
const pressed=(node:HTMLElement,value:boolean)=>{const next=String(value);if(node.getAttribute('aria-pressed')!==next)node.setAttribute('aria-pressed',next);};
const toolNames:Record<string,[string,string]>={select:['↖','Auswahl'],height:['◒','Land formen'],smooth:['∿','Glätten'],color:['◉','Farbe'],property:['▧','Werte'],freshwater:['≈','Süßwasser'],hex:['⬡','Hexfläche'],reset:['↺','Zurücksetzen'],river:['≋','Fluss'],road:['╱','Weg'],place:['⚑','Ort'],measure:['↔','Messen'],district:['▧','Viertel'],plaza:['□','Platz'],water:['≈','Wasser'],wall:['▥','Wand'],building:['⌂','Haus'],'room-rectangle':['▭','Raum'],'room-polygon':['⬠','Freier Raum'],'room-cave':['◒','Höhle'],'room-erase':['◐','Radieren'],'room-hole':['◯','Aussparung'],door:['⊓','Tür / Portal'],stairs:['▤','Treppe'],light:['☼','Licht'],object:['♧','Objekt'],scatter:['⁙','Streuen'],path:['╱','Pfad'],terrain:['▧','Terrain'],roof:['⌂','Dach'],text:['T','Text'],feature:['◇','Feature']};

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
 private toolSettingsVisible=true;
 private sectionSelect=document.createElement('select');
 private groups=document.createElement('nav');
 private toolList=document.createElement('div');
 private groupMemory=new Map<Section,string>();
 private toolMemory=new Map<string,string>();
 private changingTool=false;
 private toolSettings=document.createElement('aside');
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
 constructor(private root:HTMLElement,private host:{exit:()=>Promise<void>;prepare:()=>Promise<boolean>;tool:(family:Family,id:string,value:string,settings?:Readonly<Record<string,string>>)=>Promise<boolean>;navigation:(pan:boolean)=>Promise<void>;error:(e:unknown)=>void}){
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
  const rail=document.createElement('nav');rail.id='atlas-tool-rail';rail.setAttribute('aria-label','Werkzeugleiste');
  families.hidden=true;
  const area=document.createElement('label');area.className='atlas-section-field';area.textContent='Bereich';
  this.sectionSelect.id='atlas-section';this.sectionSelect.setAttribute('aria-label','Atlasbereich');
  for(const [value,label]of Object.entries(atlasSections)){const option=document.createElement('option');option.value=value;option.textContent=label;this.sectionSelect.append(option);}
  this.sectionSelect.onchange=()=>{const section=this.sectionSelect.value as Section;this.sectionSelect.value=this.family;void this.chooseSection(section);};area.append(this.sectionSelect);
  this.groups.id='atlas-tool-groups';this.groups.setAttribute('aria-label','Werkzeuggruppen');
  this.toolList.id='atlas-group-tools';this.toolList.className='atlas-tool-buttons';this.toolList.setAttribute('aria-label','Werkzeuge');
  const main=document.createElement('div');main.className='atlas-dock-body';
  const toolHeading=document.createElement('div');toolHeading.className='atlas-tool-heading';
  const activeTool=document.createElement('strong');activeTool.id='atlas-active-tool';activeTool.setAttribute('aria-live','polite');
  toolHeading.append(activeTool);main.append(this.tools,el('atlas-edit-panel'));
  const more=button('atlas-more-options','Mehr Optionen');more.hidden=true;more.onclick=()=>void this.requestContext('library','Objekte wählen',[el('drawing-tool-options')]);this.tools.append(more);
  this.toolSettings.id='atlas-tool-settings';this.toolSettings.setAttribute('aria-label','Werkzeugeinstellungen');this.toolSettings.append(area,this.toolList,toolHeading,main);
  const dock=el('atlas-panel');this.palette.id='atlas-tool-palette';rail.append(families,this.groups,this.palette);dock.append(rail,this.toolSettings);
  this.tools.append(el('atlas-tool-fields'));
  this.selection.append(el('atlas-selection-title'));
  el('atlas-hint').classList.add('atlas-editor-hint');main.append(el('atlas-hint'));
  try{const p=JSON.parse(localStorage.getItem('atlas-editor-layout-v4')??localStorage.getItem('atlas-editor-layout-v3')??'null');if(p){this.width=Math.max(220,Math.min(360,Number(p.width)||240));this.detailWidth=Math.max(280,Math.min(480,Number(p.detailWidth)||340));this.root.dataset.collapsed=String(p.collapsed===true);this.toolSettingsVisible=true;}}catch{/* optional preference */}
  this.resizer(this.toolSettings,'atlas-panel-width','Werkzeugeinstellungen verbreitern',false);
  this.resizer(this.secondary,'atlas-details-width','Kontextleiste verbreitern',true);
  initAtlasUnits(document);
  this.createHeader();
  document.addEventListener('keydown',this.keyHandler,true);
  new ResizeObserver(()=>this.applyWidth()).observe(this.root);
  document.addEventListener('atlas-key-panel',()=>{if(this.active)this.openContext('key','Raumbeschreibung',[el('key-dialog')]);});
  el('key-dialog').addEventListener('close',()=>{if(this.auxiliary==='key')this.clearContext();});
  this.root.addEventListener('change',e=>{
   const input=e.target as HTMLSelectElement;
   if(!this.changingTool&&input.id==='drawing-tool'&&['object','scatter'].includes(input.value))void this.requestContext('library','Objekte wählen',[el('drawing-tool-options')]);
   else if(input.id==='drawing-tool'&&this.auxiliary==='library'&&!['object','scatter'].includes(input.value))this.clearContext();
   this.sync();
  });
  this.applyWidth();
 }
 private move(node:HTMLElement,target:HTMLElement,list:HTMLElement[]){
  if(!this.slots.has(node)){const slot=document.createComment('Atlas control: '+node.id);node.before(slot);this.slots.set(node,slot);}
  target.append(node);if(!list.includes(node))list.push(node);
 }
 private restore(nodes:HTMLElement[]){for(const node of [...nodes].reverse()){const slot=this.slots.get(node);if(slot?.parentNode){slot.replaceWith(node);this.slots.delete(node);}}nodes.length=0;}
 private saveLayout(){try{localStorage.setItem('atlas-editor-layout-v4',JSON.stringify({width:this.width,detailWidth:this.detailWidth,toolsOpen:this.toolSettingsVisible,collapsed:this.root.dataset.collapsed==='true'}));}catch{/* optional preference */}}
 private resizer(parent:HTMLElement,id:string,label:string,right:boolean){
  const handle=document.createElement('div');handle.id=id;handle.className='atlas-resizer';handle.tabIndex=0;handle.role='separator';handle.setAttribute('aria-label',label);handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-valuemin',String(right?280:220));handle.setAttribute('aria-valuemax',String(right?480:360));parent.append(handle);
  const change=(value:number)=>{if(right)this.detailWidth=Math.max(280,Math.min(480,value));else this.width=Math.max(220,Math.min(360,value));this.applyWidth();this.saveLayout();};
  handle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const old=right?this.detailWidth:this.width;change(e.key==='Home'?(right?280:220):e.key==='End'?(right?480:360):old+(e.key==='ArrowRight'?1:-1)*(right?-10:10));};
  let drag:{id:number;x:number;width:number}|null=null;
  handle.onpointerdown=e=>{if(e.button)return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,width:right?this.detailWidth:this.width};handle.setPointerCapture(e.pointerId);};
  handle.onpointermove=e=>{if(drag?.id===e.pointerId)change(drag.width+(e.clientX-drag.x)*(right?-1:1));};
  const end=()=>{drag=null;};handle.onpointerup=end;handle.onpointercancel=end;handle.onlostpointercapture=end;
 }
 private railButton(node:HTMLElement,symbol:string,label:string){
  const icon=document.createElement('span');icon.className='atlas-tool-icon';icon.setAttribute('aria-hidden','true');icon.textContent=symbol;
  const caption=document.createElement('span');caption.className='atlas-tool-label';caption.textContent=label;
  node.replaceChildren(icon,caption);node.title=node.getAttribute('aria-label')??label;node.setAttribute('aria-label',node.title);node.classList.add('atlas-rail-button');
 }
 private showToolSettings(open:boolean){this.toolSettingsVisible=open;if(open)this.root.dataset.collapsed='false';this.applyWidth();this.saveLayout();}
 private symbol(node:HTMLElement,text:string,label:string){node.textContent=text;node.title=label;node.setAttribute('aria-label',label);node.classList.add('atlas-icon-button');return node;}
 private popup(node:HTMLElement,id:string,trigger:HTMLButtonElement,width:number){node.id=id;node.setAttribute('popover','auto');node.className='atlas-popup';document.body.append(node);const api=bindAnchoredPopup(trigger,node,width);trigger.onclick=()=>api.toggle();this.popups.push(api);return api;}
 private createHeader(){
  const header=this.root.querySelector<HTMLElement>('.atlas-command-bar')!;
  header.querySelector('strong')!.remove();
  const manage=document.createElement('div'),navigate=document.createElement('div');manage.className='atlas-header-management';navigate.className='atlas-header-navigation';
  const nav=button('atlas-navigation','Atlas ▾'),view=button('atlas-view','Ansicht ▾'),imports=button('atlas-import','Import ▾'),status=button('atlas-status','Gesichert');
  const menu=this.popup(this.menu,'atlas-navigation-popup',nav,300);this.popup(this.viewMenu,'atlas-view-popup',view,300);this.popup(this.importMenu,'atlas-import-popup',imports,290);this.popup(this.notices,'atlas-status-popup',status,380);
  this.menu.onclick=e=>{if((e.target as Element).closest('button'))menu.close();};
  const display=button('atlas-display','Darstellung ▾'),displayMenu=document.createElement('div');
  this.popup(displayMenu,'atlas-display-popup',display,300);
  displayMenu.append(el('land-relief-style'),el('land-contours').closest('label')!);
  const exit=button('atlas-exit','Atlas verlassen');exit.onclick=()=>void this.host.exit().catch(this.host.error);this.menu.append(exit);
  const search=el('atlas-search').closest('label')!;search.classList.add('atlas-header-search');search.firstChild!.textContent='';el<HTMLInputElement>('atlas-search').placeholder='Ort, Haus oder Raum suchen';el('atlas-search').setAttribute('aria-label','Ort finden');
  const pick=button('atlas-select',''),pan=button('atlas-pan',''),measure=button('atlas-measure','');this.symbol(measure,'↔','Messen');measure.onclick=()=>void this.activateTool('terrain',null,{id:'measure',label:'Messen',icon:'↔',control:'land-tool',value:'measure'});this.symbol(pick,'↖','Auswahl');this.symbol(pan,'✥','Hand');
  pick.onclick=()=>void this.select();pan.onclick=()=>void this.host.navigation(true).catch(this.host.error);
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
  const players=button('atlas-player-open-controls','Spieleranzeige');players.onclick=()=>el('player-open-controls').click();
  const unitLabel=document.createElement('label');unitLabel.className='atlas-units-control';unitLabel.textContent='Maße ';
  const unitSelect=document.createElement('select');unitSelect.id='atlas-units';unitSelect.setAttribute('aria-label','Maßeinheiten');
  unitSelect.innerHTML='<option value="dnd">DnD</option><option value="metric">Metrisch</option>';unitSelect.value=atlasUnits();
  unitSelect.onchange=()=>{if(!setAtlasUnits(unitSelect.value as 'dnd'|'metric'))unitSelect.value=atlasUnits();};unitLabel.append(unitSelect);
  document.addEventListener('atlas-units-changed',()=>{unitSelect.value=atlasUnits();});
  this.viewMenu.append(players,el('atlas-reference-open'));
  manage.append(unitLabel,nav,search,view,display,imports,el('atlas-output-open'),status,toggle);
  controls.replaceChildren(camera[2]!,camera[3]!,camera[0]!,camera[1]!,camera[4]!);navigate.append(el('atlas-undo'),el('atlas-redo'),pick,pan,measure,controls,el('atlas-overview'));
  header.append(manage,navigate);
  // The shell keeps runtime controls. They never enter an editor popup.
  el('atlas-to-party').classList.add('atlas-runtime-control');
  const observer=new MutationObserver(()=>{
   const campaign=el('campaign-header-name').textContent??'';text(nav,campaign?'Atlas · '+campaign+' ▾':'Atlas ▾');nav.title=campaign?'Kampagne: '+campaign:'Atlas';
   const pending=!el('atlas-recover').hidden||!el('commit-pending').hidden||!el('error-actions').hidden||!el('backup-status').hidden||!el('world-write-recovery').hidden;
   const failed=pending||el('atlas-save-status').dataset.error==='true'||el('status').dataset.error==='true';
   const message=el('atlas-save-status').textContent||el('status').textContent||'Gesichert';
   text(status,failed?'Speicherstand prüfen':message.startsWith('Kartenausschnitt')?'Gesichert':message);status.title=message;status.dataset.error=String(failed);status.setAttribute('aria-label','Status: '+status.textContent);
  });
  for(const id of ['campaign-header-name','status','atlas-save-status','atlas-recover','commit-pending','error-actions','backup-status','world-write-recovery','graph-preview-banner'])observer.observe(el(id),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','data-error']});
  el('atlas-search-results').classList.add('atlas-search-popup');
 }
 setActive(active:boolean){
  if(this.active===active)return;this.active=active;document.body.classList.toggle('atlas-workspace',active);
  if(active){
   for(const id of ['campaign-header-name','rename-campaign','new-campaign','campaign-manager','application-settings','help'])this.move(el(id),this.menu,this.shellNodes);
   this.move(el('workspace-navigation'),this.menu,this.shellNodes);
   el<HTMLDetailsElement>('workspace-nav-menu').open=true;
   this.move(el('import'),this.importMenu,this.shellNodes);
   for(const id of ['status','commit-pending','error-actions','backup-status','world-write-recovery','graph-preview-banner','atlas-save-status'])this.move(el(id),this.notices,this.shellNodes);
   const party=el('party-popover');if(party.matches(':popover-open'))party.hidePopover();
  }else{for(const p of this.popups)p.close();if(this.auxiliary==='key')el('key-close').click();this.restore(this.shellNodes);this.contextVisible=false;this.applyWidth();}
  document.dispatchEvent(new Event('workspace-layout-changed'));
 }
 private applyWidth(){
  const output=this.auxiliary==='output'&&this.contextVisible;
  const collapsed=this.root.dataset.collapsed==='true';
  const preferredLeft=output||collapsed?0:48+(this.toolSettingsVisible?this.width:0);
  // A selection needs its geometry beside its properties, not a second tool palette.
  const compact=this.contextVisible&&this.auxiliary==='selection'&&this.root.clientWidth>0&&this.root.clientWidth-preferredLeft-this.detailWidth<560;
  const toolsOpen=this.toolSettingsVisible&&!compact;
  const left=output||collapsed?0:48+(toolsOpen?this.width:0);
  const details=compact?Math.min(this.detailWidth,Math.max(280,Math.floor(this.root.clientWidth*.45))):this.detailWidth;
  this.root.style.setProperty('--atlas-dock-width',this.width+'px');this.root.style.setProperty('--atlas-details-width',details+'px');
  this.root.dataset.compactSelection=String(compact);
  this.root.dataset.toolsOpen=String(toolsOpen);this.toolSettings.hidden=!toolsOpen;
  this.root.style.setProperty('--atlas-left-space',left+'px');
  this.root.dataset.secondary=String(this.contextVisible);
  this.root.dataset.overlay=String(!compact&&this.root.clientWidth-left-details<560);
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
 output(open:boolean){if(open){this.releaseDescription();this.openContext('output','Exportieren',[el('atlas-output')]);}else if(this.auxiliary==='output')this.clearContext();}
 // Compatibility for domain callers: selection never replaces the tool panel.
 showPane(pane:'tool'|'selection'){if(pane==='selection')this.openSelection();else this.showToolSettings(true);}
 private openSelection(){this.openContext('selection','Eigenschaften',[this.selection]);}
 /** Selection controls follow the selected record, not the first tool sharing "select". */
 landscapeSelectionChanged(id:string,kind:import('./atlas-landscape').LandscapeRecord['kind']){
  this.groupMemory.set('terrain',kind==='vegetation'?'vegetation':'objects');
  this.renderGroups();this.sync();this.selectionChanged('landscape:'+id,true);
 }
 selectionChanged(key:string|null,explicit=false,reveal=true){if(key===this.selectionKey&&!explicit)return;this.selectionKey=key;if(key&&reveal)this.openSelection();else if(!key&&this.auxiliary==='selection')this.clearContext();}
 beforeTool(){if(this.auxiliary&&this.auxiliary!=='key'&&this.auxiliary!=='selection')this.clearContext();}
 setFamily(family:Family){
  if(family==='travel')return;
  const section:Section=family==='navigation'?this.family:family==='decoration'?'interior':family;
  if(section===this.family&&this.familyNodes.length){this.sync();return;}
  if(this.auxiliary!=='key')this.clearContext();this.restore(this.familyNodes);this.family=section;this.selectionKey=null;this.root.dataset.editorSection=section;
  this.root.querySelectorAll('[data-family-action]').forEach(n=>n.remove());this.selection.querySelectorAll('[data-family-action]').forEach(n=>n.remove());
  this.root.querySelectorAll<HTMLElement>('[data-tool-buttons]').forEach(n=>n.hidden=true);
  const add=(node:HTMLElement|null,target=this.tools)=>{if(node)this.move(node,target,this.familyNodes);};
  add(el('atlas-placement'),this.selection);
  if(section==='terrain'){
   add(el('atlas-landscape-tools'));add(el('land-selection'),this.selection);
   const template=button('atlas-template-open','');this.railButton(template,'▧','Vorlage');template.onclick=()=>void this.requestContext('reference-image','Nachzeichenvorlage',[el('land-reference').closest('details')!]);template.dataset.familyAction='true';this.palette.append(template);
   el('land-reference').closest('details')!.classList.add('atlas-extra-only');

  }
  if(section==='city'){
   this.railButton(el('atlas-create-city'),'⊕','Stadt anlegen');add(el('atlas-create-city'),this.palette);add(el('city-tool').closest('label'));add(el('city-draw-width').closest('label'));add(el('city-path-hint'));add(el('city-finish').parentElement);
   add(el('city-inspector'),this.selection);add(el('city-empty'));add(el('city-count'),this.selection);add(el('city-demographics'),this.selection);add(el('city-factions'),this.selection);
   const extra=document.createElement('details');extra.dataset.familyAction='true';extra.innerHTML='<summary>Stadtdarstellung und Ausgabe</summary>';this.selection.append(extra);
   for(const id of ['city-export-svg','city-export-json'])add(el(id),extra);add(el('city-paper').closest('details'),extra);el('city-paper').closest('label')!.hidden=true;
  }
  if(section==='interior'){
   add(el('atlas-floor-field'));this.railButton(el('atlas-create-dungeon'),'⊕','Raumgruppe anlegen');add(el('atlas-create-dungeon'),this.palette);add(el('atlas-connect-entrance'),this.selection);
   for(const id of ['drawing-element-size-field','drawing-light-radius-field','drawing-text-field'])add(el(id),el('drawing-toolbar'));
   el('drawing-tool-options').classList.add('atlas-extra-only');
   el('key-open').textContent='Beschreibung bearbeiten…';add(el('key-open'),this.selection);add(el('empty'),this.selection);add(el('editor'),this.selection);
   for(const node of [...el('inspector').querySelector('.drawing-tools')!.children] as HTMLElement[])add(node,this.selection);
   const analysis=document.createElement('section');analysis.id='atlas-room-analysis';analysis.dataset.familyAction='true';this.tools.append(analysis);analysis.className='atlas-extra-only';
   for(const id of ['search','rooms','add-room','dungeon-binder-open','graph-open','volume-open','trigger-fields-open','dungeon-content-open','path-open','drawing-show-section','drawing-slice-y','drawing-section'])add(el(id).matches('input')&&id.startsWith('drawing-')?el(id).closest('label'):el(id),analysis);
   const open=button('atlas-analysis-open','');this.railButton(open,'▤','Analyse');open.dataset.familyAction='true';open.onclick=()=>void this.requestContext('analysis','Räume und Analyse',[analysis]);this.palette.append(open);
  }
  this.renderGroups();this.sync();
 }
 private catalog(section=this.family){return availableAtlasGroups(this.root.ownerDocument,section);}
 private currentGroup(groups=this.catalog()):AtlasToolGroup|undefined{return groups.find(g=>g.id===this.groupMemory.get(this.family))??groups[0];}
 private renderGroups(groups=this.catalog()){
  const active=this.currentGroup(groups);this.sectionSelect.value=this.family;
  this.groups.replaceChildren();
  for(const group of groups){const b=button('','');this.railButton(b,group.icon,group.label);b.dataset.toolGroup=group.id;b.setAttribute('aria-pressed',String(group===active));b.disabled=this.changingTool;b.onclick=()=>void this.chooseGroup(this.family,group);this.groups.append(b);}
  this.renderTools(active);
 }
 private renderTools(group=this.currentGroup()){
  this.toolList.replaceChildren();this.toolList.dataset.group=group?.id??'';
  for(const tool of group?.tools??[]){const b=button('','');this.railButton(b,tool.icon,tool.label);b.dataset.atlasTool=tool.id;b.dataset.toolSelect=tool.control;b.dataset.toolValue=tool.value;b.onclick=()=>void this.activateTool(this.family,group!.id,tool);this.toolList.append(b);}
  for(const id of ['land-tool','city-tool','drawing-tool','land-color-target','land-freshwater-operation'])el(id)?.closest('label')?.classList.add('atlas-native-tool-select');
 }
 private async select(){
  if(this.family==='interior')await this.activateTool('interior',null,{id:'select',label:'Auswahl',icon:'↖',control:'drawing-tool',value:'select'});
  else await this.host.navigation(false).catch(this.host.error);
 }
 private async chooseSection(section:Section){
  const groups=this.catalog(section),group=groups.find(g=>g.id===this.groupMemory.get(section))??groups[0];
  if(group)await this.chooseGroup(section,group);
 }
 private async chooseGroup(section:Section,group:AtlasToolGroup){
  const tool=group.tools.find(t=>t.id===this.toolMemory.get(section+':'+group.id))??group.tools[0];
  if(tool)await this.activateTool(section,group.id,tool);
 }
 private async activateTool(section:Section,group:string|null,tool:AtlasTool){
  if(this.changingTool)return;
  const focus=this.root.ownerDocument.activeElement as HTMLElement|null;
  const focusKind=focus===this.sectionSelect?'section':focus?.dataset.toolGroup?'group':focus?.dataset.atlasTool?'tool':null;
  this.changingTool=true;this.sync();
  try{
   if(!await this.host.tool(section,tool.control,tool.value,tool.settings))return;
   if(group){this.groupMemory.set(section,group);this.toolMemory.set(section+':'+group,tool.id);}
   if(this.auxiliary==='selection'&&(this.root.dataset.compactSelection==='true'||section==='interior'&&tool.id==='room-rectangle'))this.hideContext();
   this.renderGroups();this.showToolSettings(true);
   if(tool.panel==='library')await this.requestContext('library','Objekte wählen',[el('drawing-tool-options')]);
   if(tool.panel==='generation')await this.openGeneration();
  }catch(error){this.host.error(error);}finally{
   this.changingTool=false;this.sync();
   // Rebuilt buttons must not strand keyboard focus, but a domain tool may deliberately focus its name field.
   const active=this.root.ownerDocument.activeElement;
   if(focusKind&&(!active||active===this.root.ownerDocument.body||active===focus)){
    const target=focusKind==='section'?this.sectionSelect:focusKind==='group'?this.groups.querySelector<HTMLElement>('button[aria-pressed=true]'):this.toolList.querySelector<HTMLElement>('button[aria-pressed=true]');
    target?.focus({preventScroll:true});
   }
  }
 }
 private async openGeneration(){const nodes:HTMLElement[]=[];for(const id of ['city-district','city-seed','city-density','city-size','city-reach','city-use'])nodes.push(el(id).closest('label')!);for(const id of ['city-generate','city-cancel-preview','city-preview-summary','city-preview-actions'])nodes.push(el(id));await this.requestContext('generation','Viertel bebauen',nodes);}
 sync(){
  if(!this.active)return;
  el('atlas-floor-field').hidden=this.family!=='interior';
  const name=el('atlas-new-name').closest('label')!;
  if(this.family!=='terrain')name.hidden=(this.family==='city'&&this.root.dataset.citySelected==='true'&&!this.root.dataset.placing)||(this.family==='interior'&&!this.root.dataset.placing);
  if(this.family==='city'){const tool=el<HTMLSelectElement>('city-tool').value;el('city-draw-width').closest('label')!.hidden=!['road','wall'].includes(tool);const count=Number(el('city-path-hint').textContent?.match(/^(\d+) Punkte/)?.[1]??0);el('city-finish').hidden=!count;el('city-cancel-path').hidden=!count;}
  if(this.family!=='terrain'){el('atlas-terrain').closest('label')!.hidden=true;if(this.auxiliary!=='grid')el('atlas-hex-level').closest('label')!.hidden=true;}
  const navigating=this.root.dataset.family==='navigation'||this.root.dataset.panMode==='true';
  this.tools.hidden=navigating&&!this.root.dataset.placing;
  const selectId=this.family==='terrain'?'land-tool':this.family==='city'?'city-tool':'drawing-tool';
  const tool=el<HTMLSelectElement>(selectId);
  const measuring=!navigating&&this.family==='terrain'&&tool.value==='measure';
  const groups=this.catalog();
  const remembered=this.currentGroup(groups);
  const matches=groups.flatMap(group=>group.tools.filter(t=>!t.panel||t.panel!=='generation').filter(t=>atlasToolMatches(this.root.ownerDocument,t)).map(t=>({group,tool:t})));
  const match=!navigating&&!measuring?matches.find(m=>m.group.id===remembered?.id)??matches[0]:undefined;
  if(!this.changingTool&&match){
   this.groupMemory.set(this.family,match.group.id);this.toolMemory.set(this.family+':'+match.group.id,match.tool.id);
   if(this.toolList.dataset.group!==match.group.id)this.renderGroups(groups);
  }
  this.sectionSelect.value=this.family;this.sectionSelect.disabled=this.changingTool;
  // Availability is a snapshot of this update, shared by every group/button.
  // Re-read it next time so changed domain options remain discoverable.
  const activeGroup=this.currentGroup(groups);
  for(const b of this.groups.querySelectorAll<HTMLButtonElement>('button')){b.disabled=this.changingTool;pressed(b,b.dataset.toolGroup===activeGroup?.id);}
  const objectSelection=!navigating&&this.family==='terrain'&&tool.value==='select'&&activeGroup?.id==='objects';
  el('vegetation-selection-filter').closest('label')!.hidden=navigating||this.family!=='terrain'||tool.value!=='select'||activeGroup?.id!=='vegetation';
  el('land-cursor-height').hidden=objectSelection;
  el('land-sea-options').hidden=navigating||this.family!=='terrain';
  for(const b of this.toolList.querySelectorAll<HTMLButtonElement>('button')){
   const entry=activeGroup?.tools.find(t=>t.id===b.dataset.atlasTool);b.disabled=this.changingTool||!!(entry&&el<HTMLSelectElement>(entry.control).disabled);
   pressed(b,!navigating&&!!entry&&(entry.panel==='generation'?this.auxiliary==='generation':atlasToolMatches(this.root.ownerDocument,entry)));
  }
  const more=el<HTMLButtonElement>('atlas-more-options');more.hidden=navigating||this.family!=='interior'||!['object','scatter'].includes(tool.value);
  pressed(el('atlas-measure'),measuring);
  text(el('atlas-active-tool'),this.root.dataset.placing?(this.family==='city'?'Stadt anlegen':'Raumgruppe anlegen'):navigating?(this.root.dataset.panMode==='true'?'Hand':'Auswahl'):(match?.tool.label??toolNames[tool.value]?.[1]??tool.selectedOptions[0]?.textContent??'Werkzeug'));
  pressed(el('atlas-select'),(navigating||this.family==='interior'&&tool.value==='select')&&this.root.dataset.panMode!=='true');pressed(el('atlas-pan'),this.root.dataset.panMode==='true');
 }
}
