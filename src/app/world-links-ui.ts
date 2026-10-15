import {plainReferenceText} from './text-references';
import type {Workspace,Result} from './contracts';
import type {DeskContent} from './scene-desk-contracts';
import type {WorldLinksPage,WorldLinkRef,WorldLinksQuery} from './world-links-contracts';
import {worldLinkKey,worldLinkKinds} from './world-links-contracts';
import {WorldLinksMap} from './world-links-map';
import {openQuickReference} from './quick-reference-ui';

const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const button=(text:string,fn:()=>void)=>{const n=node('button',text);n.type='button';n.onclick=fn;return n;};
const unwrap=<T>(r:Result<T>):T=>{if(!r.ok)throw new Error(r.error);return r.value;};

// Exploration only. Authored text and relationships keep their existing editor and writer.
export class WorldLinksWorkbench {
 private dialog=node('dialog');private status=node('p');private search=node('input');private kind=node('select');
 private list=node('div');private inspector=node('section');private caption=node('p');private graph:WorldLinksMap;
 private owner:Workspace|null=null;private focus:WorldLinkRef|null=null;private offset=0;private request=0;
 private history:WorldLinkRef[]=[];
 private prev=button('Vorige 40',()=>{this.offset=Math.max(0,this.offset-40);void this.read();});
 private next=button('Nächste 40',()=>{this.offset+=40;void this.read();});
 constructor(private workspace:()=>Workspace|null,private drain:()=>Promise<boolean>,private tell:(text:string,error?:boolean)=>void,private openSource:(ref:WorldLinkRef,current:()=>boolean)=>Promise<void>){
  this.graph=new WorldLinksMap(ref=>{if(this.dialog.getAttribute('aria-busy')!=='true')this.select(ref);});
  this.dialog.id='world-links';this.dialog.className='world-links';this.dialog.setAttribute('aria-labelledby','world-links-heading');
  const heading=node('h2','Zusammenhänge der Kampagne');heading.id='world-links-heading';
  const head=node('div');head.className='toolbar';head.append(heading,button('Stand aktualisieren',()=>void this.read()),button('Schließen',()=>this.reset()));
  this.status.id='world-links-status';this.status.setAttribute('role','status');
  this.search.id='world-links-search';this.search.type='search';this.search.placeholder='Name, Notiz oder Ort suchen';this.search.setAttribute('aria-label','Kampagnenzusammenhänge durchsuchen');
  this.kind.id='world-links-kind';this.kind.setAttribute('aria-label','Inhaltsart');this.kind.add(new Option('Welt der Kampagne','world'));this.kind.add(new Option('Welt und Kataloge','all'));this.kind.add(new Option('Verknüpfte Begriffe','reference'));
  for(const [id,label]of Object.entries(worldLinkKinds))this.kind.add(new Option(label,id));
  this.list.id='world-links-list';const pages=node('div');pages.className='toolbar';pages.append(this.prev,this.next);
  const nav=node('section');nav.className='world-links-nav';for(const [title,input]of [['Suche',this.search],['Inhalte',this.kind]] as const){const label=node('label',title);label.append(input);nav.append(label);}nav.append(this.caption,this.list,pages);
  const map=node('section'),tools=node('div');tools.className='toolbar';
  tools.append(button('+ Näher',()=>this.graph.zoom(.8)),button('− Weiter',()=>this.graph.zoom(1.25)),button('Einpassen',()=>this.graph.fit()),button('Trefferübersicht',()=>{this.focus=null;void this.read(false);}),node('span','Durchgezogen: Beziehungen · gestrichelt: Orts-/Fraktionsbindung'));
  map.append(tools,this.graph.root);this.inspector.id='world-links-inspector';const body=node('div');body.className='world-links-columns';body.append(nav,map,this.inspector);
  this.dialog.append(head,this.status,body);document.body.append(this.dialog);
  this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.reset();});
  const search=()=>{this.offset=0;this.focus=null;this.history=[];void this.read();};
  this.search.oninput=search;this.search.onchange=this.kind.onchange=search;
 }
 reset(){this.request++;this.owner=null;this.focus=null;this.history=[];this.list.replaceChildren();this.inspector.replaceChildren();this.graph.root.replaceChildren();this.dialog.close();}
 private current(owner:Workspace,request:number){return this.owner===owner&&this.workspace()?.token===owner.token&&this.request===request&&this.dialog.open;}
 async open(ref?:WorldLinkRef){if(this.dialog.open){if(ref)this.select(ref);return;}const w=this.workspace(),n=++this.request;if(!w||!await this.drain()||this.workspace()?.token!==w.token||this.request!==n)return;this.owner=w;this.search.value='';this.kind.value='world';this.focus=ref??null;this.offset=0;this.dialog.showModal();await this.read();}
 contextChanged(){if(this.owner&&this.workspace()?.token!==this.owner.token)this.reset();}
 private select(ref:WorldLinkRef){if(this.focus&&worldLinkKey(this.focus)!==worldLinkKey(ref)){this.history.push(this.focus);if(this.history.length>30)this.history.shift();}this.focus=ref;void this.read();}
 private async read(selectFirst=true){
  const w=this.owner,n=++this.request;if(!w)return;const current=()=>this.current(w,n);
  this.dialog.setAttribute('aria-busy','true');this.prev.disabled=this.next.disabled=true;
  this.list.replaceChildren();this.inspector.replaceChildren();this.graph.root.replaceChildren();this.caption.textContent='';this.status.textContent='Zusammenhänge werden gelesen…';
  const control=(text:string,fn:()=>void)=>{const b=button(text,()=>{if(current()&&b.isConnected)fn();});return b;};
  try{
   const query:WorldLinksQuery={text:this.search.value,kind:this.kind.value as WorldLinksQuery['kind'],offset:this.offset,focus:this.focus};
   const page=unwrap(await window.campaign.worldLinks(w.token,query));if(!current())return;
   const ref=page.focus?.ref??null,content=ref&&selectFirst?unwrap(await window.campaign.deskContent(w.token,ref)):null;if(!current())return;
   this.focus=selectFirst?ref:null;this.caption.textContent=(page.matches.length?this.offset+1+'–'+(this.offset+page.matches.length):'Keine Treffer')+' · '+page.edges.length+' Verbindungen'+(page.hiddenLinks?' · weitere Verbindungen an den Quellen lesen':'');
   this.prev.disabled=!this.offset;this.next.disabled=page.next===null;
   for(const entry of page.matches){const b=control((entry.alias?entry.alias+' → ':'')+entry.title+' · '+worldLinkKinds[entry.kind],()=>this.select(entry.ref));b.dataset.worldRef=worldLinkKey(entry.ref);b.setAttribute('aria-pressed',String(this.focus&&worldLinkKey(this.focus)===worldLinkKey(entry.ref)));this.list.append(b);}
   this.graph.draw(selectFirst?page:{...page,focus:null},current);
   if(content)this.renderContent(content,page,control);else this.inspector.append(node('p',page.matches.length?'Inhalt auswählen, um seine Verbindungen zu lesen.':'Keine Inhalte gefunden.'));
   this.status.textContent='Knoten auswählen und Verbindungen erkunden. Texte und Beziehungen im vorhandenen Quelleneditor bearbeiten.';
  }catch(e){if(current()){const text=(e as Error).message;this.status.textContent=text;this.tell(text,true);}}
  finally{if(current())this.dialog.setAttribute('aria-busy','false');}
 }
 private handoff(work:(current:()=>boolean)=>Promise<void>){
  const w=this.owner!;this.reset();const n=this.request,current=()=>this.request===n&&this.workspace()?.token===w.token;
  void work(current).catch(e=>{if(current())this.tell((e as Error).message,true);});
 }
 private renderContent(content:DeskContent,page:WorldLinksPage,control:(text:string,fn:()=>void)=>HTMLButtonElement){
  const tools=node('div');tools.className='toolbar';
  tools.append(control(content.note?'Quelle und Beziehungen bearbeiten…':'Quelle bearbeiten…',()=>this.handoff(current=>this.openSource(content.ref as WorldLinkRef,current))));
  if(content.creature||content.item||content.encounter)tools.append(control('Referenz lesen…',()=>this.handoff(current=>openQuickReference(content.ref,current))));
  if(this.history.length)tools.append(control('Zurück',()=>{this.focus=this.history.pop()!;void this.read();}));
  this.inspector.append(node('h3',content.title),node('p',content.label+(content.unavailable?' · nicht verfügbar':'')),tools);
  const text=(title:string,value:string)=>{if(value)this.inspector.append(node('h4',title),node('pre',plainReferenceText(value)));};
  if(content.note){text('Zum Vorlesen',content.note.readAloud);text('GM-Notizen',content.note.gmNotes);}
  if(content.location)for(const section of content.location.sections)text(section.title,section.markdown);
  const ref=content.ref,key=worldLinkKey(ref as WorldLinkRef),title=(ref:WorldLinkRef)=>page.nodes.find(n=>worldLinkKey(n.ref)===worldLinkKey(ref))?.title??'Nicht verfügbar';
  for(const [heading,edges,incoming]of [
   ['Ausgehende Beziehungen und Bindungen',page.edges.filter(e=>worldLinkKey(e.source)===key),false],
   ['Eingehende Verbindungen',page.edges.filter(e=>worldLinkKey(e.target)===key),true],
  ] as const){if(!edges.length)continue;this.inspector.append(node('h3',heading));for(const edge of edges){const target=incoming?edge.source:edge.target;this.inspector.append(control(incoming?title(target)+' → '+edge.label:edge.label+' → '+title(target),()=>this.select(target)));}}
 }
}
