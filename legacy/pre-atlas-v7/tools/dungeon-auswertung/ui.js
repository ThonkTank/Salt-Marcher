/* Bundled after core.js by build.js; no runtime npm dependencies. */
const Core=module.exports;
const {setIcon,Plugin,Modal,Scope,Notice,MarkdownRenderChild,ItemView,parseYaml,editorInfoField,editorLivePreviewField}=require('obsidian');
const PROGRESSION='Dungeons/_System/Progression.json';
const fmt=n=>Number.isFinite(n)?n.toLocaleString('de-DE',{maximumFractionDigits:3}):'—';
function node(parent,tag,text,cls){const e=parent.ownerDocument.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;}
function button(parent,label,action){const b=node(parent,'button',label);b.type='button';b.onclick=()=>Promise.resolve(action()).catch(e=>new Notice(e.message));return b;}
function table(parent,headers,rows){const wrap=node(parent,'div',undefined,'dungeon-table-wrap'),t=node(wrap,'table'),head=node(t,'thead'),tr=node(head,'tr');headers.forEach(h=>node(tr,'th',h));const body=node(t,'tbody');for(const cells of rows){const row=node(body,'tr');for(const value of cells){const td=node(row,'td');if(typeof value==='function')value(td);else td.textContent=String(value??'');}}return t;}
class TextDialog extends Modal{
 constructor(app,title,initial,save,multiline=true){super(app);Object.assign(this,{title,initial,save,multiline});}
 onOpen(){node(this.contentEl,'h2',this.title);const field=node(this.contentEl,this.multiline?'textarea':'input');field.value=this.initial;field.className='dungeon-editor';button(this.contentEl,'Speichern',async()=>{await this.save(field.value);this.close();});}
 onClose(){this.contentEl.empty();}
}
class NewDungeonDialog extends Modal{
 constructor(plugin,quick=false){super(plugin.app);this.plugin=plugin;this.quick=quick;this.catalogAbort=new AbortController();}
 onOpen(){
  this.contentEl.classList.add('dungeon-create');node(this.contentEl,'h2','Neuer Dungeon');
  const form=node(this.contentEl,'form'),fields={};
  const field=(parent,key,label,value,type='number')=>{const row=node(parent,'label',label),input=fields[key]=node(row,'input');input.name=key;input.type=type;input.value=value;input.required=true;if(type==='number'){input.min='1';input.step='1';if(key==='level')input.max='20';}return input;};
  field(form,'name','Name','','text');
  node(form,'small','Standard: 35 × 20 Felder · 4 Spieler · Stufe 1.');
  const advanced=node(form,'details',undefined,'dungeon-create-advanced');advanced.open=!this.quick;node(advanced,'summary','Kartengröße, Gruppe und Materialpakete');
  const dimensions=node(advanced,'div',undefined,'dungeon-create-pair');field(dimensions,'width','Breite in Feldern',35);field(dimensions,'height','Höhe in Feldern',20);
  const formats=node(advanced,'div'),formatLabel=node(formats,'label','Größenvorlage'),format=node(formatLabel,'select');format.setAttribute('aria-label','Größenvorlage');format.disabled=true;
  const formatActions=node(formats,'div',undefined,'dungeon-controls'),formatName=node(formatActions,'input');formatName.type='text';formatName.placeholder='Name der neuen Vorlage';formatName.setAttribute('aria-label','Vorlagenname');
  let templates=[],formatBusy=false;const drawFormats=(selected='')=>{format.replaceChildren();const custom=node(format,'option','Eigene Maße');custom.value='';for(const t of templates){const o=node(format,'option',t.name+' · '+t.width+' × '+t.height);o.value=t.id;}format.value=selected;removeFormat.disabled=!format.value;};
  const saveFormat=button(formatActions,'Maße speichern',async()=>{if(formatBusy)return;formatBusy=true;saveFormat.disabled=true;try{const t={id:Core.mapUUID(),name:formatName.value.trim(),width:Number(fields.width.value),height:Number(fields.height.value)};if(!t.name)throw Error('Vorlagennamen eingeben.');Core.planNewDungeon({name:'Formatprüfung',width:t.width,height:t.height});templates=await this.plugin.updateSizeTemplates(list=>{if(list.some(v=>v.name===t.name))throw Error('Eine Vorlage mit diesem Namen existiert bereits.');return [...list,t];});drawFormats(t.id);formatName.value='';}finally{formatBusy=false;saveFormat.disabled=false;}});
  const removeFormat=button(formatActions,'Vorlage entfernen',async()=>{if(formatBusy||!format.value)return;formatBusy=true;removeFormat.disabled=true;const id=format.value;try{templates=await this.plugin.updateSizeTemplates(list=>list.filter(t=>t.id!==id));drawFormats();}finally{formatBusy=false;removeFormat.disabled=!format.value;}});
  saveFormat.disabled=removeFormat.disabled=true;
  format.onchange=()=>{const t=templates.find(t=>t.id===format.value);if(t){fields.width.value=t.width;fields.height.value=t.height;}removeFormat.disabled=!t;};
  for(const input of [fields.width,fields.height])input.addEventListener('input',()=>{format.value='';removeFormat.disabled=true;});
  this.plugin.readSizeTemplates().then(list=>{if(!this.contentEl.isConnected)return;templates=list;drawFormats();format.disabled=saveFormat.disabled=false;}).catch(e=>new Notice(e.message));
  const party=node(advanced,'div',undefined,'dungeon-create-pair');field(party,'size','Spielerzahl',4);field(party,'level','Stufe',1);
  for(const [key,label]of [['wallShadow','Schatten für neue Wände'],['objectShadow','Schatten für neue Objekte']]){const row=node(advanced,'label'),input=fields[key]=node(row,'input');input.type='checkbox';input.name=key;input.checked=true;row.append(' '+label);}
  const wearLabel=node(advanced,'label','Gebäudeabnutzung'),wear=fields.buildingWear=node(wearLabel,'select');wear.name='buildingWear';wear.setAttribute('aria-label','Gebäudeabnutzung beim Start');for(const[value,label]of [['none','Keine'],['dust','Staub'],['grime','Schmutz'],['noise','Rauschen'],['scratched','Kratzer']]){const option=node(wear,'option',label);option.value=value;}
  const wizardRow=node(advanced,'label'),wizard=fields.wizard=node(wizardRow,'input');wizard.type='checkbox';wizardRow.append(' Mit Kartenassistent starten');
  const packageBox=node(advanced,'details'),packageTitle=node(packageBox,'summary','Materialpakete'),packageActions=node(packageBox,'div',undefined,'dungeon-controls'),packageList=node(packageBox,'div',undefined,'dungeon-create-packs');
  const defaultLabel=node(packageBox,'label'),defaultCheck=fields.disableDefaultAssets=node(defaultLabel,'input');defaultCheck.type='checkbox';defaultCheck.name='disableDefaultAssets';defaultCheck.disabled=true;defaultLabel.append(' Standardmaterialien ausblenden (Terrain bleibt verfügbar)');
  const catalog=this.plugin.assetCatalog();const catalogItem=record=>{try{return {metadata:record.metadata,file:catalog.file(record),selected:record.selected!==false};}catch(e){return {metadata:record.metadata,file:null,selected:false,error:e.message};}};
  let packages=[],readingPackages=true;const drawPackages=()=>{packageList.replaceChildren();packageTitle.textContent='Materialpakete · '+packages.filter(p=>p.selected).length+' ausgewählt';for(const item of packages){const row=node(packageList,'div'),label=node(row,'label'),check=node(label,'input');check.type='checkbox';check.checked=item.selected;check.disabled=!item.file;check.setAttribute('aria-label',item.metadata.name);label.append(' '+item.metadata.name);check.onchange=()=>{item.selected=check.checked;packageTitle.textContent='Materialpakete · '+packages.filter(p=>p.selected).length+' ausgewählt';};node(row,'small',item.error||[item.metadata.version&&'Version '+item.metadata.version,item.metadata.author].filter(Boolean).join(' · '));const actions=node(row,'div',undefined,'dungeon-create-pack-actions');button(actions,'Entfernen',()=>{packages=packages.filter(p=>p!==item);drawPackages();}).setAttribute('aria-label',item.metadata.name+' aus Auswahl entfernen');button(actions,'Aktualisieren …',()=>{if(readingPackages||this.working)return;const picker=document.createElement('input');picker.type='file';picker.accept='.dungeondraft_pack';picker.onchange=async()=>{if(!picker.files.length)return;readingPackages=true;submit.disabled=true;error.textContent='Paket wird aktualisiert …';try{const [record]=await catalog.add([picker.files[0]],{updateId:item.metadata.id,signal:this.catalogAbort.signal});if(this.contentEl.isConnected){const replacement=catalogItem(record);replacement.selected=item.selected&&!!replacement.file;packages=packages.map(p=>p===item?replacement:p);drawPackages();error.textContent='';}}catch(e){if(this.contentEl.isConnected)error.textContent=e.message;}finally{readingPackages=false;submit.disabled=this.working;}};picker.click();}).setAttribute('aria-label',item.metadata.name+' im Katalog aktualisieren');}if(!packages.length)node(packageList,'p','Noch keine Pakete ausgewählt.');};
  button(packageActions,'Pakete auswählen …',()=>{if(this.working||readingPackages)return;const picker=document.createElement('input');picker.type='file';picker.accept='.dungeondraft_pack';picker.multiple=true;picker.onchange=async()=>{if(!picker.files.length||!this.contentEl.isConnected)return;readingPackages=true;submit.disabled=true;error.textContent='Pakete werden im Katalog gespeichert …';try{const added=await catalog.add([...picker.files],{signal:this.catalogAbort.signal});if(this.contentEl.isConnected){for(const record of added){const item=catalogItem(record);item.selected=!!item.file;const at=packages.findIndex(p=>p.metadata.id===record.metadata.id);if(at>=0)packages[at]=item;else packages.push(item);}drawPackages();error.textContent='';}}catch(e){if(this.contentEl.isConnected)error.textContent=e.message;}finally{readingPackages=false;submit.disabled=this.working;}};picker.click();});
  button(packageActions,'Alle aktivieren',()=>{packages.forEach(p=>p.selected=!!p.file);drawPackages();});button(packageActions,'Alle deaktivieren',()=>{packages.forEach(p=>p.selected=false);drawPackages();});drawPackages();
  node(packageBox,'small','Hinzugefügte Pakete bleiben für weitere Dungeons im Katalog verfügbar.');
  const error=node(form,'p',undefined,'dungeon-warning');error.setAttribute('role','alert');
  const actions=node(form,'div',undefined,'dungeon-controls');const cancel=button(actions,'Abbrechen',()=>this.close());const submit=node(actions,'button','Dungeon erstellen');submit.type='submit';submit.className='mod-cta';
  form.onsubmit=async e=>{e.preventDefault();if(this.working||readingPackages)return;this.working=true;this.creationAbort=new AbortController();const options={...Object.fromEntries(Object.entries(fields).map(([k,f])=>[k,f.type==='checkbox'?f.checked:f.value])),packFiles:packages.filter(p=>p.selected).map(p=>p.file),catalogSelection:packages.filter(p=>p.selected).map(p=>p.metadata.id),signal:this.creationAbort.signal},controls=[...form.querySelectorAll('input,button,select')].filter(e=>e!==cancel).map(e=>[e,e.disabled]);for(const [e]of controls)e.disabled=true;error.textContent=options.packFiles.length?'Pakete werden vorbereitet …':'';try{const result=await this.plugin.createDungeon(options);this.close();await this.plugin.openCreatedDungeon(result);}catch(e){if(this.contentEl.isConnected)error.textContent=e.message;else if(e.name!=='AbortError')new Notice(e.message);}finally{this.working=false;for(const [e,disabled]of controls)e.disabled=disabled;}};
  submit.disabled=true;catalog.read().then(data=>{if(this.contentEl.isConnected){packages=data.packs.map(catalogItem);defaultCheck.checked=data.disableDefaultAssets===true;defaultCheck.disabled=false;drawPackages();}}).catch(e=>{if(this.contentEl.isConnected)error.textContent=e.message;}).finally(()=>{readingPackages=false;submit.disabled=this.working;});
  fields.name.focus();
 }
 onClose(){this.creationAbort?.abort();this.catalogAbort.abort();this.contentEl.empty();}
}
class OpenDungeonDialog extends Modal{
 constructor(plugin){super(plugin.app);this.plugin=plugin;this.entries=[];this.busy=false;}
 onOpen(){
  this.contentEl.classList.add('dungeon-open');node(this.contentEl,'h2','Dungeon öffnen');
  this.search=node(this.contentEl,'input');this.search.type='search';this.search.placeholder='Dungeon suchen …';this.search.setAttribute('aria-label','Dungeon suchen');this.search.oninput=()=>this.draw();
  this.list=node(this.contentEl,'div',undefined,'dungeon-open-list');node(this.list,'p','Dungeons werden gesucht …');
  this.load().catch(e=>{if(this.contentEl.isConnected){this.list.replaceChildren();node(this.list,'p','Dungeons konnten nicht geladen werden: '+e.message);}});
  this.search.focus();
 }
 async load(){
  const app=this.plugin.app,files=app.vault.getMarkdownFiles().filter(file=>/^Dungeons\/[^/]+\/[^/]+\.md$/.test(file.path)&&!file.path.startsWith('Dungeons/_System/'));
  const entries=[];
  for(const file of files){
   let dungeon=app.metadataCache.getFileCache(file)?.frontmatter?.dungeon;
   if(dungeon===undefined){try{dungeon=parseYaml(Core.frontmatter(await app.vault.cachedRead(file)))?.dungeon;}catch(_){continue;}}
   if(!dungeon)continue;
   const name=file.parent.name,map=file.parent.path+'/Karten/00 Gesamtplan.svg';
   entries.push({file,name,hasMap:!!app.vault.getAbstractFileByPath(map)});
  }
  if(!this.contentEl.isConnected)return;
  this.entries=entries.sort((a,b)=>a.name.localeCompare(b.name,'de'));this.draw();
 }
 draw(){
  if(!this.list)return;this.list.replaceChildren();const query=this.search.value.trim().toLocaleLowerCase('de');
  const matches=this.entries.filter(entry=>(entry.name+' '+entry.file.basename).toLocaleLowerCase('de').includes(query));
  for(const entry of matches){
   const row=node(this.list,'div',undefined,'dungeon-open-row'),label=node(row,'div',undefined,'dungeon-open-label');
   node(label,'strong',entry.name);if(entry.file.basename!==entry.name)node(label,'small',entry.file.basename);
   const actions=node(row,'div',undefined,'dungeon-controls');
   button(actions,'Öffnen',()=>this.openEntry(entry,false)).disabled=this.busy;
   const edit=button(actions,'Karte bearbeiten',()=>this.openEntry(entry,true));edit.disabled=this.busy||!entry.hasMap;
   if(!entry.hasMap)edit.title='Keine bearbeitbare Gesamtkarte vorhanden';
  }
  if(!matches.length)node(this.list,'p',this.entries.length?'Kein passender Dungeon.':'Keine Dungeonübersicht gefunden.');
 }
 async openEntry(entry,edit){
  if(this.busy)return;this.busy=true;this.draw();
  try{
   const file=this.plugin.app.vault.getAbstractFileByPath(entry.file.path);if(!file)throw Error('Die Dungeonübersicht ist nicht mehr vorhanden.');
   if(edit)await this.plugin.openMapEditor(file.path);
   else {
    const play=this.plugin.app.plugins.getPlugin('dnd-ot-spielansicht');
    if(play?.restoreLayout)await play.restoreLayout(file.path);
    else {
     const app=this.plugin.app,map=app.vault.getAbstractFileByPath(file.parent.path+'/Karten/00 Gesamtplan.svg');
     await app.workspace.getLeaf('tab').openFile(file,{state:{mode:'preview'}});
     if(map?.extension==='svg')await app.workspace.getLeaf('split').openFile(map);
    }
   }
   this.close();
  }catch(e){new Notice(e.message);}finally{this.busy=false;if(this.contentEl.isConnected)this.draw();}
 }
 onClose(){this.contentEl.empty();}
}
class PackageCatalogDialog extends Modal{
 constructor(plugin,editor=null){super(plugin.app);this.plugin=plugin;this.editor=editor;this.draft=editor?.draft;this.abort=new AbortController();this.selected=new Map();}
 onOpen(){this.contentEl.classList.add('dungeon-package-catalog');node(this.contentEl,'h2','Paketkatalog');node(this.contentEl,'p',this.editor?'Pakete in diese Kartenbibliothek übernehmen. Gezeichnete Elemente bleiben erhalten.':'Pakete verwalten und die Vorgabe für neue Dungeons wählen.');const controls=node(this.contentEl,'div',undefined,'dungeon-controls');this.search=node(controls,'input');this.search.type='search';this.search.placeholder='Pakete suchen …';this.search.setAttribute('aria-label','Katalog durchsuchen');this.search.oninput=()=>this.draw();button(controls,'Pakete hinzufügen …',()=>this.choose());this.rows=node(this.contentEl,'div',undefined,'dungeon-catalog-list');this.error=node(this.contentEl,'p',undefined,'dungeon-warning');this.error.setAttribute('role','alert');if(!this.editor){const label=node(this.contentEl,'label');this.defaultCheck=node(label,'input');this.defaultCheck.type='checkbox';this.defaultCheck.setAttribute('aria-label','Standardmaterialien für neue Dungeons ausblenden');label.append(' Standardmaterialien ausblenden (Terrain bleibt verfügbar)');}const footer=node(this.contentEl,'div',undefined,'dungeon-controls');if(!this.editor)button(footer,'Auswahl für neue Dungeons übernehmen',()=>this.run(async()=>{const data=await this.plugin.assetCatalog().read();await this.plugin.assetCatalog().select(data.packs.filter(p=>this.selected.has(p.metadata.id)?this.selected.get(p.metadata.id):p.selected!==false).map(p=>p.metadata.id),{disableDefaultAssets:this.defaultCheck.checked});this.close();}));button(footer,'Schließen',()=>this.close());this.run(()=>this.refresh());}
 async run(action){if(this.busy)return;this.busy=true;this.error.textContent='';this.draw();try{await action();}catch(e){if(this.contentEl.isConnected&&e.name!=='AbortError')this.error.textContent=e.message;}finally{this.busy=false;if(this.contentEl.isConnected)this.draw();}}
 async refresh(){const data=await this.plugin.assetCatalog().read();if(this.defaultCheck&&!this.defaultsInitialized){this.defaultCheck.checked=data.disableDefaultAssets===true;this.defaultsInitialized=true;}this.records=data.packs.sort((a,b)=>a.metadata.name.localeCompare(b.metadata.name));for(const p of this.records)if(!this.selected.has(p.metadata.id))this.selected.set(p.metadata.id,p.selected!==false);this.draw();}
 choose(updateId=null){if(this.busy)return;const picker=document.createElement('input');picker.type='file';picker.accept='.dungeondraft_pack';picker.multiple=updateId===null;picker.onchange=()=>{if(picker.files.length&&this.contentEl.isConnected)this.run(async()=>{await this.plugin.assetCatalog().add([...picker.files],{updateId,signal:this.abort.signal});await this.refresh();});};picker.click();}
 draw(){if(!this.rows)return;if(this.defaultCheck)this.defaultCheck.disabled=this.busy||!this.defaultsInitialized;this.rows.replaceChildren();const query=this.search.value.toLocaleLowerCase();let count=0;for(const record of this.records||[]){const m=record.metadata;if(![m.name,m.author,m.keywords].join(' ').toLocaleLowerCase().includes(query))continue;count++;const row=node(this.rows,'div',undefined,'dungeon-catalog-row'),label=node(row,'label');if(!this.editor){const check=node(label,'input');check.type='checkbox';check.checked=this.selected.get(m.id);check.disabled=this.busy;check.onchange=()=>this.selected.set(m.id,check.checked);}label.append(m.name);node(row,'small',[m.version&&'Version '+m.version,m.author].filter(Boolean).join(' · '));const controls=node(row,'div',undefined,'dungeon-controls');button(controls,'Paketdatei aktualisieren …',()=>this.choose(m.id)).disabled=this.busy;if(this.editor){const existing=Object.hasOwn(this.editor.index?.objectPacks||{},m.id),use=button(controls,existing?'Kartenbibliothek aktualisieren':'In Karte übernehmen',()=>this.run(async()=>{if(this.editor.draft!==this.draft||!this.editor.contentEl.isConnected)throw Error('Diese Karte ist nicht mehr geöffnet.');await this.editor.importObjectPack(this.plugin.assetCatalog().file(record),existing?m.id:null);await this.refresh();}));use.disabled=this.busy;use.setAttribute('aria-label',m.name+(existing?' in Karte aktualisieren':' in Karte übernehmen'));}}
 if(!count)node(this.rows,'p',this.records?.length?'Keine passenden Pakete.':this.busy?'Katalog wird geladen …':'Noch keine Pakete im Katalog.');}
 onClose(){this.abort.abort();this.contentEl.empty();}
}
class Report extends MarkdownRenderChild{
 constructor(el,plugin,path,options={}){super(el);this.plugin=plugin;this.path=path;this.options=options;this.generation=0;this.party=null;this.selected=null;}
 onload(){if(!this.options.snapshot)this.plugin.reports.add(this);this.refresh();}
 onunload(){this.spatialMap?.destroy();this.plugin.reports.delete(this);this.generation++;this.worker?.terminate();if(this.options.session)this.options.session.cancel();}
 async refresh(reload=false){
  this.mapView=this.spatialMap?.view?.slice()||this.mapView;this.spatialMap?.destroy();this.spatialMap=null;
  const generation=++this.generation;this.worker?.terminate();
  try{
   const snapshot=this.options.snapshot?await this.options.snapshot():null;const input=snapshot?.input||(!reload&&this.input?this.input:await this.plugin.readDungeon(this.path));if(generation!==this.generation)return;this.mapSvg=snapshot?.svg;if(!this.mapPath&&snapshot?.mapPath)this.mapPath=snapshot.mapPath;
   this.containerEl.classList.add('dungeon-report');
   this.containerEl.replaceChildren();node(this.containerEl,'p','Auswertung wird berechnet …');button(this.containerEl,'Abbrechen',()=>{this.generation++;this.worker?.terminate();this.session?.cancel();this.error('Berechnung abgebrochen.');});
   if(input.config.format===2){
    this.input=input;this.session=this.options.session||this.plugin.session(input.overview);const result=await this.session.analyze(input,this.party);if(generation===this.generation)this.render({...result,fast:true},input);return;
   }
   const script=(await Promise.all(['core.js','format2.js'].map(file=>this.plugin.app.vault.adapter.read(this.plugin.manifest.dir+'/'+file)))).join('\n');
   if(generation!==this.generation)return;
   const url=URL.createObjectURL(new Blob([script+'\nonmessage=e=>{try{postMessage({result:DungeonCore.analyze(e.data.input,e.data.party)});}catch(error){postMessage({error:error.message});}};'],{type:'text/javascript'}));
   const worker=this.worker=new Worker(url);URL.revokeObjectURL(url);
   worker.onmessage=e=>{worker.terminate();if(generation!==this.generation)return;if(e.data.error)this.error(e.data.error);else this.render(e.data.result,input);};
   worker.onerror=e=>{worker.terminate();if(generation===this.generation)this.error(e.message||'Hintergrundberechnung fehlgeschlagen.');};
   worker.postMessage({input,party:this.party});
  }catch(e){if(generation===this.generation)this.error(e.message);}
 }
 error(message){this.containerEl.replaceChildren();node(this.containerEl,'p','Auswertung nicht möglich: '+message,'dungeon-warning');button(this.containerEl,'Erneut berechnen',()=>this.refresh(true));}
 link(parent,label,source){
  if(!source?.path){node(parent,'span',label);return;}
  const a=node(parent,'a',label);a.href='#';a.onclick=e=>{e.preventDefault();e.stopPropagation();if(this.options.openSource)return this.options.openSource(source);const file=this.plugin.app.vault.getAbstractFileByPath(source.path);const subpath=source.block?'#^'+source.block:source.heading?'#'+source.heading:'';if(!file){const native=this.plugin.app.plugins.getPlugin('dungeon-editor'),root=source.path.match(/^(Dungeons\/[^/]+)\/Räume\//)?.[1];if(root&&native?.openRoomBySourcePath)return native.openRoomBySourcePath(root+'/Karte.dungeon',source.path,subpath.slice(1));return;}const game=this.plugin.app.plugins.getPlugin('dnd-ot-spielansicht');if(game?.open)game.open(file,subpath);else this.plugin.app.workspace.openLinkText(source.path+subpath,this.path,true);};
 }
 render(result,input){
  let el=this.containerEl;el.replaceChildren();this.result=result;this.input=input;
  const controls=node(el,'div',undefined,'dungeon-controls');
  const size=node(controls,'label','Figuren '),s=node(size,'input');s.type='number';s.min='1';s.step='1';s.value=result.party.size;
  const level=node(controls,'label','Stufe '),l=node(level,'input');l.type='number';l.min='1';l.max='20';l.step='1';l.value=result.party.level;
  button(controls,'Vergleichen',()=>{const party={size:Number(s.value),level:Number(l.value)};if(!Number.isInteger(party.size)||party.size<1||!Number.isInteger(party.level)||party.level<1||party.level>20)throw Error('Spielerzahl positiv, Stufe 1–20.');this.party=party;return this.refresh();});
  button(controls,'Vorgabe',()=>{this.party=null;return this.refresh();});
  button(controls,this.options.adoptParty?'Vergleich im Entwurf übernehmen':'Vergleich als Vorgabe speichern',async()=>{if(this.options.adoptParty){await this.options.adoptParty(result.party);this.party=null;return this.refresh(true);}const file=this.plugin.app.vault.getAbstractFileByPath(input.overview);await this.plugin.app.fileManager.processFrontMatter(file,fm=>{if(!fm.dungeon)throw Error('Dungeonmetadaten fehlen.');fm.dungeon.party={...result.party};});this.party=null;await this.refresh(true);});
  if(result.fast){renderSpatialReport(this,el,result);const tables=node(el,'details');node(tables,'summary','Gesamtdungeon, Begegnungen und Routentabellen');el=node(tables,'div');}
  node(el,'p','Optional = für keine Bossroute nötig, einschließlich indirekter Voraussetzungen. Routenrelevant = für mindestens eine Route nötig. Gesamtsummen sind Bestandswerte; Routen zählen überwundene Begegnungen und zugängliche Funde.');node(el,'p','Loot-Soll nach angepassten XP · Consumables = ½ Item. Ungeklärte Bedingungen werden ausdrücklich angezeigt.');
  node(el,'p','Progression: '+input.progression.sheet+' · importiert '+input.progression.importedAt);
  this.summary(el,'Gesamtdungeon',result.base,result.all);
  const warn=node(el,'details');node(warn,'summary','Datenprüfung: '+result.model.issues.length+' Hinweise');
  if(!result.model.issues.length)node(warn,'p','Keine Datenfehler gefunden.');
  for(const issue of result.model.issues){const p=node(warn,'p');this.link(p,issue.source?.heading||issue.source?.path||'Dungeon',issue.source);p.append(' — '+issue.message);}
  node(el,'h3','Begegnungen');
  table(el,['Begegnung','Tatsächliche XP','Faktor','Angepasste XP','Schwierigkeit','Status'],result.all.fights.map(e=>[td=>this.link(td,e.label||e.id,e.source),e.known?fmt(e.xp):'unvollständig',fmt(e.multiplier),e.known?fmt(e.adjusted):'unvollständig',e.difficulty,e.optional===null?'ungeklärt':e.optional?'optional':'routenrelevant']));
  const hazards=result.all.entries.filter(e=>e.type==='hazard');
  if(hazards.length){const d=node(el,'details');node(d,'summary','Weitere Gefahren ohne XP-Bewertung');hazards.forEach(e=>{const p=node(d,'p');this.link(p,e.label,e.source);p.append(' — '+e.note);});}
  node(el,'h3','Bossrouten');
  if(result.fast){const routes=node(el,'details');node(routes,'summary','Vollständige Routentabellen');let loaded=false;routes.ontoggle=()=>{if(routes.open&&!loaded){loaded=true;this.fastRoutes(node(routes,'div'),result);}};return;}
  if(result.truncated)node(el,'p','Suche nach '+fmt(result.states)+' Zuständen begrenzt. Routenliste und Hauptroutenauswahl sind unvollständig.','dungeon-warning');
  const routeControls=node(el,'div',undefined,'dungeon-controls'),select=node(routeControls,'select');
  result.groups.forEach((g,i)=>{const o=node(select,'option',g.label+' ('+g.routes.length+')');o.value=i;});
  select.value=String(Math.min(this.groupIndex||0,Math.max(0,result.groups.length-1)));
  const toggle=node(routeControls,'label'),check=node(toggle,'input');check.type='checkbox';check.checked=!!this.variants;toggle.append(' Varianten anzeigen');
  const list=node(el,'div'),detail=node(el,'div');let page=0;
  const draw=()=>{
   list.replaceChildren();detail.replaceChildren();this.groupIndex=Number(select.value);this.variants=check.checked;
   const group=result.groups[this.groupIndex];if(!group){node(list,'p','Keine Bossziele verfügbar.');return;}
   const routes=group.routes.filter(r=>check.checked||r.main);
   if(!group.routes.length){node(list,'p',result.truncated?'Kein Weg im untersuchten Teil gefunden.':'Bossziel von diesem Start nicht erreichbar.');return;}
   node(list,'p',routes.length+' '+(check.checked?'Wege':'Hauptrouten')+' · Hauptrouten vergleichen Länge, Kampfbelastung und Zugang. Unbewertete Hürden verhindern eine sichere Rangfolge.');
   const show=r=>{detail.replaceChildren();node(detail,'h4','Route '+r.rooms.join(' → '));const roomById=new Map(result.model.rooms.map(x=>[x.id,x]));const p=node(detail,'p');r.rooms.forEach((id,i)=>{if(i)p.append(' → ');this.link(p,roomById.get(id)?.name||id,{path:roomById.get(id)?.path});});
    if(r.skipped.length)node(detail,'p','Übersprungene Bossziele: '+r.skipped.join(', '));
    this.graph(detail,result,r);
    node(detail,'p','Zugang: '+r.access.label+' · '+r.access.barriers.length+' Hürden');
    r.access.barriers.forEach(b=>node(detail,'p',(b.label||b.id)+' · '+(b.difficulty??'unbewertet')+' — '+(b.note||'')));
    const choices=node(detail,'details');node(choices,'summary','Zusätzliche Inhalte dieser Route');const selected=new Set(),balance=node(detail,'div');
    const updateBalance=()=>{balance.replaceChildren();const extra=result.model.config.format===2?Core.withExtras(result.model,r,result.party,[...selected]):{total:r.all,unavailable:[]};this.summary(balance,'Routenbilanz',r.base,extra.total,true);if(result.model.config.format===2){const sources=node(balance,'details');node(sources,'summary','Gezählte Funde und Begegnungen');for(const e of extra.total.entries){const p=node(sources,'p');this.link(p,e.label||e.id,e.source);}}if(extra.unavailable.length)node(balance,'p','Nicht zugänglich: '+extra.unavailable.join(', '),'dungeon-warning');};
    if(result.model.config.format===2)for(const f of result.model.features.filter(f=>r.rooms.includes(f.room)&&f.fight&&!r.state.fights.includes(f.fight))){const label=node(choices,'label'),check=node(label,'input');check.type='checkbox';label.append(' '+f.label+' · Raum '+f.room);node(choices,'br');check.onchange=()=>{if(check.checked)selected.add(f.id);else selected.delete(f.id);updateBalance();};}
    updateBalance();
    table(detail,['Kampf auf der Route','Angepasste XP','Schwierigkeit'],r.base.fights.map(e=>[td=>this.link(td,e.label||e.id,e.source),e.known?fmt(e.adjusted):'unvollständig',e.difficulty]));
    const sources=node(detail,'details');sources.hidden=result.model.config.format===2;node(sources,'summary','Gezählte Funde und Begegnungen');for(const e of r.all.entries.filter(e=>['gold','magic','encounter'].includes(e.type))){const p=node(sources,'p');this.link(p,(e.optional?'Optional: ':'')+(e.label||e.id),e.source);}
   };
   table(list,['Route','AD','Zugang','Gold Ist / Soll',''],routes.slice(page*20,page*20+20).map(r=>[r.rooms.join(' → '),fmt(r.base.days),r.access.label,fmt(r.base.actual.Gold)+' / '+fmt(r.base.expected.Gold),td=>button(td,'Ansehen',()=>show(r))]));
   const pager=node(list,'div',undefined,'dungeon-controls');if(page>0)button(pager,'Zurück',()=>{page--;draw();});if((page+1)*20<routes.length)button(pager,'Weitere',()=>{page++;draw();});
   if(routes[page*20])show(routes[page*20]);
  };
  select.onchange=check.onchange=()=>{page=0;draw();};draw();
 }
 fastRoutes(el,result){
  node(el,'p',result.truncated?'Zustandsnetz unvollständig; alle folgenden Angaben sind Teilergebnisse.':'Zustandsnetz vollständig berechnet. Raumfolgen und ihre Lösungen werden seitenweise angezeigt.',result.truncated?'dungeon-warning':undefined);
  node(el,'p',fmt(result.states)+' gemeinsame Zustände · '+fmt(result.buildMs/1000)+' Sekunden Berechnung.');
  const controls=node(el,'div',undefined,'dungeon-controls'),select=node(controls,'select');result.groups.forEach((g,i)=>{const o=node(select,'option',g.label);o.value=i;});select.value=String(Math.min(this.groupIndex||0,result.groups.length-1));
  const list=node(el,'div'),variants=node(el,'div'),detail=node(el,'div');let offset=0,epoch=0,detailEpoch=0;
  const range=a=>a&&a.every(Number.isFinite)?a[0]===a[1]?fmt(a[0]):fmt(a[0])+'–'+fmt(a[1]):'—';
  const request=(kind,payload)=>this.session.request(kind,{...payload,party:result.party});
  const showDetail=async(group,id)=>{
   const ticket=++detailEpoch;detail.replaceChildren();node(detail,'p','Lade Variante …');const r=await request('detail',{group,variant:id});if(ticket!==detailEpoch||!el.isConnected)return;
   detail.replaceChildren();node(detail,'h4','Route '+r.rooms.join(' → '));this.graph(detail,result,r);node(detail,'p',(r.main?'Hauptroute':'Weitere Variante')+' · '+r.access.label);
   if(r.skipped.length)node(detail,'p','Übersprungene Bossziele: '+r.skipped.join(', '));
   for(const b of r.access.barriers)node(detail,'p',b.label+' — '+b.note);
   const steps=node(detail,'details');node(steps,'summary','Handlungen und Voraussetzungen');for(const step of r.steps){const p=node(steps,'p');this.link(p,step.label,step.source);}
   const choices=node(detail,'details');node(choices,'summary','Zusätzliche Inhalte dieser Route');const selected=new Set(),balance=node(detail,'div');let balanceEpoch=0;
   const drawBalance=total=>{balance.replaceChildren();this.summary(balance,'Routenbilanz',r.base,total,true);const sources=node(balance,'details');node(sources,'summary','Gezählte Funde und Begegnungen');for(const e of total.entries){const p=node(sources,'p');this.link(p,e.label||e.id,e.source);}};
   drawBalance(r.base);
   for(const f of result.model.features.filter(f=>r.rooms.includes(f.room)&&f.fight&&!r.state.fights.includes(f.fight))){const label=node(choices,'label'),check=node(label,'input');check.type='checkbox';label.append(' '+f.label+' · Raum '+f.room);node(choices,'br');check.onchange=async()=>{const t=++balanceEpoch;if(check.checked)selected.add(f.id);else selected.delete(f.id);try{const extra=await request('extras',{group,variant:id,ids:[...selected]});if(t!==balanceEpoch||ticket!==detailEpoch)return;drawBalance(extra.total);if(extra.unavailable.length)node(balance,'p','Nicht zugängliche Zusätze: '+extra.unavailable.length,'dungeon-warning');}catch(e){if(t===balanceEpoch)node(balance,'p',e.message,'dungeon-warning');}};}
  };
  const showVariants=async(group,family,page=0)=>{
   const ticket=++epoch;detailEpoch++;variants.replaceChildren();detail.replaceChildren();node(variants,'p','Lade Lösungen …');const response=await request('variants',{group,family:family.id,offset:page*20,size:20});if(ticket!==epoch||!el.isConnected)return;
   variants.replaceChildren();node(variants,'h4',family.rooms.join(' → '));if(response.limited)node(variants,'p','Variantenliste noch unvollständig.','dungeon-warning');
   table(variants,['Variante','AD','Zugang','Gold Ist / Soll',''],response.items.map((r,i)=>[(page*20+i+1)+(r.main?' · Hauptroute':''),fmt(r.days),r.access,fmt(r.gold)+' / '+fmt(r.expected),td=>button(td,'Ansehen',()=>showDetail(group,r.id))]));
   const pager=node(variants,'div',undefined,'dungeon-controls');if(page)button(pager,'Vorherige Lösungen',()=>showVariants(group,family,page-1));if(response.more)button(pager,'Weitere Lösungen',()=>showVariants(group,family,page+1));if(response.items[0])await showDetail(group,response.items[0].id);
  };
  const draw=async()=>{
   const ticket=++epoch;detailEpoch++;this.groupIndex=Number(select.value);const group=this.groupIndex;list.replaceChildren();variants.replaceChildren();detail.replaceChildren();node(list,'p','Lade Raumfolgen …');
   try{const response=await request('families',{group,offset,size:20});if(ticket!==epoch||!el.isConnected)return;list.replaceChildren();
    if(response.limited)node(list,'p','Weitere Raumfolgen noch nicht vollständig erschlossen.','dungeon-warning');
    if(!response.items.length)node(list,'p',result.truncated?'Noch kein Weg im untersuchten Teil gefunden.':'Keine weitere Bossroute.');
    table(list,['Raumfolge','AD-Bereich','Gold-Bereich','Status',''],response.items.map(f=>[f.rooms.join(' → '),range(f.bounds.days),range(f.bounds.gold),!f.bounds.complete?'Bereich unvollständig':f.bounds.main?(f.bounds.conditional?'Hauptroute / bedingt':'Hauptroute'):'Weitere Variante',td=>button(td,'Lösungen',()=>showVariants(group,f))]));
    node(list,'p','Bereiche fassen unterschiedliche Lösungen zusammen; die genaue gemeinsame Bilanz steht bei jeder Variante.');
    const pager=node(list,'div',undefined,'dungeon-controls');if(offset)button(pager,'Vorherige Raumfolgen',()=>{offset=Math.max(0,offset-20);return draw();});if(response.more)button(pager,'Weitere Raumfolgen',()=>{offset+=20;return draw();});if(response.items[0])await showVariants(group,response.items[0]);
   }catch(e){if(ticket===epoch)node(list,'p',e.message,'dungeon-warning');}
  };
  select.onchange=()=>{offset=0;draw();};draw();
 }
 summary(parent,label,base,all,route=false){
  node(parent,'h3',label);if(base.rewardXP||all.rewardXP)node(parent,'p','Zusätzliche Belohnungs-XP: '+fmt(all.rewardXP||0));
  if(!base.complete||!all.complete||this.result.model.issues.length)node(parent,'p','Datenhinweise vorhanden: bekannte Teilsummen; fehlende Angaben sind nicht als null bewertet.','dungeon-warning');
  table(parent,['Umfang','Tatsächliche XP','Angepasste XP','Adventure Days'],[
   [route?'Route':'Routenrelevanter Bestand',fmt(base.xp),fmt(base.adjusted),fmt(base.days)],
   [route?'Gewählte Zusätze':'Optionaler Bestand',fmt(all.xp-base.xp),fmt(all.adjusted-base.adjusted),fmt(all.days-base.days)],
   [route?'Mit Zusätzen':'Gesamtbestand',fmt(all.xp),fmt(all.adjusted),fmt(all.days)]
  ]);
  const loot=(sum)=>['Gold',...Core.RARITIES].map(k=>[k==='Gold'?'Gold (GM)':k.replace('_',' '),fmt(sum.actual[k]),fmt(sum.expected[k]),fmt(sum.actual[k]-sum.expected[k]),sum.expected[k]>0?fmt(sum.actual[k]/sum.expected[k]*100)+' %':sum.actual[k]?'Zusatz':'—']);
  table(parent,[route?'Loot auf der Route':'Loot · Gesamtbestand','Ist','Soll','Differenz','Deckung'],loot(route?base:all));
  const d=node(parent,'details');node(d,'summary',route?'Loot mit gewählten Zusätzen':'Loot · routenrelevanter Bestand');table(d,['Loot','Ist','Soll','Differenz','Deckung'],loot(route?all:base));
  if(all.unknown.length)node(parent,'p','Unbewertete Funde: '+all.unknown.map(e=>e.label||e.id).join(', '));
 }
 graph(parent,result,route){
  const svg=parent.ownerDocument.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 720 420');svg.classList.add('dungeon-graph');svg.setAttribute('role','img');svg.setAttribute('aria-label','Wegenetz; ausgewählte Route '+route.rooms.join(' → '));parent.append(svg);
  const rooms=result.model.rooms,positions=new Map(rooms.map((r,i)=>[r.id,{x:360+290*Math.cos(i/rooms.length*2*Math.PI-Math.PI/2),y:210+165*Math.sin(i/rooms.length*2*Math.PI-Math.PI/2)}]));
  const element=(tag,attrs,text)=>{const e=parent.ownerDocument.createElementNS(svg.namespaceURI,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;svg.append(e);return e;};
  const selected=new Set(route.edges.map(e=>e.id)),bosses=new Set(result.model.config.bosses.map(b=>b.room));
  for(const e of result.model.edges){const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)continue;const active=selected.has(e.id);const line=element('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:active?'selected':''});const title=parent.ownerDocument.createElementNS(svg.namespaceURI,'title');title.textContent=e.from+' → '+e.to;line.append(title);}
  for(const room of rooms){const p=positions.get(room.id),active=route.rooms.includes(room.id);element('circle',{cx:p.x,cy:p.y,r:bosses.has(room.id)?20:16,class:active?'selected':''});element('text',{x:p.x,y:p.y+5,'text-anchor':'middle'},room.id+(bosses.has(room.id)?' ★':''));}
  node(parent,'p','★ Boss · Eingänge: '+result.model.config.entrances.join(', ')+' · Richtung und Hürden siehe Routenliste.');
 }
}
class DungeonPlugin extends Plugin{
 async onload(){
  this.reports=new Set();this.sessions=new Map();this.maps=new Set();this.mapModels=new Map();this.alive=true;
  this.registerMarkdownCodeBlockProcessor('dungeon-report',(src,el,ctx)=>ctx.addChild(new Report(el,this,ctx.sourcePath)));
  this.registerMarkdownCodeBlockProcessor('dungeon-data',(src,el)=>{
   const d=node(el,'details',undefined,'dungeon-data');try{const data=JSON.parse(src),entries=Array.isArray(data)?data:[data];node(d,'summary','Auswertungsdaten · '+entries.map(e=>e.label||e.id).join(' · '));node(d,'pre',src);}catch(e){node(d,'summary','Fehler in Auswertungsdaten');node(d,'pre',e.message);}
  });
  this.registerMarkdownPostProcessor((el,ctx)=>this.decorateSharedMaps(el,ctx));
  Core.installMapEditor(this,{ItemView,Modal,Notice,parseYaml,setIcon});
  Core.installDraftReport(this,{Report,DungeonSession});
  Core.installEditorNavigation(this);
  Core.installInlineMapEditor(this,{ItemView,Modal,Scope,Notice,editorInfoField,editorLivePreviewField});
  const changed=new Set();let structural=false;const schedule=(file,oldPath,structure=false)=>{if(file?.path)changed.add(file.path);if(oldPath)changed.add(oldPath);structural ||= structure&&file?.extension==='md';clearTimeout(this.timer);this.timer=setTimeout(()=>{const paths=[...changed],resolveAgain=structural;this.refreshSharedMaps(paths);changed.clear();structural=false;for(const r of this.reports){const input=r.input,root=input?.overview.slice(0,input.overview.lastIndexOf('/')+1);if(resolveAgain||!input||paths.some(p=>p===PROGRESSION||p.startsWith(root)||input.documents?.some(d=>d.path===p)))r.refresh(true);}},350);};
  this.registerEvent(this.app.vault.on('modify',file=>schedule(file)));
  for(const event of ['create','delete','rename'])this.registerEvent(this.app.vault.on(event,(file,oldPath)=>schedule(file,oldPath,true)));
  this.addCommand({id:'open-report',name:'Dungeon auswerten',callback:()=>this.openReport()});
  this.addCommand({id:'new-dungeon',name:'Dungeon anlegen',callback:()=>this.newDungeon()});
  this.addCommand({id:'quick-new-dungeon',name:'Dungeon schnell anlegen',callback:()=>this.newDungeon(true)});
  this.addRibbonIcon('map','Neuen Dungeon anlegen',()=>this.newDungeon(true));
  this.addCommand({id:'open-dungeon',name:'Bestehenden Dungeon öffnen',callback:()=>this.openDungeonDialog()});
  this.addRibbonIcon('folder-open','Bestehenden Dungeon öffnen',()=>this.openDungeonDialog());
  this.addCommand({id:'package-catalog',name:'Paketkatalog öffnen',callback:()=>this.openPackageCatalog()});
  this.addCommand({id:'insert-data',name:'Lesbare Auswertungsfelder einfügen',editorCallback:editor=>new TextDialog(this.app,'Felder am Feature','Beute: 1×Neuer Fund; Wert: unbekannt',async text=>{editor.replaceSelection('\n'+text+'\n');}).open()});
  this.addCommand({id:'import-progression',name:'DB_Progression als CSV importieren',callback:()=>this.importProgression()});
  this.addCommand({id:'help',name:'Format und Vorlagen öffnen',callback:()=>this.app.workspace.openLinkText('Dungeons/_System/Format.md','',true)});
 }
 createDungeonMap(options){const map=new Core.SharedDungeonMap(this,options);this.maps.add(map);return map;}
 mapModel(path){const root=path.match(/^(Dungeons\/[^/]+)\//)?.[1];if(!root)return Promise.reject(Error('Kein Dungeonpfad.'));if(!this.mapModels.has(root)){const promise=this.readDungeon(path).then(input=>Core.compile2(input));this.mapModels.set(root,promise);promise.catch(()=>{if(this.mapModels.get(root)===promise)this.mapModels.delete(root);});}return this.mapModels.get(root);}
 async decorateSharedMaps(el,ctx){
  const play=this.app.plugins.getPlugin('dnd-ot-spielansicht');
  if(play&&(ctx.sourcePath.includes('/Räume/')||play.dungeon(ctx.sourcePath)?.overview===ctx.sourcePath))return;
  for(const embed of el.querySelectorAll('.image-embed[src]')){const raw=embed.getAttribute('src').split('#')[0];if(!/\/Karten\/(?:00 Gesamtplan|Geschoss-[a-zA-Z0-9_-]+)\.svg$/.test(raw)||embed.dataset.sharedMap)continue;embed.dataset.sharedMap='true';const file=this.app.metadataCache.getFirstLinkpathDest(raw,ctx.sourcePath);if(!file)continue;const text=await this.app.vault.adapter.read(file.path);if(!text.includes('data-dungeon-map='))continue;
   const source=this.app.vault.getAbstractFileByPath(ctx.sourcePath),focusRoom=this.app.metadataCache.getFileCache(source)?.frontmatter?.room_id;const map=this.createDungeonMap({path:file.path,source:ctx.sourcePath,focusRoom:focusRoom==null?null:String(focusRoom)});const width=Number(embed.getAttribute('width')||embed.querySelector('img')?.getAttribute('width'));if(width)map.el.style.maxWidth=width+'px';embed.replaceWith(map.el);map.restore=()=>{if(map.el.isConnected)map.el.replaceWith(embed);};const child=new MarkdownRenderChild(map.el);child.onunload=()=>map.destroy();ctx.addChild(child);
  }
 }
 refreshSharedMaps(paths){for(const [root]of this.mapModels)if(paths.some(p=>p.startsWith(root+'/')||p===PROGRESSION))this.mapModels.delete(root);for(const map of [...this.maps]){if(map.dead)continue;if(map.el.isConnected)map.wasConnected=true;else if(map.wasConnected){map.destroy();continue;}if(paths.some(p=>p===map.path||p.endsWith('.md')&&p.startsWith(map.path.split('/Karten/')[0]+'/')))map.load(true);}}
 session(path){if(!this.sessions.has(path))this.sessions.set(path,new DungeonSession(this,path));return this.sessions.get(path);}
 async findOverview(path){
  let dir=path.substring(0,path.lastIndexOf('/'));
  while(dir.startsWith('Dungeons/')&&!dir.startsWith('Dungeons/_System')){
   const files=this.app.vault.getMarkdownFiles().filter(f=>f.parent?.path===dir);
   for(const file of files){const text=await this.app.vault.cachedRead(file);const fm=parseYaml(Core.frontmatter(text));if(fm?.dungeon)return {file,config:fm.dungeon};}
   dir=dir.substring(0,dir.lastIndexOf('/'));
  }throw Error('Keine Dungeonübersicht mit dungeon-Eigenschaften gefunden.');
 }
 async readDungeon(path){
  const found=await this.findOverview(path),file=found.file,prefix=file.parent.path+'/Räume/';
  const native=this.app.plugins.getPlugin('dungeon-editor');
  const virtual=native?.readStructuredRoomDocuments?await native.readStructuredRoomDocuments(file.parent.path+'/Karte.dungeon'):[];
  const virtualById=new Map(virtual.map(room=>[room.id,room]));
  const virtualByPath=new Map(virtual.map(room=>[room.path,room]));
  const reverseRoomLinks=text=>String(text).replace(/\[([^\[\]\n]+)\]\((obsidian:\/\/dungeon-room\?[^)\s]+)\)/g,(full,label,url)=>{try{const query=new URL(url).searchParams,room=virtualById.get(query.get('room'));if(!room)return full;const anchor=query.get('anchor');return '[['+room.path.replace(/\.md$/,'')+(anchor?'#'+anchor:'')+'|'+label+']]';}catch(_){return full;}});
  const config=virtual.length?{...found.config,bosses:(found.config.bosses||[]).map(b=>({...b,feature:reverseRoomLinks(b.feature)}))}:found.config;
  const rooms=[],entries=[],issues=[],documents=[],links={};
  const roomSources=virtual.length?virtual.map(room=>({path:room.path,basename:room.path.split('/').at(-1).replace(/\.md$/,''),text:room.text})):this.app.vault.getMarkdownFiles().filter(f=>f.path.startsWith(prefix)).sort((a,b)=>a.path.localeCompare(b.path));
  for(const room of roomSources){
   const text=reverseRoomLinks(room.text??await this.app.vault.cachedRead(room));let fm;
   try{fm=parseYaml(Core.frontmatter(text))||{};}catch(e){issues.push({message:'Ungültige Raumeigenschaften: '+e.message,source:{path:room.path}});continue;}
   const id=fm.room_id==null?'':String(fm.room_id);rooms.push({id,path:room.path,name:text.match(/^# (.+)$/m)?.[1]||room.basename});
   if(config.format===2)documents.push({path:room.path,text,room:id});else{const parsed=Core.parseBlocks(text,room.path,id);entries.push(...parsed.entries);issues.push(...parsed.issues);}
  }
  if(config.format===2){
   const loaded=new Set(documents.map(d=>d.path));
   const queue=this.app.vault.getMarkdownFiles().filter(f=>f.path.startsWith(file.parent.path+'/')&&!f.path.includes('/Archiv/')&&!loaded.has(f.path));
   for(const note of queue){loaded.add(note.path);documents.push({path:note.path,text:reverseRoomLinks(await this.app.vault.cachedRead(note))});}
   for(let i=0;i<documents.length;i++){
    const doc=documents[i],parsed=Core.parseReadable(doc),values=parsed.sections.flatMap(s=>[...Object.values(s.fields),...s.rows.flatMap(r=>Object.values(r.fields))]);
    if(doc.path===file.path)values.push(...config.bosses.map(b=>b.feature||''));
    for(const value of values)for(const match of value.matchAll(/\[\[([^\]]+)\]\]/g)){
     const raw=match[1].split('|')[0],name=raw.split('#')[0],roomPath=name.endsWith('.md')?name:name+'.md';const target=virtualByPath.has(roomPath)?{path:roomPath,extension:'md',virtual:true}:name?this.app.metadataCache.getFirstLinkpathDest(name,doc.path):this.app.vault.getAbstractFileByPath(doc.path);
     if(!target||target.extension!=='md'||target.path.includes('/Archiv/'))continue;links[doc.path+'\0'+raw]=target.path;
     if(!loaded.has(target.path)){loaded.add(target.path);documents.push({path:target.path,text:target.virtual?reverseRoomLinks(virtualByPath.get(target.path).text):reverseRoomLinks(await this.app.vault.cachedRead(target))});}
    }
   }
  }
  const progression=JSON.parse(await this.app.vault.adapter.read(PROGRESSION));
  const baseMapPath=file.parent.path+'/Karten/00 Gesamtplan.svg',indexPath=file.parent.path+'/Karten/00 Gesamtplan.editor.json';let mapInstances={},levels;if(await this.app.vault.adapter.exists(indexPath)){const index=JSON.parse(await this.app.vault.adapter.read(indexPath));mapInstances=index.instances||{};levels=Core.mapLevels.catalogue(index,baseMapPath);}
  return {config,rooms,entries,issues,documents,links,progression,mapInstances,levels,overview:file.path};
 }
 async openReport(){try{const {file}=await this.findOverview(this.app.workspace.getActiveFile()?.path||'');const path=file.parent.path+'/Auswertung.md';let report=this.app.vault.getAbstractFileByPath(path);if(!report)report=await this.app.vault.create(path,'# '+file.basename+' · Auswertung\n\n```dungeon-report\n```\n');await this.app.workspace.getLeaf('tab').openFile(report);}catch(e){new Notice(e.message);}}
 async mkdir(path){if(!await this.app.vault.adapter.exists(path))await this.app.vault.createFolder(path);}
 async createDungeon(options){
  const io=this.mapFileIO(),a=this.app.vault.adapter;
  io.removeEmptyDir=async path=>{if(!await a.exists(path))return;const listing=await a.list(path);if(!listing.files.length&&!listing.folders.length){const folder=this.app.vault.getAbstractFileByPath(path);if(folder)await this.app.vault.delete(folder);else await a.rmdir(path,false);}};
  const result=await Core.createNewDungeon(io,options);if(options.catalogSelection)try{await this.assetCatalog().select(options.catalogSelection,{disableDefaultAssets:options.disableDefaultAssets});}catch(e){new Notice('Dungeon angelegt; Paketauswahl konnte nicht gemerkt werden: '+e.message);}return result;
 }
 async openCreatedDungeon(result){
  const file=this.app.vault.getAbstractFileByPath(result.overview);if(!file)throw Error('Dungeon angelegt; Übersicht noch nicht im Dateiverzeichnis verfügbar.');
  await this.app.workspace.getLeaf('tab').openFile(file,{state:{mode:'source',source:false}});
  const editor=await this.openMapEditor(result.overview);if(result.startWithWizard)editor.setCategory('wizard');return editor;
 }
 openDungeonDialog(){new OpenDungeonDialog(this).open();}
 openPackageCatalog(editor=null){new PackageCatalogDialog(this,editor).open();}
 assetCatalog(){const base=this.app.vault.adapter.getBasePath?.()||this.app.vault.adapter.basePath;if(!base)throw Error('Der lokale Paketkatalog benötigt einen Dateisystem-Vault.');return this.assetCatalogStore||=new Core.DungeonAssetCatalog(require('node:path').join(base,this.app.vault.configDir||'.obsidian','dungeon-asset-library'));}
 async readSizeTemplates(){
  const data=await this.loadData()||{};if(data.mapSizeTemplates!==undefined){if(!Array.isArray(data.mapSizeTemplates))throw Error('Gespeicherte Größenvorlagen sind ungültig.');return data.mapSizeTemplates.map(t=>{if(!t||typeof t.id!=='string'||typeof t.name!=='string'||!t.name.trim())throw Error('Gespeicherte Größenvorlage ist ungültig.');Core.planNewDungeon({name:'Formatprüfung',width:t.width,height:t.height});return {...t};});}
  return [{id:'tv40',name:'40-Zoll-Bildschirm',width:35,height:20},{id:'tv55',name:'55-Zoll-Bildschirm',width:48,height:27},{id:'a4',name:'A4',width:11,height:8},{id:'a3',name:'A3',width:16,height:11}];
 }
 updateSizeTemplates(change){
  const operation=(this.sizeTemplateWrite||Promise.resolve()).catch(()=>{}).then(async()=>{const list=change(await this.readSizeTemplates()),data=await this.loadData()||{};await this.saveData({...data,mapSizeTemplates:list});return list;});this.sizeTemplateWrite=operation;return operation;
 }
 newDungeon(quick=false){new NewDungeonDialog(this,quick).open();}
 importProgression(){
  const input=document.createElement('input');input.type='file';input.accept='.csv,text/csv';input.onchange=async()=>{
   try{const file=input.files?.[0];if(!file)return;const rows=Core.csvProgression(await file.text());
    const previous=JSON.parse(await this.app.vault.adapter.read(PROGRESSION));
    const current=this.app.vault.getAbstractFileByPath(PROGRESSION);
    await this.app.vault.modify(current,JSON.stringify({...previous,rows,importedAt:new Date().toISOString(),importFile:file.name},null,2)+'\n');new Notice('DB_Progression importiert: 20 Stufen.');
   }catch(e){new Notice('Import unverändert abgebrochen: '+e.message);}
  };input.click();
 }
 onunload(){this.alive=false;for(const map of [...this.maps])map.destroy();this.mapModels.clear();for(const s of this.sessions.values())s.cancel('Plugin beendet.');this.sessions.clear();clearTimeout(this.timer);for(const r of this.reports){r.generation++;r.worker?.terminate();}this.reports.clear();}
}
module.exports=DungeonPlugin;
