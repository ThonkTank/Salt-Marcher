import type {Workspace} from './contracts';
import type {ChronicleCategory,ChronicleView} from './chronicle-contracts';

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
let workspace:Workspace|null=null,data:ChronicleView|null=null,generation=0,tell:(message:string,error?:boolean)=>void,openFollowUp:((id:string)=>Promise<void>)|null=null;
let searchTimer:ReturnType<typeof setTimeout>|null=null;
const labels:Record<ChronicleCategory,string>={combat:'Kampf',narrative:'Quest',reward:'Beute',travel:'Reise',party:'Party',world:'Welt'};
function matches(entry:ChronicleView['entries'][number]){const category=el<HTMLSelectElement>('chronicle-category').value,needle=el<HTMLInputElement>('chronicle-search').value.trim().toLocaleLowerCase();return(category==='all'||entry.category===category)&&(!needle||[entry.title,entry.summary,entry.scene,entry.location,...entry.people].some(v=>v?.toLocaleLowerCase().includes(needle)));}
function draw(){
 const list=el('chronicle-list');list.replaceChildren();if(!data)return;const entries=data.entries.filter(matches);el('chronicle-count').textContent=entries.length+' '+(entries.length===1?'Eintrag':'Einträge')+(data.truncated?' · neueste passende Ereignisse; ältere fehlen · Suche eingrenzen':'');
 if(!entries.length){const p=document.createElement('p');p.className='chronicle-empty';p.textContent='Keine passenden bestätigten Ereignisse.';list.append(p);return;}
 let day='';for(const entry of entries){const when=new Date(entry.recordedAt),nextDay=Number.isNaN(when.valueOf())?'Ohne Datum':when.toLocaleDateString('de-DE',{dateStyle:'full'});if(nextDay!==day){day=nextDay;const heading=document.createElement('h3');heading.textContent=day;list.append(heading);}const article=document.createElement('article');article.className='chronicle-entry';article.dataset.category=entry.category;const header=document.createElement('div'),badge=document.createElement('span'),title=document.createElement('h4'),time=document.createElement('time');header.className='chronicle-entry-heading';badge.className='chronicle-badge';badge.textContent=labels[entry.category];title.textContent=entry.title;time.dateTime=entry.recordedAt;time.textContent=Number.isNaN(when.valueOf())?'':when.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});header.append(badge,title,time);article.append(header);if(entry.summary){const p=document.createElement('p');p.textContent=entry.summary;article.append(p);}const context=[entry.scene&&'Gruppe: '+entry.scene,entry.location&&'Ort: '+entry.location,entry.people.length&&'Beteiligte: '+[...new Set(entry.people)].join(', ')].filter(Boolean);if(context.length){const p=document.createElement('p');p.className='caption';p.textContent=context.join(' · ');article.append(p);}if(entry.followUp&&openFollowUp){const button=document.createElement('button');button.type='button';button.textContent=(entry.followUp.kind==='quest'?'Quest':'Gerücht')+' öffnen';button.onclick=()=>void openFollowUp!(entry.followUp!.id);article.append(button);}list.append(article);}
}
export function initChronicle(status:typeof tell,open?:typeof openFollowUp){tell=status;openFollowUp=open??null;el('chronicle-refresh').onclick=()=>void openChronicle();el('chronicle-search').oninput=()=>{if(searchTimer)clearTimeout(searchTimer);generation++;clearChronicle();el('chronicle').setAttribute('aria-busy','true');el('chronicle-count').textContent='Chronik wird geladen…';searchTimer=setTimeout(()=>void openChronicle(),150);};el('chronicle-category').onchange=()=>void openChronicle();el('chronicle-export').onclick=()=>void exportChronicle();}
function problem(error:unknown){return(error as Error).message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');}
function clearChronicle(){data=null;el('chronicle-list').replaceChildren();el('chronicle-count').textContent='';el<HTMLButtonElement>('chronicle-export').disabled=true;}
export function activateChronicle(next:Workspace|null){if(searchTimer)clearTimeout(searchTimer);searchTimer=null;workspace=next;generation++;clearChronicle();el('chronicle').setAttribute('aria-busy','false');}
export async function openChronicle(){
 if(searchTimer)clearTimeout(searchTimer);searchTimer=null;
 const current=workspace,version=++generation;clearChronicle();if(!current)return;
 const category=el<HTMLSelectElement>('chronicle-category').value as ChronicleCategory|'all',search=el<HTMLInputElement>('chronicle-search').value;
 el('chronicle').setAttribute('aria-busy','true');el('chronicle-count').textContent='Chronik wird geladen…';
 try{
  const result=await window.campaign.chronicle(current.token,category,search);
  if(version!==generation||workspace?.token!==current.token)return;
  if(!result.ok)throw new Error(result.error);
  data=result.value;draw();el<HTMLButtonElement>('chronicle-export').disabled=false;tell('Kampagnenchronik aktualisiert.');
 }catch(error){
  if(version!==generation||workspace?.token!==current.token)return;
  clearChronicle();const message=document.createElement('p');message.setAttribute('role','alert');message.textContent='Chronik konnte nicht geladen werden. Mit Aktualisieren erneut versuchen. '+problem(error);el('chronicle-list').append(message);tell('Chronik konnte nicht geladen werden. Bitte aktualisieren.',true);
 }finally{if(version===generation)el('chronicle').setAttribute('aria-busy','false');}
}
async function exportChronicle(){if(!workspace||!data)return;const category=el<HTMLSelectElement>('chronicle-category').value as ChronicleCategory|'all',search=el<HTMLInputElement>('chronicle-search').value;try{const result=await window.campaign.exportChronicle(workspace.token,category,search);if(!result.ok)throw new Error(result.error);tell(result.value.cancelled?'Chronik-Ausgabe abgebrochen.':'Chronik als Markdown gespeichert.');}catch(error){tell(problem(error),true);}}
