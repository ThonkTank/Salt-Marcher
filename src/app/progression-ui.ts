import {beginFinishDraft,resetFinishDraft,markFinishDraft,flushFinishDraft} from './finish-draft-ui';
import type {FinishOwner,RewardItemDraft} from './finish-draft-contracts';
import {drawLedgerStacks} from './ledger-stack-ui';
import {rewardItemsEditor} from './reward-items-ui';
import {writeConfirmed,hasPendingCommit,initCommitControls,updateCommitControls,onCommitState,onCommitResolved,type CommitResolution} from './commit-confirmation';
import type { Workspace, Result } from './contracts';
import type { LiveView } from './live-contracts';
import type { EncounterAssessment } from './encounter-contracts';
import { xpLevel, xpShare, restFrame, gold, ledgerCopper, type CharacterHealth, type ProgressView, type ProgressAck, type ProgressAction, type ProgressCommand, type ItemInput, type ItemCategory, type FinishRewards, type ProgressHistory, type Treasure, type TreasurePage, type LedgerPage, type LedgerItem } from './progression';
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => get<HTMLInputElement>(id).value;
const unwrap = <T>(r: Result<T>): T => { if (!r.ok) throw new Error(r.error); return r.value; };
let workspace: Workspace | null = null, live: LiveView | null = null, selected: string | null = null, view: ProgressView | null = null;
let contextBasis = '';
let generation = 0, loadNumber = 0, pending: Promise<boolean> | null = null, selectedLedger: string | null = null;
let treasures: TreasurePage = {items:[],next:null}, treasure: Treasure | null = null, ledger: LedgerPage = {items:[],problems:[],unavailableCount:0,next:null,totalCopper:'0'};
let selectedTreasure: string | null = null;
let ledgerRequest=0, treasureRequest=0;
let ledgerDetailRequest=0, ledgerDetail: LedgerItem | null = null, ledgerLoaded=false;
let finishBasis: ProgressView | null = null;let finishItems:RewardItemDraft[]=[];
let history: ProgressHistory = { items: [], next: null };
let tell: (text: string, error?: boolean) => void;
const healthFields=['health-current','health-maximum','health-temporary','health-conditions','health-reason'] as const;
type HealthDraft={revision:number;basis:string;values:Record<string,string>;concentrating:boolean};
const healthDrafts=new Map<string,HealthDraft>();
const progressListeners=new Set<()=>void>();
export function onProgressChanged(listener:()=>void){progressListeners.add(listener);}
function publishProgress(){for(const listener of progressListeners)listener();}
const healthKey=()=>workspace&&selected?workspace.campaign.id+':'+selected:null;
export function progressionContext(next: Workspace | null, data: LiveView | null, characterId: string | null) {
  const basis = JSON.stringify([next?.token, data?.rosterRevision, data?.focusId]);
  const changed = basis !== contextBasis; contextBasis = basis;
  const selectionChanged = characterId !== selected;
  const activationChanged = next?.token !== workspace?.token;
  if (selectionChanged || next?.token !== workspace?.token) { ledger={items:[],problems:[],unavailableCount:0,next:null,totalCopper:'0'}; ledgerDetail=null; selectedLedger=null; ledgerLoaded=false; }
  if (next?.token !== workspace?.token) { generation++;pending=null; view = null; selectedLedger = null; selectedTreasure=null; treasures={items:[],next:null};treasure=null;ledger={items:[],problems:[],unavailableCount:0,next:null,totalCopper:'0'}; get('progress-notices').replaceChildren(); }
  workspace = next; live = data; selected = characterId;updateCommitControls();
  get('reward-panel').hidden = !data; get('character-progression').hidden = !data || !selected;
  if(activationChanged)render();
  if (changed && next && data) void refreshProgress(); else if (selectionChanged) { selectedLedger=null; render(); void loadHistory(); void loadLedger(); }
}
export async function refreshProgress(deliverNotices=true) {
  if (!workspace) return;
  const gen = generation, request = ++loadNumber;
  try { const result = unwrap(await window.campaign.progress(workspace.token)); if (gen !== generation || request !== loadNumber) return; view = result; const parties=unwrap(await window.campaign.ledgerParties(workspace.token));if(gen!==generation)return;const counterpart=get<HTMLSelectElement>('ledger-linked-counterparty'),old=counterpart.value;counterpart.replaceChildren();option(counterpart,'','Nur Freitext');for(const p of parties)option(counterpart,p.kind+':'+p.id,p.kind+': '+p.name);counterpart.value=old;await Promise.all([loadTreasures(),loadLedger()]); render(); if(deliverNotices)showNotices(); void loadHistory(); }
  catch (error) { if (gen === generation) tell((error as Error).message, true); }
}
async function execute(action: ProgressAction): Promise<boolean> {
  if (!workspace || pending||hasPendingCommit(workspace.campaign.id)) return false;
  loadNumber++; // Pending reads cannot replace the receipt of this confirmed write.
  const gen = generation, command: ProgressCommand = { commandId: crypto.randomUUID(), campaignId: workspace.campaign.id, token: workspace.token, action:structuredClone(action) };
  const meta={owner:'progress',token:workspace.token,generation:gen,action:command.action,healthDraft:action.kind==='health'?structuredClone(healthDrafts.get(workspace.campaign.id+':'+action.characterId)):undefined};
  const task=Promise.resolve().then(async () => {
    try {
      const result = await writeConfirmed<ProgressAck>('progress',command,()=>window.campaign.executeProgress(command),()=>workspace?.token===command.token&&gen===generation,meta); if (gen !== generation) return false;
      view = result; publishProgress();tell(action.kind==='health'?'HP gespeichert.':'Fortschritt und Beute gespeichert.'); void loadHistory();
      if (['treasure','allocate','manual-item','ledger','ledger-split','ledger-merge','ledger-transfer','narrative-award'].includes(action.kind)) {
        try {
          await Promise.all([loadTreasures(false,result.treasureId??undefined),loadLedger()]);
          if (result.ledgerIds?.[0] && (action.kind !== 'manual-item' || action.characterId === selected)) await loadLedgerItem(result.ledgerIds[0]);
        } catch (error) { tell('Speicherung bestätigt; Anzeige konnte nicht aktualisiert werden: '+(error as Error).message,true); }
      }
      return true;
    }
    catch (error) { if (gen === generation) tell((error as Error).message, true); return false; }
    finally { if(pending===task)pending = null; if (gen === generation) render(); }
  });pending=task;lock();return task;
}
export async function flushProgress() { if(!await flushFinishDraft())return false; if(pending)return await pending;return !workspace||!hasPendingCommit(workspace.campaign.id); }
function ledgerUnavailable(){return !!selectedLedger&&ledger.problems.some(p=>p.id===selectedLedger);}
function lock() {
  const blocked=!!pending||!!workspace&&hasPendingCommit(workspace.campaign.id);
  for (const root of ['character-progression','reward-panel']) for (const c of get(root).querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('button,input,select,textarea')) c.disabled = blocked;
  for(const button of get('ledger-form').querySelectorAll<HTMLButtonElement>('button'))button.disabled=blocked||!!selectedLedger&&(!ledgerLoaded||ledgerUnavailable());
  const p=view?.characters.find(p=>p.characterId===selected),key=healthKey(),dirty=key?healthDrafts.has(key):false;
  for(const c of get('health-form').querySelectorAll<HTMLInputElement|HTMLButtonElement>('input,button'))c.disabled=blocked||!!p?.healthCombat;
  for(const id of ['health-amount','health-damage','health-heal'])get<HTMLInputElement|HTMLButtonElement>(id).disabled=blocked||!p?.health||!!p.healthCombat||dirty;
}
function showNotices() {
  if (!view?.notices.length) return;
  const notices = view.notices.slice();
  for (const n of notices) { const p = document.createElement('p'); p.textContent = (view.characters.find(c => c.characterId === n.characterId)?.name ?? 'Figur') + ': ' + n.text; get('progress-notices').append(p); }
  void execute({ kind: 'notice', ids: notices.map(n => n.id) });
}
function option(select: HTMLSelectElement, id: string, text: string) { const o = document.createElement('option'); o.value = id; o.textContent = text; select.append(o); }
function render() {
  const p = view?.characters.find(p => p.characterId === selected);
  get('progress-summary').textContent = p?.xp === null || !p ? 'XP noch nicht eingetragen.' : 'Level ' + xpLevel(p.xp).level + ' · ' + p.xp + ' XP' + (xpLevel(p.xp).next === null ? ' · Höchstes Level' : ' · Nächstes Level bei ' + xpLevel(p.xp).next + ' XP');
  const meter = get<HTMLProgressElement>('xp-meter'); meter.hidden = !p || p.xp === null;
  if (p?.xp !== null && p) { const l = xpLevel(p.xp); meter.max = l.next === null ? 1 : l.next - l.floor; meter.value = l.next === null ? 1 : p.xp - l.floor; }
  const frame = p ? restFrame(p) : null;
  get('rest-summary').textContent = !p ? '' : !frame ? 'Rastbudget noch unbekannt. XP eintragen und bei Altfiguren eine lange Rast bestätigen.' : frame.overdue ? 'Lange Rast fällig · Verbrauch ' + frame.consumed + ' / ' + frame.budget + ' XP' : 'Tagesbelastung ' + frame.consumed + ' / ' + frame.budget + ' · ' + frame.sections + ' Abschnitte · nächste Rast bei ' + Math.ceil(frame.nextRest) + ' XP';
  const restMeter = get<HTMLProgressElement>('rest-meter'); restMeter.hidden = !frame; restMeter.max = 1; restMeter.value = frame?.fill ?? 0;
  const status=p?.health??p?.lastCombatStatus;
  get('health-summary').textContent = (p?.health?'HP: '+p.health.hp+' / '+p.health.maxHp:'HP noch offen.')+(status?.tempHp?' + '+status.tempHp+' temporär':'')+(status?.conditions?' · '+status.conditions:'')+(status?.concentrating?' · Konzentration':'');
  const death=p?.health?.death,panel=get('death-saves');panel.hidden=!p?.health||p.health.hp>0||!!p.healthCombat;if(!panel.hidden)get('death-summary').textContent=death?.dead?'Tot':death?.stable?'Stabilisiert':'Todesrettungswürfe: '+(death?.successes??0)+' Erfolge · '+(death?.failures??0)+' Fehlschläge';
  renderHealth(p);
  const rest = get('rest-members'); rest.replaceChildren();
  for (const c of view?.characters.filter(c => c.active && c.sceneId === live?.focusId) ?? []) { const label = document.createElement('label'), checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = c.characterId; checkbox.checked = true; label.className = 'check-label'; label.append(checkbox, document.createTextNode(c.name)); rest.append(label); }
  xpPreview();
  const select = get<HTMLSelectElement>('treasure-list'); select.replaceChildren(); option(select,'','Beute auswählen');
  for (const t of treasures.items) option(select,t.id,t.title+' · '+t.available+' unverteilte Einheiten');
  select.value=selectedTreasure??'';get('treasure-more').hidden=!treasures.next; renderTreasure();
  const recipient = get<HTMLSelectElement>('loot-recipient'), old = recipient.value; recipient.replaceChildren(); option(recipient,'','Empfänger wählen');
  for (const c of view?.characters.filter(c=>c.active) ?? []) option(recipient,c.characterId,c.name); recipient.value = old;
  const manual = get<HTMLSelectElement>('manual-loot-recipient'), manualOld = manual.value; manual.replaceChildren(); option(manual,'','Figur wählen'); for (const c of view?.characters ?? []) option(manual,c.characterId,c.name); manual.value = manualOld;
  renderLedger(); lock();
}
function renderHealth(p: ProgressView['characters'][number] | undefined) {
  const key=healthKey(),draft=key?healthDrafts.get(key):undefined,h=p?.health,status=h??p?.lastCombatStatus;
  if(draft&&p&&!p.healthCombat&&draft.basis===JSON.stringify([p.health,p.lastCombatStatus]))draft.revision=p.revision;
  const shown=p?.healthCombat?undefined:draft;
  const values=shown?.values??{'health-current':h?String(h.hp):'','health-maximum':h?String(h.maxHp):'','health-temporary':String(status?.tempHp??0),'health-conditions':status?.conditions??'','health-reason':''};
  for(const id of healthFields)get<HTMLInputElement>(id).value=values[id]??'';
  get<HTMLInputElement>('health-concentration').checked=shown?.concentrating??status?.concentrating??false;
  get('health-draft-status').textContent=shown?'HP-Eingabe offen – noch nicht gespeichert.':'';
  get('health-context').textContent=p?.healthCombat?'Offene Begegnung „'+p.healthCombat.title+'“: HP im Kampftracker ändern.':shown?'HP-Eingabe zuerst speichern oder gespeicherten Stand laden.':!h?'Optional: HP eintragen, wenn du sie hier verwalten möchtest.':'';
}
function keepHealthDraft() {
  const p=view?.characters.find(p=>p.characterId===selected),key=healthKey();if(!p||!key||p.healthCombat)return;
  const previous=healthDrafts.get(key);
  healthDrafts.set(key,{revision:previous?.revision??p.revision,basis:previous?.basis??JSON.stringify([p.health,p.lastCombatStatus]),values:Object.fromEntries(healthFields.map(id=>[id,value(id)])),concentrating:get<HTMLInputElement>('health-concentration').checked});
  get('health-draft-status').textContent='HP-Eingabe offen – noch nicht gespeichert.';lock();
}
function xpPreview() {
  const p = view?.characters.find(p=>p.characterId===selected); if (!p) return;
  try { const amount = Number(value('xp-amount')); if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Nichtnegative ganze XP eingeben.'); const next = value('xp-mode') === 'set' ? amount : Math.max(0,(p.xp ?? 0)+(value('xp-mode')==='subtract'?-amount:amount)); const level = xpLevel(next); get('xp-preview').textContent = 'Danach: ' + next + ' XP · Level ' + level.level + ' · Rastverbrauch bleibt erhalten.'; }
  catch (error) { get('xp-preview').textContent=(error as Error).message; }
}
function renderTreasure() {
  const t = treasure, select = get<HTMLSelectElement>('treasure-item'), old = select.value; select.replaceChildren();
  for (const i of t?.items ?? []) if (i.quantity > i.allocated) {
    const d=i.currentDefinition;
    option(select,i.id,(d?.name??i.name) + ' · ' + (i.quantity-i.allocated) + ' verfügbar · ' + ((d ? d.unitCopper : i.unitCopper) === null ? 'Wert unbekannt' : gold((d ? d.unitCopper : i.unitCopper)!)) + ' pro Stück' + (d?.trashed?' · im Papierkorb':''));
  }
  if (t?.items.some(i=>i.id===old && i.quantity>i.allocated)) select.value=old;
  get('treasure-provenance').textContent = t ? (t.combatId ? 'Aus Kampf · ' : 'Manuelle Beute · ') + (t.sceneId ? 'Gruppe ' + t.sceneId.slice(0,8) : 'Unverortet') + (t.locationId ? ' · Ort ' + t.locationId.slice(0,8) : '') : '';
}
function renderLedger() {
  const root=get('ledger-list');root.replaceChildren();
  const entries=ledger.items, cumulative=ledger.totalCopper===null?null:BigInt(ledger.totalCopper);
  get('ledger-summary').textContent=ledgerLoaded?'Kumulativ erhaltene Beute: '+(cumulative===null?'nicht vollständig bekannt':gold(cumulative.toString()))+' · Käufe ausgeschlossen; Weitergaben zählen einmal beim ursprünglichen Empfänger, spätere Verkaufspreise aktualisieren den Wert.'+(ledger.unavailableCount?' · '+ledger.unavailableCount+' Einträge nicht verfügbar.':''):selected?'Beute wird geladen.':'Figur auswählen.';
  for(const l of entries){
    const amount=ledgerCopper(l),b=document.createElement('button');b.textContent=l.quantity+' × '+(l.currentName??l.name)+' · '+({received:'Erhalten',sold:'Verkauft',given:'Weitergegeben'}[l.status])+(l.origin==='purchase'?' · Kauf':l.origin==='transfer'?' · Übernahme aus Weitergabe':'')+' · '+(amount===null?'Wert unbekannt':gold(amount.toString()));b.setAttribute('aria-pressed',String(l.id===selectedLedger));b.onclick=()=>{void loadLedgerItem(l.id).catch(error=>tell(error.message,true));};root.append(b);
  }
  for(const problem of ledger.problems){const p=document.createElement('p');p.className='error';p.setAttribute('role','status');p.textContent='Eintrag nicht verfügbar: '+problem.id+' · '+problem.message;root.append(p);}
  get('ledger-more').hidden=!ledger.next;
  const l=ledgerDetail; get('ledger-editor').hidden=!l;
  get('ledger-detail').textContent=l?l.name+' · '+l.recordedAt+(l.combatId?' · Kampf '+l.combatId.slice(0,8):'')+(l.treasureId?' · Beute '+l.treasureId.slice(0,8):'')+(l.sourceNoteId?' · Quest/Gerücht '+l.sourceNoteId.slice(0,8):'')+(l.counterparty?' · '+l.counterparty:'')+(l.provenance?' · '+l.provenance:'')+(l.rewardCreditId?' · Loot-Gutschrift bei ursprünglichem Empfänger · Herkunft '+l.rewardCreditId.slice(0,8):'')+(l.creditedCopper!==undefined?' · Aktueller gutgeschriebener Lootwert: '+(l.creditedCopper===null?'unbekannt':gold(l.creditedCopper)):'')+(l.mergeTargetId?' · Zusammengeführt in '+l.mergeTargetId.slice(0,8):'')+(l.paidCopper?' · Gezahlt: '+gold(l.paidCopper):'')+(ledgerUnavailable()?' · Nicht verfügbar – letzter gelesener Stand':''):'';
  drawLedgerStacks(get('ledger-stack-tools'),l,ledger.items,view?.characters??[],execute);lock();
}
async function loadTreasures(more=false,preferredId?:string) {
  if(!workspace)return;const token=workspace.token,request=++treasureRequest,before=treasures;
  const result=unwrap(await window.campaign.treasures(token,more?before.next:null));if(workspace?.token!==token||request!==treasureRequest)return;
  const id=preferredId??selectedTreasure??'';
  const detail=id?unwrap(await window.campaign.treasure(token,id)):null;
  if(workspace?.token!==token||request!==treasureRequest)return;
  treasures=more?{items:[...new Map([...before.items,...result.items].map(item=>[item.id,item])).values()],next:result.next}:result;
  treasure=detail;
  selectedTreasure=id||null;
  if(treasure&&!treasures.items.some(t=>t.id===treasure!.id))treasures.items.unshift({id:treasure.id,title:treasure.title,revision:treasure.revision,available:treasure.items.reduce((n,i)=>n+i.quantity-i.allocated,0)});
  render();
}
async function loadSelectedTreasure(){
  if(!workspace)return;const token=workspace.token,id=value('treasure-list'),request=++treasureRequest;
  selectedTreasure=id||null;treasure=null;renderTreasure();
  const detail=id?unwrap(await window.campaign.treasure(token,id)):null;
  if(workspace?.token!==token||value('treasure-list')!==id||request!==treasureRequest)return;
  treasure=detail;renderTreasure();
}
async function loadLedger(more=false) {
  if(!workspace||!selected){ledger={items:[],problems:[],unavailableCount:0,next:null,totalCopper:'0'};renderLedger();return;}
  const token=workspace.token,id=selected,request=++ledgerRequest,before=ledger;
  if(!more){ledger={items:[],problems:[],unavailableCount:0,next:null,totalCopper:'0'};ledgerLoaded=false;renderLedger();}
  const result=unwrap(await window.campaign.ledger(token,{characterId:id,after:more?before.next:null,search:value('ledger-search'),status:value('ledger-filter') as ''|'received'|'sold'|'given'}));
  if(workspace?.token!==token||selected!==id||request!==ledgerRequest)return;
  if(more&&before.unavailableCount!==result.unavailableCount){await loadLedger(false);return;}
  ledger=more?{...result,items:[...new Map([...before.items,...result.items].map(item=>[item.id,item])).values()],problems:[...new Map([...before.problems,...result.problems].map(problem=>[problem.id,problem])).values()]}:result;ledgerLoaded=true;renderLedger();
}
async function loadLedgerItem(id:string){
  if(!workspace||!selected)return;const token=workspace.token,characterId=selected,request=++ledgerDetailRequest;
  const detail=unwrap(await window.campaign.ledgerItem(token,id));
  if(workspace?.token!==token||selected!==characterId||request!==ledgerDetailRequest)return;
  if(detail.characterId!==characterId)throw new Error('Dieser Eintrag gehört zu einer anderen Figur.');
  if(selectedLedger!==id){get<HTMLInputElement>('ledger-counterparty').value=detail.status==='received'?'':detail.counterparty;get<HTMLSelectElement>('ledger-linked-counterparty').value=detail.counterpartyLink?detail.counterpartyLink.kind+':'+detail.counterpartyLink.id:'';}ledgerDetail=detail;selectedLedger=id;renderLedger();
}
async function loadHistory(more = false) {
  if (!workspace || !selected) { get('progress-history-list').replaceChildren(); return; }
  const token=workspace.token, id=selected;
  try {
    const result=unwrap(await window.campaign.progressHistory(token,id,more?history.next:null));
    if(workspace?.token!==token||selected!==id)return;
    history=more?{items:[...history.items,...result.items],next:result.next}:result;
    const list=get('progress-history-list');list.replaceChildren();const corrections=get<HTMLSelectElement>('xp-correction-source'),old=corrections.value;corrections.replaceChildren();option(corrections,'','Keine Originalreferenz');
    for(const entry of history.items){
      const facts=entry.facts,before=facts.before,after=facts.after, p=document.createElement('p');
      const description=entry.kind==='xp'?'XP: '+(before?.xp??'unbekannt')+' → '+after?.xp:entry.kind==='combat-award'?'Kampf: +'+facts.xp+' XP · Tagesbelastung '+facts.load:entry.kind==='combat-entry'?(facts.returning?'Zur Initiative zurückgekehrt':'Zur Initiative hinzugefügt')+' · '+facts.title+' · '+(facts.participant.healthKnown===false?'HP offen':facts.participant.hp+'/'+facts.participant.maxHp+' HP'):entry.kind==='combat-exit'||entry.kind==='combat-return'?(entry.kind==='combat-exit'?'Initiative verlassen':'In Initiative zurückgekehrt')+' · '+facts.title+' · '+(facts.participant.healthKnown===false?'HP offen':facts.participant.hp+'/'+facts.participant.maxHp+' HP')+(facts.participant.conditions?' · '+facts.participant.conditions:''):entry.kind==='health'?({set:'HP korrigiert',damage:'Schaden',heal:'Heilung'}[facts.operation as 'set'|'damage'|'heal']??'HP geändert')+('amount'in facts?' '+facts.amount:'')+' · '+(before?.health?before.health.hp+'/'+before.health.maxHp:'HP offen')+' → '+after?.health?.hp+'/'+after?.health?.maxHp:entry.kind==='rest'?(facts.rest==='long'?'Lange Rast':'Kurze Rast'):entry.kind==='loot-award'?'Beute erhalten: '+facts.entry?.quantity+' × '+facts.entry?.name:entry.kind==='manual-loot'?'Persönlicher Eintrag: '+facts.entry?.quantity+' × '+facts.entry?.name:entry.kind==='loot-sold'?'Verkauft: '+facts.portion?.quantity+' × '+facts.portion?.name:entry.kind==='loot-given'?'Weitergegeben: '+facts.portion?.quantity+' × '+facts.portion?.name:entry.kind==='loot-correction'?'Beutemenge korrigiert: '+before?.quantity+' → '+after?.quantity:entry.kind;
      p.textContent=new Date(facts.recordedAt).toLocaleString()+' · '+description+(facts.reason?' · '+facts.reason:'')+(facts.correctionOf?' · Korrektur zu '+facts.correctionOf.slice(0,8):'');list.append(p);
      if(entry.kind==='xp'||entry.kind==='combat-award')option(corrections,entry.id,description+' · '+new Date(facts.recordedAt).toLocaleString());
    }
    corrections.value=old;get('progress-history-more').hidden=!history.next;
  }catch(error){tell((error as Error).message,true);}
}
function item(prefix: string): ItemInput { return { name:value(prefix+'-name'),quantity:Number(value(prefix+'-quantity')),valueGold:value(prefix+'-value'),category:value(prefix+'-category') as ItemCategory }; }
export async function prepareFinish(participantIds: string[], assessment?: EncounterAssessment,options?:{workspace:Workspace;poolXp?:number;items?:ItemInput[];owner:FinishOwner}) {
  await resetFinishDraft();get<HTMLTextAreaElement>('combat-outcome').value='';const owner=options?.workspace??workspace;if(!owner)return; const gen=generation; const result=unwrap(await window.campaign.progress(owner.token));if(gen!==generation)return;
  finishBasis=result;const list=get('finish-recipients');list.replaceChildren();
  for(const c of result.characters){const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.value=c.characterId;box.checked=participantIds.includes(c.characterId);label.className='check-label';label.append(box,document.createTextNode(c.name+(c.active?'':' · inaktiv')+(c.xp===null?' · XP bislang unbekannt': ' · Level '+xpLevel(c.xp).level)));list.append(label);box.onchange=finishPreview;}
  const known=assessment&&assessment.count>0&&!assessment.missingXp; get<HTMLInputElement>('finish-no-xp').checked=!known;get<HTMLInputElement>('finish-xp').value=String(known?assessment.baseXp:0);get<HTMLInputElement>('finish-load').value=String(known?assessment.adjustedXp:0);get<HTMLInputElement>('finish-has-loot').checked=!!options?.items?.length;finishItems=(options?.items??[]).map(i=>({...i,quantity:String(i.quantity)}));drawFinishItems();if(options?.poolXp!==undefined){get<HTMLInputElement>('finish-no-xp').checked=options.poolXp===0;get<HTMLInputElement>('finish-xp').value=String(options.poolXp);get<HTMLInputElement>('finish-load').value='0';}finishPreview();if(options)await beginFinishDraft(owner,options.owner,()=>finishItems,items=>{finishItems=items;drawFinishItems();},finishPreview);
}
function drawFinishItems(){rewardItemsEditor(get('finish-item-list'),finishItems,()=>{finishPreview();markFinishDraft();},true);}
function finishPreview() {
  const none=get<HTMLInputElement>('finish-no-xp').checked, boxes=[...get('finish-recipients').querySelectorAll<HTMLInputElement>('input:checked')];
  get('finish-xp-fields').hidden=none;get('finish-loot-fields').hidden=!get<HTMLInputElement>('finish-has-loot').checked;
  try{const pool=Number(value('finish-xp')), share=xpShare(none?0:pool,none?0:boxes.length);get('finish-xp-preview').textContent=none?'Kein XP-Award.':boxes.length?share.share+' XP pro Figur · '+share.total+' XP insgesamt (aufgerundet).\n'+boxes.map(b=>{const c=finishBasis!.characters.find(c=>c.characterId===b.value)!;const next=(c.xp??0)+share.share;return c.name+': '+next+' XP, Level '+xpLevel(next).level;}).join('\n'):'Wähle mindestens eine Figur oder ausdrücklich „Keine XP“. ';}catch(error){get('finish-xp-preview').textContent=(error as Error).message;}
}
export function finishRewards(): FinishRewards {
  const none=get<HTMLInputElement>('finish-no-xp').checked;if(!none&&!/^[0-9]+$/.test(value('finish-xp'))||!/^[0-9]+$/.test(value('finish-load')))throw new Error('XP und Tagesbelastung zuerst vervollständigen.');
  return {poolXp:none?0:Number(value('finish-xp')),noXp:none,recipients:none?[]:[...get('finish-recipients').querySelectorAll<HTMLInputElement>('input:checked')].map(b=>({characterId:b.value,revision:finishBasis!.characters.find(c=>c.characterId===b.value)!.revision})),policyVersion:'xp-ceil-2014-v1',loadXp:Number(value('finish-load')),items:get<HTMLInputElement>('finish-has-loot').checked?finishItems.map(i=>{if(!/^[1-9][0-9]*$/.test(i.quantity))throw new Error('Gegenstandsmengen zuerst vervollständigen.');return{...i,quantity:Number(i.quantity)};}):[]};
}
async function recoveredProgress(event:CommitResolution){
 if(!workspace||event.ref.campaignId!==workspace.campaign.id)return;
 const meta=event.meta as {owner:string;token:string;generation:number;action:ProgressAction;healthDraft?:HealthDraft}|undefined;
 if(meta?.owner==='progress'&&meta.token===workspace.token&&meta.generation===generation&&meta.action.kind==='health'&&meta.healthDraft){
  const action=meta.action,key=workspace.campaign.id+':'+action.characterId,draft=healthDrafts.get(key),saved=(event.value as ProgressAck).characters.find(c=>c.characterId===action.characterId);
  if(draft&&draft.revision===meta.action.expectedRevision&&saved){if(JSON.stringify(draft)===JSON.stringify(meta.healthDraft))healthDrafts.delete(key);else draft.revision=saved.revision;}
 }
 await refreshProgress(false);publishProgress();
}
export function initProgress(status: typeof tell) {
  tell=status;initCommitControls(()=>workspace,status);onCommitState(lock);onCommitResolved(recoveredProgress);
  const death=document.createElement('div');death.id='death-saves';death.hidden=true;death.innerHTML='<p id="death-summary"></p><div class="toolbar"><button id="death-success" type="button">Erfolg</button><button id="death-failure" type="button">Fehlschlag</button><button id="death-natural-20" type="button">Natürliche 20</button><button id="death-natural-1" type="button">Natürliche 1</button><button id="death-stabilize" type="button">Stabilisieren</button><button id="death-dead" type="button">Als tot markieren</button><button id="death-reset" type="button">Zurücksetzen</button></div>';get('health-summary').after(death);
  for(const result of ['success','failure','natural-20','natural-1','stabilize','dead','reset'] as const)get('death-'+result).onclick=()=>{const p=view?.characters.find(p=>p.characterId===selected);if(p)void execute({kind:'health',characterId:p.characterId,expectedRevision:p.revision,operation:'death',result,reason:'Todesrettungswurf'});};
  for(const id of [...healthFields,'health-concentration'])get(id).addEventListener('input',keepHealthDraft);
  get('health-form').onsubmit=event=>{event.preventDefault();void(async()=>{
  const p=view?.characters.find(p=>p.characterId===selected),key=healthKey();if(!p||!key)return;
    const draft=healthDrafts.get(key),health:CharacterHealth={hp:Number(value('health-current')),maxHp:Number(value('health-maximum')),tempHp:Number(value('health-temporary')),conditions:value('health-conditions'),concentrating:get<HTMLInputElement>('health-concentration').checked};
    const okay=await execute({kind:'health',characterId:p.characterId,expectedRevision:draft?.revision??p.revision,operation:'set',health,reason:value('health-reason')});
    if(okay&&healthDrafts.get(key)===draft){healthDrafts.delete(key);render();}
  })();};
  get('health-reload').onclick=()=>{const key=healthKey();if(key)healthDrafts.delete(key);void refreshProgress();};
  for(const operation of ['damage','heal'] as const)get('health-'+operation).onclick=()=>{const p=view?.characters.find(p=>p.characterId===selected),key=healthKey();if(!p||!key)return;if(healthDrafts.has(key)){tell('HP-Eingabe zuerst speichern.',true);return;}void execute({kind:'health',characterId:p.characterId,expectedRevision:p.revision,operation,amount:Number(value('health-amount')),reason:''});};
  get('xp-amount').oninput=xpPreview;get('xp-mode').onchange=xpPreview;
  get('xp-form').onsubmit=event=>{event.preventDefault();const p=view?.characters.find(p=>p.characterId===selected);if(p)void execute({kind:'xp',characterId:p.characterId,expectedRevision:p.revision,mode:value('xp-mode') as 'add'|'subtract'|'set',amount:Number(value('xp-amount')),reason:value('xp-reason'),correctionOf:value('xp-correction-source')||undefined});};
  for(const rest of ['short','long'] as const)get('rest-'+rest).onclick=()=>{const recipients=[...get('rest-members').querySelectorAll<HTMLInputElement>('input:checked')].map(b=>({characterId:b.value,revision:view!.characters.find(c=>c.characterId===b.value)!.revision}));void execute({kind:'rest',rest,recipients});};
  get('progress-history-more').onclick=()=>void loadHistory(true);
  get('progress-refresh').onclick=()=>void refreshProgress();get('treasure-list').onchange=()=>{void loadSelectedTreasure().catch(error=>tell(error.message,true));};
  get('treasure-more').onclick=()=>{void loadTreasures(true).catch(error=>tell(error.message,true));};get('ledger-more').onclick=()=>{void loadLedger(true).catch(error=>tell(error.message,true));};
  get('treasure-create-form').onsubmit=event=>{event.preventDefault();void execute({kind:'treasure',title:value('treasure-title'),sceneId:live?.focusId??null,items:[item('treasure-new')]});};
  get('loot-allocate-form').onsubmit=event=>{event.preventDefault();const t=treasure,c=view?.characters.find(c=>c.characterId===value('loot-recipient'));const i=t?.items.find(i=>i.id===value('treasure-item'));if(t&&c&&i?.currentDefinition)void execute({kind:'allocate',treasureId:t.id,expectedRevision:t.revision,expectedDefinitionRevision:i.currentDefinition.revision,itemId:i.id,quantity:Number(value('loot-quantity')),characterId:c.characterId,expectedMembershipRevision:c.membershipRevision});else tell('Beute und Empfänger wählen und aktuellen Gegenstand laden.',true);};
  get('manual-loot-form').onsubmit=event=>{event.preventDefault();const c=view?.characters.find(c=>c.characterId===value('manual-loot-recipient'));if(c)void execute({kind:'manual-item',characterId:c.characterId,expectedMembershipRevision:c.membershipRevision,origin:value('manual-loot-origin') as 'award'|'purchase'|'manual',item:item('manual-loot'),note:value('manual-loot-note')});};
  get('ledger-search').oninput=()=>{void loadLedger().catch(error=>tell(error.message,true));};get('ledger-filter').onchange=()=>{void loadLedger().catch(error=>tell(error.message,true));};
  get('ledger-form').onsubmit=event=>{event.preventDefault();if(!ledgerLoaded||ledgerUnavailable()){tell('Beuteeintrag derzeit nicht verfügbar. Eingaben bleiben erhalten.',true);return;}const l=ledgerDetail;if(l)void execute({kind:'ledger',entryId:l.id,expectedRevision:l.revision,operation:value('ledger-operation') as 'sold'|'given'|'correct',quantity:Number(value('ledger-quantity')),correctedQuantity:Number(value('ledger-quantity')),actualGold:value('ledger-price'),counterparty:value('ledger-counterparty'),counterpartyLink:value('ledger-linked-counterparty')?{kind:value('ledger-linked-counterparty').split(':')[0] as 'shop'|'npc'|'location'|'faction',id:value('ledger-linked-counterparty').slice(value('ledger-linked-counterparty').indexOf(':')+1)}:undefined,reason:value('ledger-reason')});};
  for(const id of ['finish-xp','finish-no-xp','finish-has-loot'])get(id).oninput=finishPreview;
}
