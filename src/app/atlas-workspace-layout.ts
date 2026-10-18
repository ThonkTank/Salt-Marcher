import {bindAnchoredPopup} from './anchored-popup';

type Family='navigation'|'terrain'|'city'|'interior'|'decoration'|'travel';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const button=(id:string,text:string)=>{const b=document.createElement('button');b.id=id;b.type='button';b.textContent=text;return b;};
/** Presentation ownership only: move the original controls, never copy their data or handlers. */
export class AtlasWorkspaceLayout {
 private active=false;
 private family:Family='navigation';
 private slots=new Map<HTMLElement,Comment>();
 private familyNodes:HTMLElement[]=[];
 private shellNodes:HTMLElement[]=[];
 private extraNodes:HTMLElement[]=[];
 private auxiliary:string|null=null;
 private selected=false;
 private popups:ReturnType<typeof bindAnchoredPopup>[]=[];
 private narrow=matchMedia('(max-width:1099px)');
 private width=280;
 readonly tools=document.createElement('section');
 readonly selection=document.createElement('section');
 private secondary=document.createElement('aside');
 private secondaryContent=document.createElement('div');
 private tabs=document.createElement('div');
 private context=document.createElement('div');
 private menu=document.createElement('div');
 private more=document.createElement('div');
 private music=document.createElement('div');
 private notices=document.createElement('div');
 constructor(private root:HTMLElement){
  this.root.dataset.pane='tool';
  const bar=el('atlas-families');
  const dock=el('atlas-panel');
  this.tools.id='atlas-workspace-tools';this.selection.id='atlas-workspace-selection';
  this.tabs.className='atlas-dock-tabs';
  for(const [id,label,pane]of [['atlas-dock-tool','Werkzeug','tool'],['atlas-dock-selection','Auswahl','selection']] as const){const b=button(id,label);b.onclick=()=>this.showPane(pane);this.tabs.append(b);}
  const handle=document.createElement('input');handle.type='range';handle.min='280';handle.max='400';handle.step='10';handle.id='atlas-panel-width';handle.setAttribute('aria-label','Breite der Werkzeugleiste');
  try{const w=Number(localStorage.getItem('atlas-panel-width'));if(w>=280&&w<=400)this.width=w;}catch{/* optional preference */}
  handle.value=String(this.width);handle.oninput=()=>{this.width=Number(handle.value);this.applyWidth();try{localStorage.setItem('atlas-panel-width',handle.value);}catch{/* optional preference */}};
  const collapse=button('atlas-dock-collapse','Werkzeuge einklappen');collapse.onclick=()=>this.collapse(true);
  const main=document.createElement('div');main.className='atlas-dock-body';
  main.append(this.tabs,this.tools,this.selection,el('atlas-edit-panel'),el('atlas-output'));
  dock.append(bar,main,handle,collapse);
  this.context.className='atlas-map-context';
  const view=el('atlas-room-view');view.append(el('atlas-perception').closest('label')!);
  this.context.append(el('atlas-selection-title'),el('atlas-floor-field'),view);
  this.root.querySelector('.atlas-stage')!.prepend(this.context);
  const restore=button('atlas-restore','Bedienung einblenden');restore.hidden=true;restore.onclick=()=>this.maximize(false);this.root.append(restore);
  const expand=button('atlas-dock-expand','Werkzeuge');expand.hidden=true;expand.onclick=()=>this.collapse(false);this.root.append(expand);
  this.secondary.id='atlas-secondary';this.secondary.setAttribute('aria-label','Zusätzlicher Arbeitsbereich');this.secondary.hidden=true;
  const close=button('atlas-secondary-close','Schließen');close.onclick=()=>{if(this.auxiliary==='key'){el<HTMLButtonElement>('key-close').click();}else this.closeExtra();};
  const heading=document.createElement('div');heading.className='atlas-secondary-heading';const title=document.createElement('strong');title.id='atlas-secondary-title';heading.append(title,close);
  this.secondaryContent.id='atlas-secondary-content';this.secondary.append(heading,this.secondaryContent);this.root.querySelector('.atlas-layout')!.append(this.secondary);
  this.narrow.addEventListener('change',()=>this.placeExtra());
  const footer=document.createElement('div');footer.className='atlas-workspace-footer';footer.append(el('atlas-hint'));this.root.append(footer);
  const cameraMenu=document.createElement('details');cameraMenu.id='atlas-camera-menu';cameraMenu.innerHTML='<summary>Ansicht / Zoom</summary>';cameraMenu.append(this.root.querySelector('.map-canvas-controls')!);footer.append(cameraMenu);
  this.createHeader();
  this.root.addEventListener('change',e=>{const target=e.target as HTMLElement;if(['drawing-tool','city-tool','land-tool'].includes(target.id)){this.showPane('tool');if(target.id==='drawing-tool'&&(target as HTMLSelectElement).value==='room-rectangle'&&!el('atlas-room-draw').hidden)el('atlas-room-draw').click();if(target.id==='drawing-tool'){const v=(target as HTMLSelectElement).value;if(['object','scatter'].includes(v))this.openExtra('library','Objekte wählen',[el('drawing-tool-options')]);else if(this.auxiliary==='library')this.closeExtra();}}});
  document.addEventListener('atlas-key-panel',()=>{if(this.active)this.openExtra('key','Raumbeschreibung',[el('key-dialog')]);});
  el('key-dialog').addEventListener('close',()=>{if(this.auxiliary==='key')this.closeExtra();});
  this.root.addEventListener('click',e=>{const target=(e.target as Element).closest('button');if(target?.id==='city-generate')this.openGeneration();});
  const selectionObserver=new MutationObserver(()=>{if(this.active&&this.family==='terrain'&&el('land-selection').childElementCount)this.showPane('selection');});selectionObserver.observe(el('land-selection'),{childList:true});
  this.applyWidth();this.showPane('tool');try{this.collapse(localStorage.getItem('atlas-panel-collapsed')==='true');}catch{/* optional preference */}
 }
 private move(node:HTMLElement,target:HTMLElement,list:HTMLElement[]){
  if(!this.slots.has(node)){const slot=document.createComment('Atlas control: '+node.id);node.before(slot);this.slots.set(node,slot);}
  target.append(node);if(!list.includes(node))list.push(node);
 }
 private restore(nodes:HTMLElement[]){for(const node of [...nodes].reverse()){const slot=this.slots.get(node);if(slot?.parentNode){slot.replaceWith(node);this.slots.delete(node);}}nodes.length=0;}
 private createHeader(){
  const header=this.root.querySelector<HTMLElement>('.atlas-command-bar')!;
  header.querySelector('strong')!.remove();
  const nav=button('atlas-navigation','☰ Atlas');const more=button('atlas-more','⋯');more.setAttribute('aria-label','Weitere Aktionen');const music=button('atlas-music','♫');music.setAttribute('aria-label','Musik und Soundboard');const status=button('atlas-status','Gesichert');status.setAttribute('aria-label','Speicherstatus und Meldungen');status.setAttribute('aria-live','polite');
  const max=button('atlas-maximize','⛶');max.setAttribute('aria-label','Karte maximieren');max.title='Karte maximieren';max.onclick=()=>this.maximize(true);
  for(const [popup,id,trigger,width]of [[this.menu,'atlas-navigation-popup',nav,300],[this.more,'atlas-more-popup',more,310],[this.music,'atlas-music-popup',music,380],[this.notices,'atlas-status-popup',status,400]] as const){popup.id=id;popup.setAttribute('popover','auto');popup.className='atlas-popup';document.body.append(popup);const api=bindAnchoredPopup(trigger,popup,width);trigger.onclick=()=>api.toggle();this.popups.push(api);}
  const search=el('atlas-search').closest('label')!;search.classList.add('atlas-header-search');search.firstChild!.textContent='';el<HTMLInputElement>('atlas-search').placeholder='Ort, Haus oder Raum suchen';el('atlas-search').setAttribute('aria-label','Ort finden');
  for(const id of ['atlas-undo','atlas-redo'])el(id).setAttribute('aria-label',el(id).textContent??id);
  el('atlas-output-open').textContent='Ausgabe';
  header.prepend(nav);header.append(status,music,more,el('atlas-output-open'),max);
  header.insertBefore(search,el('atlas-undo'));
  this.more.append(el('atlas-overview'),el('atlas-to-party'),el('atlas-scale'),el('atlas-region-retry'));
  this.notices.append(el('atlas-recover'));
  const output=button('atlas-more-output','Bild ausgeben…');output.onclick=()=>el('atlas-output-open').click();this.more.append(output);
  const observer=new MutationObserver(records=>{
   const changed=records.find(r=>r.target===el('status')||el('status').contains(r.target))?el('status'):el('atlas-save-status');
   const pending=!el('atlas-recover').hidden||!el('commit-pending').hidden||!el('error-actions').hidden||!el('backup-status').hidden||!el('world-write-recovery').hidden;
   status.textContent=pending?'Speicherstand prüfen':!el('graph-preview-banner').hidden?'Graphvorschau offen':changed.textContent||'Gesichert';status.title=status.textContent;status.setAttribute('aria-label','Status: '+status.textContent);
   status.dataset.error=String(pending||changed.dataset.error==='true'||el('status').dataset.error==='true');
   if(status.dataset.error==='true'&&this.root.dataset.maximized==='true')this.maximize(false);
  });
  for(const id of ['status','atlas-save-status','atlas-recover','commit-pending','error-actions','backup-status','world-write-recovery','graph-preview-banner'])observer.observe(el(id),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','data-error']});
  const sound=new MutationObserver(()=>{music.title=el('music-mini-title').textContent??'Musik';music.setAttribute('aria-label','Musik: '+music.title);});sound.observe(el('music-mini-title'),{childList:true,subtree:true});
  el('atlas-search-results').classList.add('atlas-search-popup');
 }
 setActive(active:boolean){
  if(this.active===active)return;this.active=active;
  document.body.classList.toggle('atlas-workspace',active);
  if(active){
   const header=this.root.querySelector<HTMLElement>('.atlas-command-bar')!;
   for(const id of ['campaign-screen-open','application-settings'])this.move(el(id),this.menu,this.shellNodes);
   this.move(el('workspace-navigation'),this.menu,this.shellNodes);el<HTMLDetailsElement>('workspace-nav-menu').open=true;
   for(const id of ['campaign-header-name','party-shortcut'])this.move(el(id),header,this.shellNodes);
   header.insertBefore(el('campaign-header-name'),el('atlas-search').closest('label'));
   header.insertBefore(el('party-shortcut'),el('atlas-music'));
   for(const node of [...el('workspace-tools-content').children] as HTMLElement[])this.move(node,this.more,this.shellNodes);
   for(const id of ['quick-reference-open','location-material-return','day-trigger','help'])this.move(el(id),this.more,this.shellNodes);
   for(const id of ['status','commit-pending','error-actions','backup-status','world-write-recovery','graph-preview-banner','atlas-save-status'])this.move(el(id),this.notices,this.shellNodes);
   this.move(el('music-mini'),this.music,this.shellNodes);
   this.menu.onclick=e=>{if((e.target as Element).closest('button'))this.popups[0]!.close();};
   this.more.onclick=e=>{if((e.target as Element).closest('button'))this.popups[1]!.close();};
  }else{
   for(const popup of this.popups)popup.close();if(this.auxiliary==='key')el<HTMLDialogElement>('key-dialog').close();this.maximize(false);this.closeExtra();this.restore(this.shellNodes);
   el<HTMLDetailsElement>('workspace-nav-menu').open=!matchMedia('(max-width:850px)').matches;
  }
  document.dispatchEvent(new Event('workspace-layout-changed'));
 }
 private applyWidth(){this.root.style.setProperty('--atlas-dock-width',this.width+'px');}
 private collapse(collapsed:boolean){this.root.dataset.collapsed=String(collapsed);el('atlas-dock-expand').hidden=!collapsed;try{localStorage.setItem('atlas-panel-collapsed',String(collapsed));}catch{/* optional preference */}}
 private maximize(maximized:boolean){this.root.dataset.maximized=String(maximized);el('atlas-restore').hidden=!maximized;if(!maximized)el('atlas-maximize').focus({preventScroll:true});}
 showPane(pane:'tool'|'selection'){
  this.root.dataset.pane=pane;this.tools.hidden=pane!=='tool';this.selection.hidden=pane!=='selection';
  el('atlas-dock-tool').setAttribute('aria-pressed',String(pane==='tool'));el('atlas-dock-selection').setAttribute('aria-pressed',String(pane==='selection'));
 }
 setFamily(family:Family){
  if(family!==this.family&&this.auxiliary!=='key')this.closeExtra();this.restore(this.familyNodes);this.family=family;
  this.selected=false;
  this.root.querySelectorAll<HTMLElement>('[data-tool-buttons]').forEach(n=>n.hidden=true);
  const add=(node:HTMLElement|null,target=this.tools)=>{if(node)this.move(node,target,this.familyNodes);};
  add(el('atlas-tool-fields'));add(el('atlas-context-fields'));add(el('atlas-placement'),this.selection);
  if(family==='navigation'){
   const actions=document.createElement('div');actions.className='atlas-tool-buttons';actions.dataset.familyAction='true';
   for(const [label,pan]of [['Auswahl',false],['Hand',true]] as const){const action=button('',label);action.setAttribute('aria-pressed',String(this.root.dataset.panMode===String(pan)));action.onclick=()=>{this.root.dataset.panMode=String(pan);for(const b of actions.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===action));};actions.append(action);}this.tools.prepend(actions);
  }
  if(family==='terrain'){add(el('atlas-landscape-tools'));add(el('land-selection'),this.selection);}
  if(family==='city'){
   add(el('atlas-create-city'));
   add(el('city-tool').closest('label'));add(el('city-draw-width').closest('label'));add(el('city-path-hint'));add(el('city-finish').parentElement);
   const generation=button('atlas-generation-open','Viertel bebauen…');generation.onclick=()=>this.openGeneration();this.tools.append(generation);generation.dataset.familyAction='true';
   add(el('city-inspector'),this.selection);add(el('city-empty'));add(el('city-count'),this.selection);add(el('city-demographics'),this.selection);add(el('city-factions'),this.selection);
   // Existing export and styling actions retain their original owners.
   const extra=document.createElement('details');extra.dataset.familyAction='true';extra.innerHTML='<summary>Stadtdarstellung und Ausgabe</summary>';this.selection.append(extra);
   for(const id of ['city-export-svg','city-export-json'])add(el(id),extra);
   add(el('city-paper').closest('details'),extra);
  }
  if(family==='interior'||family==='decoration'){
   add(el('atlas-create-dungeon'));
   el('key-open').textContent='Beschreibung bearbeiten…';add(el('key-open'),this.selection);add(el('empty'),this.selection);add(el('editor'),this.selection);
   for(const node of [...el('inspector').querySelector('.drawing-tools')!.children] as HTMLElement[])add(node,this.selection);
   const analysis=document.createElement('details');analysis.dataset.familyAction='true';analysis.innerHTML='<summary>Räume und Analyse</summary>';this.tools.append(analysis);
   for(const id of ['search','rooms','add-room','dungeon-binder-open','graph-open','volume-open','trigger-fields-open','dungeon-content-open','path-open','drawing-show-section','drawing-slice-y','drawing-section'])add(el(id).matches('input')&&id.startsWith('drawing-')?el(id).closest('label'):el(id),analysis);
  }
  if(family==='travel'){
   add(el('world-scene').closest('label'));add(el('world-current'));
   const travel=el('travel-mode-target').closest<HTMLElement>('.world-travel');add(travel);
   const details=document.createElement('details');details.dataset.familyAction='true';details.innerHTML='<summary>Welt, Wetter und Hexeigenschaften</summary>';this.selection.append(details);
   for(const node of [...el('world').children] as HTMLElement[])if(node.classList.contains('world-columns'))add(node,details);
   add(el('hex-form'),this.selection);add(el('world-marker-form'),this.selection);
  }
  this.tools.querySelectorAll('[data-family-action]').forEach(n=>{if((n as HTMLElement).dataset.familyAction==='stale')n.remove();else (n as HTMLElement).dataset.familyAction='stale';});
  this.toolButtons('land-tool');this.toolButtons('city-tool');this.toolButtons('drawing-tool');
  this.showPane('tool');
 }
 private toolButtons(id:string){
  const select=el<HTMLSelectElement>(id);if(!this.root.contains(select))return;
  let group=this.root.querySelector<HTMLElement>('[data-tool-buttons="'+id+'"]');
  if(!group){group=document.createElement('div');group.className='atlas-tool-buttons';group.dataset.toolButtons=id;group.setAttribute('aria-label',select.closest('label')?.textContent?.split('\n')[0]||'Werkzeug');
   for(const option of select.options){const b=button('',option.textContent??option.value);b.dataset.toolSelect=id;b.dataset.toolValue=option.value;b.onclick=()=>{const previous=select.value;select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));if(select.value!==previous)this.showPane('tool');sync();};group.append(b);}
   select.closest('label')!.after(group);select.closest('label')!.classList.add('atlas-native-tool-select');
   const sync=()=>{for(const b of group!.querySelectorAll<HTMLButtonElement>('button')){b.setAttribute('aria-pressed',String(b.dataset.toolValue===select.value));b.disabled=select.disabled;}};select.addEventListener('change',sync);sync();
  }
  if(group){group.hidden=false;select.closest('label')!.after(group);}
 }
 selectionChanged(selected:boolean){if(selected&&!this.selected)this.showPane('selection');this.selected=selected;}
 private openGeneration(){
  const nodes:HTMLElement[]=[];
  for(const id of ['city-district','city-seed','city-density','city-size','city-reach','city-use'])nodes.push(el(id).closest('label')!);
  for(const id of ['city-generate','city-cancel-preview','city-preview-summary','city-preview-actions'])nodes.push(el(id));
  this.openExtra('generation','Viertel bebauen',nodes);
 }
 private openExtra(kind:string,title:string,nodes:HTMLElement[]){
  if(this.auxiliary===kind)return;
  // A key's original close handler flushes its text; another task must not displace it.
  if(this.auxiliary==='key'&&el<HTMLDialogElement>('key-dialog').open)return;
  this.closeExtra();this.auxiliary=kind;this.root.dataset.task=kind;el('atlas-secondary-title').textContent=title;
  for(const node of nodes)this.move(node,this.secondaryContent,this.extraNodes);
  if(kind==='library')el<HTMLDetailsElement>('drawing-tool-options').open=true;
  this.placeExtra();
 }
 private closeExtra(){this.restore(this.extraNodes);this.auxiliary=null;delete this.root.dataset.task;this.secondary.hidden=true;this.root.dataset.secondary='false';this.root.querySelector('.atlas-layout')!.append(this.secondary);}
 private placeExtra(){
  if(!this.auxiliary)return;
  if(this.narrow.matches){this.tools.parentElement!.append(this.secondary);this.showPane('tool');}else this.root.querySelector('.atlas-layout')!.append(this.secondary);
  // The panel stays the same DOM subtree across breakpoints, including active text inputs.
  this.secondary.hidden=false;this.root.dataset.secondary=String(!this.narrow.matches);
 }
 sync(){
  if(!this.active)return;
  const nameField=el('atlas-new-name').closest('label')!;if(this.family!=='terrain')nameField.hidden=this.family==='travel'||(this.family==='city'&&this.root.dataset.citySelected==='true'&&!this.root.dataset.placing)||((this.family==='interior'||this.family==='decoration')&&this.root.dataset.roomDraw!=='true');
  if(this.family==='city'){const tool=el<HTMLSelectElement>('city-tool').value;el('city-draw-width').closest('label')!.hidden=!['road','wall'].includes(tool);const count=Number(el('city-path-hint').textContent?.match(/^(\d+) Punkte/)?.[1]??0);el('city-finish').hidden=!count;el('city-cancel-path').hidden=!count;}
  const name=el('atlas-selection-title').textContent??'';this.context.title=name;
  for(const id of ['land-tool','city-tool','drawing-tool']){const select=el<HTMLSelectElement>(id);for(const b of this.root.querySelectorAll<HTMLButtonElement>('[data-tool-select="'+id+'"]')){b.setAttribute('aria-pressed',String(b.dataset.toolValue===select.value));b.disabled=select.disabled;const decoration=['light','object','scatter','text','feature'].includes(b.dataset.toolValue??'');b.hidden=id==='drawing-tool'&&b.dataset.toolValue!=='select'&&(this.family==='decoration'?!decoration:decoration);}}
 }
}
