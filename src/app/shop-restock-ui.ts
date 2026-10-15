import type {ShopView} from './items-contracts';
import {weightShares} from './generation-contracts';

export function renderShopRestockTables(root:HTMLElement,view:ShopView,options:{changed:()=>void;rebuild:()=>void;button:(title:string,action:()=>Promise<unknown>|void)=>HTMLButtonElement;roll:(id:string)=>Promise<void>}){
 const section=document.createElement('section');section.className='session-group-card';
 const heading=document.createElement('h3');heading.textContent='Gewichtete Warenauffüllung';section.append(heading);
 const explanation=document.createElement('p');explanation.textContent='Wähle bestehende Mengenstapel, Gewichte und Mengen je Ziehung. Ergebnisse werden zum Bestand hinzugefügt; Preise, Einzelstücke und andere Zeilen bleiben erhalten. Automatische Regeln verwenden bestätigte Kampagnenzeit.';section.append(explanation);root.append(section);
 const available=view.shop.stock.filter(e=>!e.unique);
 const add=options.button('Auffülltabelle anlegen',()=>{view.shop.restockTables??=[];view.shop.restockTables.push({id:crypto.randomUUID(),revision:0,name:'Neue Warenlieferung',seed:crypto.randomUUID(),rolls:3,entries:available.slice(0,1).map(e=>({entryId:e.id,weight:'1',minimum:1,maximum:1})),schedule:null});options.changed();options.rebuild();});add.disabled=!available.length||view.unavailable;section.append(add);
 if(!available.length){const p=document.createElement('p');p.textContent='Zuerst einen Gegenstand als Mengenstapel zum Shop hinzufügen.';section.append(p);}
 for(const table of view.shop.restockTables??[]){
  const details=document.createElement('details');details.open=true;const summary=document.createElement('summary');summary.textContent=table.name+' · Revision '+table.revision;details.append(summary);section.append(details);
  const change=()=>{if(table.schedule)table.schedule.nextDueMs='0';options.changed();};
  const field=(parent:HTMLElement,title:string,value:string,type:string,update:(s:string)=>void)=>{const label=document.createElement('label'),input=document.createElement('input');label.textContent=title;input.type=type;input.value=value;if(type==='number'){input.min='1';input.max='1000000';input.step='1';}input.oninput=()=>{update(input.value);change();};label.append(input);parent.append(label);return input;};
  const fields=document.createElement('div');fields.className='time-fields';details.append(fields);
  field(fields,'Name',table.name,'text',v=>table.name=v);
  field(fields,'Ziehungen je Lieferung (1–100)',String(table.rolls),'number',v=>table.rolls=Number(v)).max='100';
  field(fields,'Zufallsbasis',table.seed,'text',v=>table.seed=v);
  let shares:string[]=[];try{shares=weightShares(table.entries.map(e=>e.weight));}catch{/* Invalid drafts remain editable. */}
  const entries=document.createElement('div');details.append(entries);
  for(const stock of available){
   const row=document.createElement('fieldset'),legend=document.createElement('legend'),check=document.createElement('input'),label=document.createElement('label');check.type='checkbox';let entry=table.entries.find(e=>e.entryId===stock.id);check.checked=!!entry;label.append(check,document.createTextNode(view.items.find(d=>d.id===stock.reference.definitionId)?.name??'Gegenstand'));legend.append(label);row.append(legend);entries.append(row);
   check.onchange=()=>{if(check.checked)table.entries.push({entryId:stock.id,weight:'1',minimum:1,maximum:1});else table.entries=table.entries.filter(e=>e.entryId!==stock.id);change();options.rebuild();};
   if(!entry)continue;const selected=entry,index=table.entries.indexOf(selected),weights=field(row,'Gewicht'+(shares[index]?' · '+shares[index]:''),selected.weight,'text',v=>selected.weight=v);weights.inputMode='decimal';
   field(row,'Mindestmenge je Treffer',String(selected.minimum),'number',v=>selected.minimum=Number(v));field(row,'Höchstmenge je Treffer',String(selected.maximum),'number',v=>selected.maximum=Number(v));
  }
  const automatic=document.createElement('label'),enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=!!table.schedule;automatic.append(enabled,document.createTextNode(' Automatisch nach verstrichener Kampagnenzeit'));details.append(automatic);
  enabled.onchange=()=>{table.schedule=enabled.checked?{intervalMs:'86400000',nextDueMs:'0'}:null;change();options.rebuild();};
  if(table.schedule){const schedule=table.schedule;field(details,'Intervall in Tagen zu je 24 Stunden',String(Number(schedule.intervalMs)/86400000),'number',v=>{const days=Number(v);schedule.intervalMs=Number.isSafeInteger(days)&&days>0?(BigInt(days)*86400000n).toString():v;});const due=document.createElement('p');due.textContent=schedule.nextDueMs==='0'?'Erste Fälligkeit wird beim Speichern aus der gewählten Scenezeit berechnet.':'Nächste Fälligkeit: '+schedule.nextDueMs+' ms Kampagnenzeit';details.append(due);}
  const actions=document.createElement('div');actions.className='toolbar';const roll=options.button('Jetzt Warenlieferung würfeln',()=>options.roll(table.id));roll.disabled=view.unavailable;actions.append(roll,options.button('Tabelle entfernen',()=>{view.shop.restockTables=view.shop.restockTables!.filter(t=>t.id!==table.id);options.changed();options.rebuild();}));details.append(actions);
 }
}
