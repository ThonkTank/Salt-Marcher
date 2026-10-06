const {Plugin, MarkdownView, MarkdownRenderer, ItemView, TFile, Notice} = require('obsidian');
const PLAY_MAP_VIEW='dnd-play-map';
const NATIVE_MAP_VIEW='dungeon-native-map';
const NATIVE_ROOM_VIEW='dungeon-native-room';
const V4_OUTLINE_VIEW='dnd-v4-outline';
const INDEX_VIEWS={
 key:{type:'dnd-dungeon-key',label:'Key',icon:'list-tree',folder:'Räume'},
 characters:{type:'dnd-dungeon-characters',label:'Charaktere',icon:'users',folder:'Kreaturen',exclude:['Begegnungswerte']},
 items:{type:'dnd-dungeon-items',label:'Items',icon:'package',folder:'Items'}
};
function plain(s) {
 return s.replace(/!\[\[[\s\S]*?\]\]/g,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'')
 .replace(/\[\[([^\]]+)\]\]/g,(_,s)=>{let p=s.split(/(?<!\\)\|/);return p.length>1?p.at(-1):p[0].split('/').at(-1).replace(/\.md(?=#|$)/,'');})
 .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/<[^>]+>/g,'').replace(/\\([\[\]_*|])/g,'$1')
 .replace(/[*_`]/g,'').replace(/^\s*(?:[-+>] |\d+\. )/gm,'').replace(/\s+/g,' ').trim();
}
function excerpt(text, room, heading='') {
 text=text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'').replace(/^```dungeon-data[^\n]*\n[\s\S]*?^```[^\n]*\n?/gm,'');
 let lines=text.split('\n');
 if(heading){let start=lines.findIndex(l=>/^#{1,6} /.test(l)&&plain(l.replace(/^#+ /,''))===heading);
 if(start>=0){let level=lines[start].match(/^#+/)[0].length;let end=lines.findIndex((l,i)=>i>start&&new RegExp('^#{1,'+level+'} ').test(l));lines=lines.slice(start+1,end<0?undefined:end);}}
 let blocks=lines.join('\n').split(/\n\s*\n/).filter(b=>{
 let s=b.trim();return s&&!/^#|^!\[|^\[\[[^\n]+\]\]$|^```|^<!--|^\|\s*[-:]/.test(s)&&! /^(Karte|Einrichtung|Spielmöglichkeiten):/.test(s);
 });
 let selected=room&&!heading?blocks.find(b=>/^\*[^*]/.test(b.trim())):null;
 selected=selected||(heading?blocks.filter(b=>plain(b)).join('\n\n'):blocks.find(b=>plain(b)))||'';
 let words=plain(selected).split(/\s+/).filter(Boolean);return words.slice(0,120).join(' ')+(words.length>120?' …':'');
}
function inlineMarkdown(value){
 const trimmed=value.trim(),gm=trimmed.match(/^\\?\[GM:\s*([\s\S]*?)\\?\]\s*$/);
 return gm?gm[1]:trimmed;
}
function shortText(value,limit=34){
 const words=plain(inlineMarkdown(value)).split(/\s+/).filter(Boolean);
 return words.slice(0,limit).join(' ')+(words.length>limit?' …':'');
}
function indexPreview(text,kind){
 text=text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'').replace(/^```dungeon-data[^\n]*\n[\s\S]*?^```[^\n]*\n?/gm,'').replace(/^!\[\[[^\n]+\]\]\s*$/gm,'');
 const lines=text.split('\n').map(line=>line.trim()).filter(Boolean),content=lines.filter(line=>!/^#{1,6}\s|^!\[|^\[\[[^\n]+\]\]$|^<!--/.test(line));
 if(kind==='key'){
  const readAloud=content.find(line=>line.startsWith('*')&&!line.startsWith('**')&&line.endsWith('*'));
  const markdown=readAloud?readAloud.slice(1,-1):content[0]||'';
  return {summary:plain(markdown),markdown,meta:''};
 }
 if(kind==='characters'){
  const xp=[...text.matchAll(/^XP:\s*(.+)$/gm)].map(match=>match[1].trim()),usable=content.filter(line=>!/^XP:|^Profil und Hilfen gelten/.test(line));
  const selected=usable.find(line=>line.startsWith('*')&&!line.startsWith('**')&&line.endsWith('*'))||usable.find(line=>/^\*\*[^*]+:\*\*/.test(line))||usable.find(line=>/^\\?\[GM:/.test(line))||usable.find(line=>!/^[-+]/.test(line))||usable[0]||'';
  return {summary:shortText(selected,34),markdown:inlineMarkdown(selected),meta:xp.length?'XP '+[...new Set(xp)].join(' · '):''};
 }
 const locations=lines.map(line=>line.match(/^##\s+(\d+\s+.+)$/)?.[1]).filter(Boolean),metadata=content.find(line=>/^(Wert|Seltenheit|Besetzung|Beute):/.test(line)),usable=content.filter(line=>!metadata||line!==metadata),selected=usable.find(line=>/^\\?\[GM:/.test(line))||usable.find(line=>!/^[-+]/.test(line))||usable[0]||'';
 const placeText=locations.length?locations.slice(0,2).join(' · ')+(locations.length>2?` · +${locations.length-2}`:''):metadata?shortText(metadata,12):'';
 return {summary:shortText(selected,34),markdown:inlineMarkdown(selected),meta:placeText};
}
class PlayMapPane extends ItemView {
 constructor(leaf,plugin){super(leaf);this.plugin=plugin;this.epoch=0;}
 getViewType(){return PLAY_MAP_VIEW;}
 getDisplayText(){return 'Karte';}
 getIcon(){return 'map';}
 getState(){return {roomPath:this.roomPath};}
 async setState(state){this.pendingRoomPath=state?.roomPath;if(this.contentEl.isConnected){const room=await this.plugin.roomReference(this.pendingRoomPath);if(room)await this.setRoom(room);}}
 async onOpen(){this.contentEl.classList.add('dnd-play-map-pane');this.contentEl.setAttribute('aria-label','Karte des gewählten Raums');const room=await this.plugin.roomReference(this.pendingRoomPath);if(room)await this.setRoom(room);}
 async setRoom(file){
  if(!file?.path||(!this.plugin.isRoom(file.path)&&file.path!==this.plugin.dungeon(file.path)?.overview))return;
  const ticket=++this.epoch,choice=await this.plugin.roomMap(file);if(ticket!==this.epoch||!this.contentEl.isConnected)return;
  const mapFile=choice?.file,roomId=choice?.roomId;
  this.roomPath=file.path;
  if(!mapFile){this.map?.destroy?.();this.map=null;this.nativeMap=null;this.mapPath=null;this.contentEl.replaceChildren();this.contentEl.createEl('p',{text:'Für diesen Raum ist keine Karte eingebunden.'});return;}
  if(this.mapPath===mapFile.path&&this.nativeMap?.isConnected&&this.contentEl.contains(this.nativeMap))return;
  if(this.mapPath===mapFile.path&&this.map?.el?.isConnected&&this.contentEl.contains(this.map.el)){
   this.map.source=file.path;this.map.focusId=roomId;
   await this.map.ready;if(ticket!==this.epoch)return;
   if(!this.map.loaded){this.showNativeMap(mapFile,choice.width,file.path,roomId,this.map.status?.textContent);return;}
   if(roomId)this.map.focus?.(roomId);else this.map.fit?.();
   return;
  }
  this.map?.destroy?.();this.map=null;this.nativeMap=null;this.contentEl.replaceChildren();this.mapPath=mapFile.path;
  const card=this.plugin.createMap(mapFile,choice.width,file.path,roomId);
  this.contentEl.append(card);this.map=card.dungeonMap||null;
	  if(this.map)for(const button of this.map.bar.querySelectorAll('button')){
	   const label=button.textContent;
	   if(label==='Einpassen'||label==='Gesamten Dungeon zeigen')button.textContent='Alles';
	   if(label==='Maximieren')button.classList.add('dnd-maximize-button');
	   if(label==='Aktuell')button.addEventListener('click',()=>{const file=this.plugin.currentDetailRoom(),roomId=file&&(file.number??this.plugin.app.metadataCache.getFileCache(file)?.frontmatter?.room_id??file.basename?.match(/^(\d+)/)?.[1]);if(roomId!=null)this.map?.focus?.(String(roomId));},true);
	   button.setAttribute('aria-label',label==='Maximieren'?'Karte maximieren und im Editor bearbeiten':label==='Aktuell'?'Zum aktuell geöffneten Raum oder Karteninhalt springen':label);
	   button.title=button.getAttribute('aria-label');
	  }
	  if(this.map){for(const select of this.map.bar.querySelectorAll('select'))select.hidden=true;this.map.status.hidden=true;}
  if(this.map){
   await this.map.ready;if(ticket!==this.epoch)return;
   if(!this.map.loaded){
    this.showNativeMap(mapFile,choice.width,file.path,roomId,this.map.status?.textContent);
   }else if(roomId)this.map.focus(roomId);
  }
 }
 showNativeMap(mapFile,width,sourcePath,roomId,reason){
  this.map?.destroy?.();this.map=null;this.contentEl.replaceChildren();
  this.contentEl.createEl('p',{text:'Interaktive Karte nicht verfügbar: '+(reason||'Die interaktive Karte konnte nicht geladen werden.')});
  this.nativeMap=this.plugin.createMap(mapFile,width,sourcePath,roomId,true);this.contentEl.append(this.nativeMap);
 }
 async onClose(){this.epoch++;this.map?.destroy?.();this.map=null;this.nativeMap=null;this.mapPath=null;}
}
class DungeonIndexPane extends ItemView {
 constructor(leaf,plugin,kind){super(leaf);this.plugin=plugin;this.kind=kind;this.epoch=0;}
 get config(){return INDEX_VIEWS[this.kind];}
 getViewType(){return this.config.type;}
 getDisplayText(){return this.config.label;}
 getIcon(){return this.config.icon;}
 getState(){return {root:this.root};}
 async setState(state){this.root=state?.root;if(this.contentEl.isConnected)await this.render();}
 async onOpen(){this.contentEl.classList.add('dnd-index-pane','markdown-rendered');this.leaf.tabHeaderEl.classList.add('dnd-index-tab');this.registerDomEvent(this.leaf.tabHeaderEl,'click',()=>void this.render());await this.render();}
 async onShow(){await this.render();}
 async render(){
  const ticket=++this.epoch,dungeon=this.plugin.dungeon(this.root),root=this.root||dungeon?.root;
  this.contentEl.replaceChildren();
  if(!root){this.contentEl.createEl('p',{text:'Kein Dungeon ausgewählt.',cls:'dnd-index-empty'});return;}
  this.root=root;
  const prefix=root+this.config.folder+'/',virtual=this.kind==='key'?await this.plugin.readV4Rooms(root):[];
  const files=virtual.length?virtual.map(room=>({...room,basename:room.path.split('/').at(-1).replace(/\.md$/,'')})):
   this.plugin.app.vault.getMarkdownFiles().filter(file=>file.path.startsWith(prefix)&&file.parent?.path===prefix.slice(0,-1)&&!this.config.exclude?.includes(file.basename)).sort((a,b)=>a.basename.localeCompare(b.basename,'de',{numeric:true}));
  if(!files.length){this.contentEl.createEl('p',{text:'Noch keine Einträge.',cls:'dnd-index-empty'});return;}
  const texts=await Promise.all(files.map(file=>file.text??this.plugin.app.vault.cachedRead(file)));
  if(ticket!==this.epoch)return;
  const labels={key:['Raum','Räume'],characters:['Charakter','Charaktere'],items:['Item','Items']},label=labels[this.kind][files.length===1?0:1];
  this.contentEl.createEl('h2',{text:`${files.length} ${label}`,cls:'dnd-index-summary'});
  const list=this.contentEl.createDiv({cls:`dnd-index-list dnd-index-${this.kind}`});
  const renders=[];
  files.forEach((file,index)=>{
   const entry=list.createEl('section',{cls:'dnd-index-entry'}),heading=entry.createEl('h3',{cls:'dnd-index-entry-heading'}),preview=indexPreview(texts[index]||'',this.kind);
   if(virtual.length)heading.createEl('a',{text:file.basename,cls:'dnd-v4-room-link',attr:{href:'#','data-room-id':file.id}});
   else heading.createEl('a',{text:file.basename,cls:'internal-link',attr:{href:file.path,'data-href':file.path}});
   if(preview.meta)entry.createEl('span',{text:preview.meta,cls:'dnd-index-meta'});
   if(preview.summary){const description=entry.createDiv({cls:'dnd-index-description'});renders.push(MarkdownRenderer.render(this.plugin.app,preview.markdown||preview.summary,description,file.path,this));}
   entry.addEventListener('click',event=>{
    const virtualLink=event.target.closest?.('a.dnd-v4-room-link');
    if(virtualLink){event.preventDefault();event.stopPropagation();this.plugin.closeTip();void this.plugin.openV4Room(root,virtualLink.dataset.roomId);return;}
    const anchor=event.target.closest?.('a.internal-link');
    if(!anchor)return;
    const target=this.plugin.resolve(anchor.dataset.href||anchor.getAttribute('href'),file.path);
    if(!target.file)return;
    event.preventDefault();event.stopPropagation();this.plugin.closeTip();this.plugin.open(target.file,target.subpath);
   });
  });
  await Promise.all(renders);if(ticket!==this.epoch)return;
 }
 async onClose(){this.epoch++;}
}
class DungeonKeyPane extends DungeonIndexPane {
 constructor(leaf,plugin){super(leaf,plugin,'key');}
 getViewType(){return INDEX_VIEWS.key.type;}
}
class DungeonCharactersPane extends DungeonIndexPane {
 constructor(leaf,plugin){super(leaf,plugin,'characters');}
 getViewType(){return INDEX_VIEWS.characters.type;}
}
class DungeonItemsPane extends DungeonIndexPane {
 constructor(leaf,plugin){super(leaf,plugin,'items');}
 getViewType(){return INDEX_VIEWS.items.type;}
}
class DungeonV4OutlinePane extends ItemView {
 constructor(leaf,plugin){super(leaf);this.plugin=plugin;}
 getViewType(){return V4_OUTLINE_VIEW;}
 getDisplayText(){return 'Gliederung';}
 getIcon(){return 'list-tree';}
 async onOpen(){this.contentEl.classList.add('dnd-v4-outline');await this.render();}
 async onShow(){await this.render();}
 async render(){
  this.contentEl.replaceChildren();
  const room=this.plugin.currentDetailRoom();
  this.contentEl.createEl('h2',{text:'Gliederung'});
  if(room?.sections){
   const root=this.plugin.dungeon(room.path)?.root;
   for(const section of room.sections){
    if(!section.title)continue;
    const button=this.contentEl.createEl('button',{text:section.title});
    button.type='button';button.className='dnd-v4-outline-entry';
    button.addEventListener('click',()=>void this.plugin.openV4Room(root,room.id,section.id,section.title));
   }
   return;
  }
  const group=this.plugin.rightGroup(),leaf=group?.children?.[group.currentTab??0],file=leaf?.view?.file;
  if(!(file instanceof TFile)){this.contentEl.createEl('p',{text:'Keine Notiz ausgewählt.'});return;}
  for(const heading of this.plugin.app.metadataCache.getFileCache(file)?.headings||[]){
   const button=this.contentEl.createEl('button',{text:heading.heading});
   button.type='button';button.className='dnd-v4-outline-entry';
   button.addEventListener('click',()=>void this.plugin.open(file,'#'+heading.heading,leaf));
  }
 }
}
class Spielansicht extends Plugin {
 async onload(){
  this.alive=true;this.settings=await this.loadData()||{};this.rooms=new Map();this.observers=new Map();this.aria=new Map();this.v4Rooms=new Map();
  this.registerView(PLAY_MAP_VIEW,leaf=>new PlayMapPane(leaf,this));
  this.registerView(INDEX_VIEWS.key.type,leaf=>new DungeonKeyPane(leaf,this));
  this.registerView(INDEX_VIEWS.characters.type,leaf=>new DungeonCharactersPane(leaf,this));
  this.registerView(INDEX_VIEWS.items.type,leaf=>new DungeonItemsPane(leaf,this));
  this.registerView(V4_OUTLINE_VIEW,leaf=>new DungeonV4OutlinePane(leaf,this));
  this.addCommand({id:'restore',name:'Spielansicht wiederherstellen',callback:()=>this.restoreLayout()});
  this.registerMarkdownPostProcessor((el,ctx)=>{if(this.isRoom(ctx.sourcePath))return this.decorate(el,ctx.sourcePath);});
  this.registerDomEvent(document,'click',e=>this.click(e),true);
  this.registerDomEvent(document,'mouseover',e=>this.hover(e),true);
  this.registerDomEvent(document,'mouseout',e=>this.leave(e),true);
  this.registerDomEvent(document,'keydown',e=>{if(e.key==='Escape')this.closeTip();},true);
  this.registerEvent(this.app.workspace.on('layout-change',()=>this.refresh()));
  this.registerEvent(this.app.workspace.on('active-leaf-change',()=>{this.refresh();this.refreshV4Outline();}));
  this.registerEvent(this.app.workspace.on('file-open',()=>this.refresh()));
  this.registerEvent(this.app.vault.on('modify',file=>{const root=file.path.endsWith('.dungeon')?this.dungeon(file.path)?.root:null;if(root){this.v4Rooms.delete(root);void this.readV4Rooms(root).then(()=>{this.refreshIndexes();this.refreshV4Outline();this.refresh();});}this.refreshMaps(file);if(!root)this.refreshIndexes();this.refreshV4Outline();}));
  this.registerEvent(this.app.vault.on('create',()=>this.refreshIndexes()));
  this.registerEvent(this.app.vault.on('delete',()=>this.refreshIndexes()));
  this.registerEvent(this.app.vault.on('rename',()=>this.refreshIndexes()));
	  const ready=async()=>{if(!this.alive)return;const missingIndex=Object.values(INDEX_VIEWS).some(config=>!this.app.workspace.getLeavesOfType(config.type).some(leaf=>leaf.view instanceof DungeonIndexPane));if(this.settings.layoutVersion!==7||missingIndex)await this.restoreLayout();this.refresh();};
  const start=()=>window.setTimeout(()=>void ready(),0);
  if(this.app.workspace.layoutReady)start();else this.app.workspace.onLayoutReady(start);
 }
 context(el){const leafEl=el.closest('.workspace-leaf');return this.app.workspace.getLeavesOfType('markdown').find(l=>l.view.containerEl===leafEl||leafEl?.contains(l.view.containerEl));}
 resolve(raw,source){let [path,...hash]=raw.split('#');try{path=decodeURIComponent(path);hash=hash.map(decodeURIComponent);}catch{}return {file:path?this.app.metadataCache.getFirstLinkpathDest(path,source):this.app.vault.getAbstractFileByPath(source),subpath:hash.length?'#'+hash.join('#'):''};}
 dungeon(path=this.app.workspace.getActiveFile()?.path){
  let match=path?.match(/^Dungeons\/([^/]+)\//);
  if(!match||match[1]==='_System')match=this.settings.activeDungeon?.match(/^Dungeons\/([^/]+)\//);
  if(!match)match=this.app.vault.getMarkdownFiles().map(f=>f.path.match(/^Dungeons\/([^/]+)\//)).find(m=>m&&m[1]!=='_System');
  if(!match)return null;
  const root='Dungeons/'+match[1]+'/', rooms=root+'Räume/';
  const file=this.app.vault.getMarkdownFiles().find(f=>f.parent?.path===root.slice(0,-1)&&this.app.metadataCache.getFileCache(f)?.frontmatter?.dungeon);
  const saved=this.settings.activeOverview?.startsWith(root)&&this.app.vault.getAbstractFileByPath(this.settings.activeOverview);
  return {root,rooms,overview:saved?.path||file?.path||root+match[1]+'.md'};
 }
 isDungeon(path){return !!path&&/^Dungeons\/(?!_System\/)[^/]+\//.test(path);}
 isRoom(path){return !!path&&/^Dungeons\/(?!_System\/)[^/]+\/Räume\//.test(path);}
 async readV4Rooms(root){if(!root)return [];if(this.v4Rooms.has(root))return this.v4Rooms.get(root);const native=this.app.plugins.getPlugin('dungeon-editor');if(!native?.readStructuredRoomDocuments)return [];const rooms=await native.readStructuredRoomDocuments(root+'Karte.dungeon');this.v4Rooms.set(root,rooms);return rooms;}
 async roomReference(path){const file=this.app.vault.getAbstractFileByPath(path);if(file instanceof TFile)return file;const root=this.dungeon(path)?.root,rooms=await this.readV4Rooms(root);return rooms.find(room=>room.path===path)||null;}
 async openV4Room(root,id,sectionId,anchor){const native=this.app.plugins.getPlugin('dungeon-editor'),room=(await this.readV4Rooms(root)).find(item=>item.id===id);if(!native?.openRoomKey||!room)return;await native.openRoomKey(root+'Karte.dungeon',id,sectionId,anchor);await this.playMapPane()?.setRoom(room);this.refreshV4Outline();}
 currentDetailRoom(){const group=this.app.workspace.rootSplit?.children?.find(child=>child.id==='dndrighttabs'),leaf=group?.children?.[group.currentTab??0],file=leaf?.view?.file;if(file instanceof TFile&&this.isRoom(file.path))return file;const state=leaf?.getViewState?.();if(state?.type===NATIVE_ROOM_VIEW){const root=this.dungeon(state.state?.path)?.root;return this.v4Rooms.get(root)?.find(room=>room.id===state.state?.roomId)||null;}return null;}
 refreshV4Outline(){for(const leaf of this.app.workspace.getLeavesOfType(V4_OUTLINE_VIEW))void leaf.view.render?.();}
 playMapPane(){return this.app.workspace.getLeavesOfType(PLAY_MAP_VIEW).map(leaf=>leaf.view).find(view=>view instanceof PlayMapPane&&view.containerEl.isConnected);}
 nativeMapPane(){return this.app.workspace.getLeavesOfType(NATIVE_MAP_VIEW).find(leaf=>leaf.view.containerEl.isConnected);}
 indexPanes(){return Object.values(INDEX_VIEWS).flatMap(config=>this.app.workspace.getLeavesOfType(config.type)).map(leaf=>leaf.view).filter(view=>view instanceof DungeonIndexPane&&view.containerEl.isConnected);}
 refreshIndexes(){for(const pane of this.indexPanes())pane.render().catch(error=>console.error('Spielansicht-Liste:',error));}
 usesMapPane(path){return !!(this.playMapPane()||this.nativeMapPane())&&path===this.dungeon(path)?.overview;}
 async roomMap(file){
  const text=file.text??await this.app.vault.cachedRead(file),matches=[...text.matchAll(/!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)];
  const native=matches.map(m=>({file:this.resolve(m[1],file.path).file,width:Number(m[2]?.split('x')[0])||0})).find(m=>m.file?.extension==='dungeon');
  const images=matches.map(m=>({file:this.resolve(m[1],file.path).file,width:Number(m[2]?.split('x')[0])||0})).filter(m=>m.file&&/^(png|jpe?g|webp|gif|svg)$/i.test(m.file.extension));
  const shared=images.find(m=>/\/Karten\/(?:00 Gesamtplan|Geschoss-[a-zA-Z0-9_-]+)\.svg$/.test(m.file.path));
  const root=this.dungeon(file.path)?.root,nativeFallback=this.app.vault.getAbstractFileByPath(root+'Karte.dungeon');
  const imageFallback=this.app.vault.getAbstractFileByPath(root+'Karten/00 Gesamtplan.svg');
  const chosen=native||(nativeFallback instanceof TFile?{file:nativeFallback,width:0}:null)||shared||images[0]||(imageFallback instanceof TFile?{file:imageFallback,width:0}:null);
  const frontmatter=file instanceof TFile?this.app.metadataCache.getFileCache(file)?.frontmatter:null;
  const roomId=file.number??frontmatter?.room_id??file.basename?.match(/^(\d+)/)?.[1]??null;
  return chosen&&{...chosen,roomId:roomId==null?null:String(roomId)};
 }
 syncRoomMap(file=this.app.workspace.getActiveFile()){
  const structured=this.currentDetailRoom();
  if(structured?.sections){const root=this.dungeon(structured.path)?.root,pane=this.playMapPane();if(root&&pane?.roomPath!==structured.path)void pane.setRoom(structured);return;}
  const activeType=this.app.workspace.activeLeaf?.view?.getViewType?.();
  let target=activeType===PLAY_MAP_VIEW||activeType===NATIVE_MAP_VIEW?null:file;
  let dungeon=this.dungeon(target?.path);
  if(!target||!dungeon||(!this.isRoom(target.path)&&target.path!==dungeon.overview)){
   const group=this.app.workspace.rootSplit?.children?.find(child=>child.id==='dndrighttabs');
   const detail=group?.children?.map(leaf=>leaf.view?.file).find(candidate=>candidate instanceof TFile&&this.isRoom(candidate.path));
   if(detail){target=detail;dungeon=this.dungeon(target.path);}
  }
  file=target;
  if(!file||!dungeon||(!this.isRoom(file.path)&&file.path!==dungeon.overview))return;
  if(this.settings.activeDungeon!==dungeon.root||this.settings.activeOverview!==dungeon.overview){
   this.settings.activeDungeon=dungeon.root;this.settings.activeOverview=dungeon.overview;void this.saveData(this.settings);
  }
  const pane=this.playMapPane(),shared=/\/Karten\/(?:00 Gesamtplan|Geschoss-[a-zA-Z0-9_-]+)\.svg$/.test(pane?.mapPath||'');
  if(pane&&(pane.roomPath!==file.path||shared&&!pane.map&&this.app.plugins.getPlugin('dungeon-auswertung')?.createDungeonMap))pane.setRoom(file).catch(error=>console.error('Spielansicht-Karte:',error));
 }
	 editMap(sourcePath,mapPath){
	  const native=this.app.plugins.getPlugin('dungeon-editor');
	  if(mapPath.endsWith('.dungeon')&&native){const file=this.app.vault.getAbstractFileByPath(mapPath),pane=this.app.workspace.getLeavesOfType(PLAY_MAP_VIEW).find(leaf=>leaf.view.containerEl.isConnected);if(file instanceof TFile&&pane?.parent){let leaf=this.app.workspace.getLeavesOfType(NATIVE_MAP_VIEW).find(candidate=>candidate.parent===pane.parent);if(!leaf)leaf=this.app.workspace.createLeafInParent(pane.parent,pane.parent.children.length);return leaf.openFile(file,{active:true}).then(()=>{this.app.workspace.setActiveLeaf(leaf,{focus:true});this.app.workspace.revealLeaf(leaf);});}return native.openMap(mapPath);}
  const analysis=this.app.plugins.getPlugin('dungeon-auswertung');
  if(analysis?.openMapEditor)return analysis.openMapEditor(sourcePath,{mapPath});
  const file=this.app.vault.getAbstractFileByPath(mapPath);if(file instanceof TFile)return this.open(file);
 }
 async readyLayout(){
  await new Promise(resolve=>this.app.workspace.onLayoutReady(resolve));
  let failure;
  for(let attempt=0;attempt<50;attempt++){
   try{const layout=this.app.workspace.getLayout();if(layout?.main)return layout;}catch(error){failure=error;}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw failure||Error('Obsidian-Layout ist noch nicht bereit.');
 }
 async restoreLayout(path){
  const dungeon=this.dungeon(path);if(!dungeon)return;
  const virtual=await this.readV4Rooms(dungeon.root);
  if(virtual.length)return this.restoreV4Layout(dungeon,virtual,path);
  const {rooms:ROOMS}=dungeon;
  const selected=path?this.app.vault.getAbstractFileByPath(path):null;
  const OVERVIEW=selected instanceof TFile&&selected.extension==='md'&&selected.parent?.path===dungeon.root.slice(0,-1)?selected.path:dungeon.overview;
  this.settings.activeDungeon=dungeon.root;this.settings.activeOverview=OVERVIEW;
  const firstRoom=this.app.vault.getMarkdownFiles().filter(f=>f.path.startsWith(ROOMS)).sort((a,b)=>a.path.localeCompare(b.path))[0]?.path||OVERVIEW;
  const nativeMap=this.app.vault.getAbstractFileByPath(dungeon.root+'Karte.dungeon');
  const w=this.app.workspace,L=await this.readyLayout(),leaves=[];
  const walk=n=>{if(n.type==='leaf')leaves.push(n);else n.children?.forEach(walk);};walk(L.main);
  const usedIds=new Set(leaves.map(n=>n.id));
  const freshId=base=>{let id=base,index=2;while(usedIds.has(id))id=base+index++;usedIds.add(id);return id;};
	  const activeFile=leaves.find(n=>n.id===L.active)?.state?.state?.file;
	  const selectedRoom=leaves.find(n=>this.isRoom(n.state?.state?.file)&&n.state.state.file.startsWith(ROOMS))?.state.state.file||(this.isDungeon(activeFile)?activeFile:firstRoom);
  let overview=leaves.find(n=>n.state?.state?.file===OVERVIEW)||{id:freshId('dndoverview'),type:'leaf',state:{type:'markdown',state:{file:OVERVIEW,mode:'preview'}}};
  overview.pinned=true;overview.state.state.mode='preview';
	  const indexLeaves=Object.entries(INDEX_VIEWS).map(([kind,config])=>{
	   const leaf={id:freshId('dnd'+kind),type:'leaf',state:{}};
	   leaf.pinned=true;leaf.state={type:config.type,state:{root:dungeon.root}};return leaf;
	  });
  const left=[overview,...indexLeaves];
	  const mapLeaf=leaves.find(n=>n.state?.type===PLAY_MAP_VIEW)||{id:freshId('dndplaymap'),type:'leaf',state:{}};
	  mapLeaf.state={type:PLAY_MAP_VIEW,state:{roomPath:selectedRoom},icon:'map',title:'Karte'};
	  const editorLeaves=leaves.filter(n=>n.state?.type===NATIVE_MAP_VIEW);
	  const indexTypes=new Set(Object.values(INDEX_VIEWS).map(config=>config.type));
	  const details=leaves.filter(n=>!left.includes(n)&&n!==mapLeaf&&!editorLeaves.includes(n)&&n.state?.state?.file!==OVERVIEW&&n.state?.type!=='graph'&&n.state?.type!=='empty'&&(n.state?.type!=='markdown'||!!n.state?.state?.file)&&!indexTypes.has(n.state?.type));
  let selectedLeaf=details.find(n=>n.state?.state?.file===selectedRoom);
  if(!selectedLeaf)selectedLeaf={id:freshId('dndinitial'),type:'leaf',state:{type:'markdown',state:{file:selectedRoom,mode:'preview'}}};
  if(details.includes(selectedLeaf))details.splice(details.indexOf(selectedLeaf),1);
  details.unshift(selectedLeaf);
  details.forEach(n=>{if(n.state?.type==='markdown')n.state.state.mode='preview';});
	  L.main={id:L.main.id,type:'split',direction:'vertical',children:[{id:'dndleft',type:'split',direction:'horizontal',dimension:36,children:[{id:'dndmaptabs',type:'tabs',dimension:36,children:[mapLeaf],currentTab:0},{id:'dndlefttabs',type:'tabs',dimension:64,children:left,currentTab:0}]},{id:'dndrighttabs',type:'tabs',dimension:64,children:details,currentTab:0}]};
  if(L.left)L.left.collapsed=true;
  if(L.right){L.right.width=220;L.right.collapsed=false;let found=false;const select=n=>{if(n.type==='tabs'){const i=n.children.findIndex(c=>c.state?.type==='outline');if(i>=0){n.currentTab=i;found=true;}}n.children?.forEach(select);};select(L.right);
  if(!found){L.right.children.push({id:'dndoutlinetabs',type:'tabs',children:[{id:'dndoutline',type:'leaf',state:{type:'outline',state:{}}}]});}}
	  L.active=details[0].id;await w.changeLayout(L);this.settings.initialized=true;this.settings.layoutVersion=7;await this.saveData(this.settings);w.requestSaveLayout();this.refresh();
  const roomFile=this.app.vault.getAbstractFileByPath(selectedRoom);if(roomFile instanceof TFile){
   let pane=this.playMapPane();if(!pane){await new Promise(resolve=>requestAnimationFrame(resolve));pane=this.playMapPane();}
   if(!pane){
    const fallback=await this.roomMap(roomFile);if(!fallback?.file)throw Error('Der Kartenbereich konnte nicht geöffnet werden.');
    await w.getLeaf('split').openFile(fallback.file);new Notice('Kartenbereich nicht verfügbar; Karte separat geöffnet.');return;
   }
   await pane.setRoom(roomFile);
  }
 }
 async restoreV4Layout(dungeon,virtual,path){
  const w=this.app.workspace,L=await this.readyLayout(),leaves=[];
  const walk=n=>{if(n.type==='leaf')leaves.push(n);else n.children?.forEach(walk);};walk(L.main);
  const usedIds=new Set(leaves.map(n=>n.id)),freshId=base=>{let id=base,i=2;while(usedIds.has(id))id=base+i++;usedIds.add(id);return id;};
  const root=dungeon.root,mapPath=root+'Karte.dungeon';
  const selected=path?this.app.vault.getAbstractFileByPath(path):null;
  const overviewPath=selected instanceof TFile&&selected.extension==='md'&&selected.parent?.path===root.slice(0,-1)?selected.path:dungeon.overview;
  const prior=leaves.find(n=>n.state?.type===NATIVE_ROOM_VIEW&&n.state?.state?.path===mapPath);
  const room=virtual.find(item=>item.id===prior?.state?.state?.roomId)||virtual[0];
  this.settings.activeDungeon=root;this.settings.activeOverview=overviewPath;
  const overview=leaves.find(n=>n.state?.state?.file===overviewPath)||{id:freshId('dndoverview'),type:'leaf',state:{type:'markdown',state:{file:overviewPath,mode:'preview'}}};
  overview.pinned=true;overview.state={type:'markdown',state:{file:overviewPath,mode:'preview'}};
  const indexLeaves=Object.entries(INDEX_VIEWS).map(([kind,config])=>({id:freshId('dnd'+kind),type:'leaf',pinned:true,state:{type:config.type,state:{root}}}));
  const mapLeaf=leaves.find(n=>n.state?.type===PLAY_MAP_VIEW)||{id:freshId('dndplaymap'),type:'leaf'};
  mapLeaf.state={type:PLAY_MAP_VIEW,state:{roomPath:room.path},icon:'map',title:'Karte'};
  const indexTypes=new Set(Object.values(INDEX_VIEWS).map(config=>config.type));
  const details=leaves.filter(n=>n!==overview&&n!==mapLeaf&&!indexTypes.has(n.state?.type)&&n.state?.type!==NATIVE_MAP_VIEW&&n.state?.type!=='graph'&&n.state?.type!=='empty'&&n.state?.state?.file!==overviewPath&&!(n.state?.type==='markdown'&&this.isRoom(n.state?.state?.file)));
  let keyLeaf=details.find(n=>n.state?.type===NATIVE_ROOM_VIEW&&n.state?.state?.path===mapPath);
  if(!keyLeaf)keyLeaf={id:freshId('dndinitial'),type:'leaf'};
  keyLeaf.state={type:NATIVE_ROOM_VIEW,state:{path:mapPath,roomId:room.id}};
  const at=details.indexOf(keyLeaf);if(at>=0)details.splice(at,1);details.unshift(keyLeaf);
  details.forEach(n=>{if(n.state?.type==='markdown')n.state.state.mode='preview';});
  L.main={id:L.main.id,type:'split',direction:'vertical',children:[{id:'dndleft',type:'split',direction:'horizontal',dimension:36,children:[{id:'dndmaptabs',type:'tabs',dimension:36,children:[mapLeaf],currentTab:0},{id:'dndlefttabs',type:'tabs',dimension:64,children:[overview,...indexLeaves],currentTab:0}]},{id:'dndrighttabs',type:'tabs',dimension:64,children:details,currentTab:0}]};
  if(L.left)L.left.collapsed=true;
  if(L.right){L.right.width=220;L.right.collapsed=false;let found=false;
   const replace=n=>{if(n.type==='tabs'){const leaf=n.children.find(child=>child.state?.type==='outline'||child.state?.type===V4_OUTLINE_VIEW);if(leaf){leaf.state={type:V4_OUTLINE_VIEW,state:{}};n.currentTab=n.children.indexOf(leaf);found=true;}}n.children?.forEach(replace);};replace(L.right);
   if(!found)L.right.children.push({id:'dndoutlinetabs',type:'tabs',children:[{id:'dndoutline',type:'leaf',state:{type:V4_OUTLINE_VIEW,state:{}}}]});}
  L.active=keyLeaf.id;await w.changeLayout(L);
  this.settings.initialized=true;this.settings.layoutVersion=7;await this.saveData(this.settings);w.requestSaveLayout();this.refresh();
  await this.playMapPane()?.setRoom(room);this.refreshV4Outline();
 }
 rightGroup(){const OVERVIEW=this.dungeon()?.overview;let group=this.app.workspace.rootSplit?.children?.find(c=>c.id==='dndrighttabs');if(group)return group;
 let overview=this.app.workspace.getLeavesOfType('markdown').find(l=>l.view.file?.path===OVERVIEW);
 const groups=(this.app.workspace.rootSplit?.children||[]).filter(c=>c!==overview?.parent&&c.children);return groups.at(-1);}
 async open(file,subpath='',sourceLeaf=null){
  if(!(file instanceof TFile))return;
  const dungeon=this.dungeon(file.path);if(!dungeon)return;const OVERVIEW=dungeon.overview;this.settings.activeDungeon=dungeon.root;
  const w=this.app.workspace;
  if(sourceLeaf?.view.file?.path===file.path&&subpath){await sourceLeaf.openFile(file,{eState:{subpath}});sourceLeaf.view?.setEphemeralState?.({subpath});w.setActiveLeaf(sourceLeaf,{focus:true});return;}
  let leaf;
  if(file.path===OVERVIEW)leaf=w.getLeavesOfType('markdown').find(l=>l.view.file?.path===OVERVIEW);
  else {let group=this.rightGroup();if(!group){await this.restoreLayout();group=this.rightGroup();}
   leaf=group.children.find(l=>(l.view?.file?.path||l.getViewState()?.state?.file)===file.path);
   if(!leaf)leaf=w.createLeafInParent(group,group.children.length);}
  if(!leaf){await this.restoreLayout();leaf=w.getLeavesOfType('markdown').find(l=>l.view.file?.path===OVERVIEW);}
  const already=leaf.view?.file?.path===file.path;
  await leaf.openFile(file,{active:true,...(!already&&file.extension==='md'?{state:{mode:'preview'}}:{}),eState:subpath?{subpath}:{}});
  if(subpath)leaf.view?.setEphemeralState?.({subpath});
  w.setActiveLeaf(leaf,{focus:true});w.requestSaveLayout();if(this.isRoom(file.path))await this.playMapPane()?.setRoom(file);
 }
 click(e){if(e.button!==0||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;
  const a=e.target.closest?.('a.internal-link');if(!a)return;
  const leaf=this.context(a);if(!this.isDungeon(leaf?.view.file?.path))return;
  const {file,subpath}=this.resolve(a.dataset.href||a.getAttribute('href'),leaf.view.file.path);if(!file)return;
  e.preventDefault();e.stopImmediatePropagation();this.closeTip();this.open(file,subpath,leaf);
 }
 createMap(file,savedWidth,sourcePath,roomId=null,nativeOnly=false){
  const native=this.app.plugins.getPlugin('dungeon-editor');if(file.extension==='dungeon'&&native?.createDungeonMap){const map=native.createDungeonMap({path:file.path,source:sourcePath,focusRoom:roomId,compact:true});map.el.style.width='100%';map.el.dungeonMap=map;return map.el;}
  const analysis=this.app.plugins.getPlugin('dungeon-auswertung');if(!nativeOnly&&/\/Karten\/(?:00 Gesamtplan|Geschoss-[a-zA-Z0-9_-]+)\.svg$/.test(file.path)&&analysis?.createDungeonMap){const map=analysis.createDungeonMap({path:file.path,source:sourcePath,focusRoom:roomId});map.el.style.width='100%';map.el.dungeonMap=map;return map.el;}

  const card=document.createElement('div');card.className='dnd-map-card';
  const bar=document.createElement('div');bar.className='dnd-map-tools';bar.setAttribute('aria-label','Kartenansicht: '+file.basename);
  const viewport=document.createElement('div');viewport.className='dnd-map-viewport';viewport.tabIndex=0;viewport.setAttribute('aria-label',file.basename+' – mit Ziehen verschieben, mit Plus und Minus zoomen');
  const img=document.createElement('img');img.alt=file.basename;img.draggable=false;img.dataset.mapPath=file.path;viewport.append(img);
  let width=0,drag=null,moved=false;
  const label=document.createElement('span');label.className='dnd-map-scale';label.setAttribute('aria-live','polite');
  const setWidth=(next,center=true)=>{
   if(!img.naturalWidth)return;const old=width||next;
   const x=(viewport.scrollLeft+viewport.clientWidth/2)/old,y=(viewport.scrollTop+viewport.clientHeight/2)/old;
   width=Math.min(img.naturalWidth*4,Math.max(80,next));img.style.width=width+'px';
   label.textContent=Math.round(width/img.naturalWidth*100)+'%';
   if(center){viewport.scrollLeft=x*width-viewport.clientWidth/2;viewport.scrollTop=y*width-viewport.clientHeight/2;}
  };
  const control=(text,title,fn)=>{const b=document.createElement('button');b.textContent=text;b.type='button';b.title=title;b.setAttribute('aria-label',title);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn();});bar.append(b);};
  control('−','Karte verkleinern',()=>setWidth(width/1.25));control('+','Karte vergrößern',()=>setWidth(width*1.25));bar.append(label);
  control('Einpassen','Gesamte Karte einpassen',()=>{setWidth(Math.min(viewport.clientWidth,620*img.naturalWidth/img.naturalHeight),false);viewport.scrollTo(0,0);});
  control('1:1','Originalauflösung',()=>setWidth(img.naturalWidth));control('Maximieren','Karte maximieren und bearbeiten',()=>this.editMap(sourcePath,file.path));
  img.addEventListener('load',()=>setWidth(width||savedWidth||Math.min(600,img.naturalWidth),false));img.src=this.app.vault.getResourcePath(file);
  viewport.addEventListener('pointerdown',e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};moved=false;viewport.setPointerCapture(e.pointerId);viewport.classList.add('is-dragging');});
  viewport.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;if(moved){viewport.scrollLeft=drag.left-dx;viewport.scrollTop=drag.top-dy;}});
  const stop=()=>{drag=null;viewport.classList.remove('is-dragging');};viewport.addEventListener('pointerup',stop);viewport.addEventListener('pointercancel',()=>{moved=true;stop();});viewport.addEventListener('lostpointercapture',stop);
  viewport.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;e.preventDefault();e.stopPropagation();if(!moved)this.open(file);moved=false;});
  viewport.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(['+','=','-'].includes(e.key)){e.preventDefault();e.stopPropagation();setWidth(width*(e.key==='-'?1/1.25:1.25));}});
  card.append(bar,viewport);return card;
 }
 async decorate(el,path){
  const view=el.closest('.markdown-preview-view');if(!view)return;
  const h=el.querySelector('h1');if(!h)return;
  if(this.playMapPane()||this.nativeMapPane()){
   view.classList.add('dnd-room-view');
   for(const rail of view.querySelectorAll('.dnd-room-media')){rail.querySelectorAll('.dungeon-shared-map').forEach(m=>m.dungeonMap?.destroy());rail.remove();}
   return;
  }
  if(el.querySelector('.dnd-room-media'))return;
  const file=this.app.vault.getAbstractFileByPath(path);if(!file)return;
  const text=await this.app.vault.cachedRead(file);if(!this.alive||!el.isConnected||el.querySelector('.dnd-room-media'))return;
  const files=[...text.matchAll(/!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)].map(m=>({file:this.resolve(m[1],path).file,width:Number(m[2]?.split('x')[0])||0})).filter(m=>m.file&&/^(png|jpe?g|webp|gif|svg)$/i.test(m.file.extension));
  if(!files.length)return;
  const rail=document.createElement('div');rail.className='dnd-room-media';
  rail.style.setProperty('--dnd-map-width',Math.max(...files.map(m=>m.width||500))+'px');
  for(const m of files)rail.append(this.createMap(m.file,m.width,path));
  el.prepend(rail);view.classList.add('dnd-room-view');
  if(!this.rooms.has(view)){const ro=new ResizeObserver(()=>view.classList.toggle('dnd-narrow',view.clientWidth<560));ro.observe(view);this.rooms.set(view,ro);}view.classList.toggle('dnd-narrow',view.clientWidth<560);
 }
 refreshMaps(changed=null){
  for(const img of document.querySelectorAll('.dnd-room-media img[data-map-path]')){
   if(changed&&img.dataset.mapPath!==changed.path)continue;
   const file=this.app.vault.getAbstractFileByPath(img.dataset.mapPath);if(!(file instanceof TFile))continue;
   const src=this.app.vault.getResourcePath(file);if(img.getAttribute('src')!==src)img.src=src;
  }
 }
 labelOverview(){
  const overview=this.dungeon()?.overview,leaf=this.app.workspace.getLeavesOfType('markdown').find(candidate=>candidate.view.file?.path===overview&&candidate.parent?.id==='dndlefttabs');
  if(!leaf)return;
  leaf.tabHeaderInnerTitleEl.textContent='Übersicht';
  leaf.tabHeaderEl.classList.add('dnd-index-tab');
  leaf.tabHeaderEl.setAttribute('aria-label','Übersicht');
  leaf.tabHeaderEl.setAttribute('data-tooltip-position','top');
 }
 refresh(){this.refreshMaps();for(const l of this.app.workspace.getLeavesOfType('markdown')){if(this.isRoom(l.view.file?.path)&&l.view.getMode()==='preview'){const v=l.view.previewMode.containerEl;if(!this.observers.has(v)){const mo=new MutationObserver(()=>{const leaf=this.context(v);if(this.isRoom(leaf?.view.file?.path))for(const el of v.querySelectorAll('.el-h1'))this.decorate(el,leaf.view.file.path);});mo.observe(v,{childList:true,subtree:true});this.observers.set(v,mo);}for(const el of v.querySelectorAll('.el-h1'))this.decorate(el,l.view.file.path);}}
  const overview=this.dungeon()?.overview,pane=this.playMapPane(),layoutMap=pane||this.nativeMapPane(),analysis=this.app.plugins.getPlugin('dungeon-auswertung');
  if(layoutMap)for(const leaf of this.app.workspace.getLeavesOfType('markdown'))if(this.isRoom(leaf.view.file?.path)&&leaf.view.getMode()==='preview'){
   const view=leaf.view.previewMode.containerEl;view.classList.add('dnd-room-view');
   for(const rail of view.querySelectorAll('.dnd-room-media')){rail.querySelectorAll('.dungeon-shared-map').forEach(el=>el.dungeonMap?.destroy());rail.remove();}
  }
  for(const leaf of this.app.workspace.getLeavesOfType('markdown')){
   leaf.view.containerEl.classList.toggle('dnd-play-overview',!!layoutMap&&leaf.view.file?.path===overview);
   leaf.view.containerEl.classList.toggle('dnd-play-room',!!layoutMap&&this.isRoom(leaf.view.file?.path));
  }
  if(pane&&analysis?.maps)for(const map of [...analysis.maps])if(map.source===overview&&map.el.isConnected&&map.el.closest('.markdown-preview-view'))map.destroy();
  this.syncRoomMap();
  this.labelOverview();
  for(const [v,mo]of this.observers){if(!v.isConnected||!this.isRoom(this.context(v)?.view.file?.path)){mo.disconnect();this.observers.delete(v);}}
  for(const [v,ro] of this.rooms){const leaf=this.context(v);if(!v.isConnected||!this.isRoom(leaf?.view.file?.path)){ro.disconnect();v.classList.remove('dnd-room-view','dnd-narrow');v.querySelectorAll('.dnd-room-media').forEach(e=>{e.querySelectorAll('.dungeon-shared-map').forEach(m=>m.dungeonMap?.destroy());e.remove();});this.rooms.delete(v);}}}
 hover(e){const a=e.target.closest?.('a.internal-link,a[href^="obsidian://dungeon-room?"]');if(!a)return;const virtual=a.getAttribute('href')?.startsWith('obsidian://dungeon-room?'),leaf=this.context(a);if(!virtual&&!this.isDungeon(leaf?.view.file?.path))return;
  // Capture before Obsidian's hover handlers; keep explicit modifier gestures native.
  if(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;e.stopImmediatePropagation();
  if(!this.aria.has(a))this.aria.set(a,a.getAttribute('aria-label'));a.removeAttribute('aria-label');
  clearTimeout(this.hideTimer);if(this.hovered===a)return;this.closeTip();this.hovered=a;
  this.hoverTimer=setTimeout(()=>this.showTip(a,leaf?.view.file?.path||this.settings.activeOverview),350);
 }
 leave(e){if(this.hovered&&e.target.closest?.('a.internal-link,a[href^="obsidian://dungeon-room?"]')===this.hovered&&!this.hovered.contains(e.relatedTarget)){clearTimeout(this.hoverTimer);this.hideTimer=setTimeout(()=>this.closeTip(),180);}}
 async showTip(a,source){let text;const href=a.getAttribute('href')||'';
  if(href.startsWith('obsidian://dungeon-room?')){const query=new URL(href).searchParams,root=this.dungeon(source)?.root,room=(await this.readV4Rooms(root)).find(item=>item.id===query.get('room'));if(!room)return;text=excerpt(room.text,true,query.get('anchor')||'');}
  else{const {file,subpath}=this.resolve(a.dataset.href||href,source);if(!file||file.extension!=='md')return;text=excerpt(await this.app.vault.cachedRead(file),this.isRoom(file.path),subpath.slice(1));}
  if(!this.alive||this.hovered!==a||!text)return;
  const tip=document.createElement('div');tip.className='dnd-text-preview';tip.setAttribute('role','tooltip');tip.textContent=text;document.body.append(tip);this.tip=tip;
  tip.addEventListener('mouseenter',()=>clearTimeout(this.hideTimer));tip.addEventListener('mouseleave',()=>this.closeTip());
  const r=a.getBoundingClientRect(),b=tip.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(r.left,innerWidth-b.width-8))+'px';tip.style.top=(r.bottom+b.height+12<innerHeight?r.bottom+6:Math.max(8,r.top-b.height-6))+'px';
 }
 closeTip(){clearTimeout(this.hoverTimer);clearTimeout(this.hideTimer);this.hovered=null;this.tip?.remove();this.tip=null;}
 onunload(){this.alive=false;this.closeTip();for(const mo of this.observers.values())mo.disconnect();for(const [v,ro]of this.rooms){ro.disconnect();v.classList.remove('dnd-room-view','dnd-narrow');}document.querySelectorAll('.dnd-play-overview,.dnd-play-room').forEach(e=>e.classList.remove('dnd-play-overview','dnd-play-room'));document.querySelectorAll('.dnd-room-media').forEach(e=>{e.querySelectorAll('.dungeon-shared-map').forEach(m=>m.dungeonMap?.destroy());e.remove();});for(const [a,label]of this.aria)if(label!==null)a.setAttribute('aria-label',label);}
}
module.exports=Spielansicht;module.exports.excerpt=excerpt;
