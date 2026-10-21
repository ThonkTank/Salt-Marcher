import {ledgerStacksMatch,type LedgerItem,type ProgressView,type ProgressAction} from './progression';
/** Each operation exposes only its own inputs; the existing Progress writer owns the transaction. */
export function drawLedgerStacks(root:HTMLElement,l:LedgerItem|null,items:LedgerItem[],characters:ProgressView['characters'],send:(a:ProgressAction)=>Promise<boolean>){
 root.replaceChildren();if(!l||l.status!=='received'||l.quantity<1)return;
 const label=(text:string,input:HTMLElement)=>{const node=document.createElement('label');node.append(text,input);return node;};
 const title=document.createElement('h4'),mode=document.createElement('select'),quantity=document.createElement('input'),reason=document.createElement('input'),source=document.createElement('select'),recipient=document.createElement('select'),preview=document.createElement('p');
 const owner=characters.find(c=>c.characterId===l.characterId)?.name??'dieser Figur',name=l.currentName??l.name;
 title.textContent=name+' · '+owner;mode.setAttribute('aria-label','Stapelaktion');
 for(const [value,text]of [['transfer','An Figur weitergeben'],['split','Mengenstapel teilen'],['merge','Stapel zusammenführen']]){const option=document.createElement('option');option.value=value!;option.textContent=text!;option.selected=value==='transfer';mode.append(option);}
 quantity.type='number';quantity.min='1';quantity.value='1';quantity.setAttribute('aria-label','Stapelmenge');
 reason.placeholder='Grund / Provenienz';reason.setAttribute('aria-label','Stapelgrund');
 source.setAttribute('aria-label','Passenden Stapel zusammenführen');recipient.setAttribute('aria-label','Empfänger der Weitergabe');
 const empty=document.createElement('option');empty.value='';empty.textContent='Passenden angezeigten Stapel auswählen';source.append(empty);
 const matches=items.filter(c=>c.id!==l.id&&c.quantity>0&&ledgerStacksMatch(l,c));
 for(const c of matches){const option=document.createElement('option');option.value=c.id;option.textContent=c.quantity+' × '+(c.currentName??c.name);source.append(option);}
 for(const c of characters.filter(c=>c.characterId!==l.characterId)){const option=document.createElement('option');option.value=c.characterId;option.textContent=c.name;recipient.append(option);}
 const amountField=label('Menge',quantity),recipientField=label('Empfänger',recipient),sourceField=label('Zusammenführen mit',source),fields=document.createElement('div');fields.className='ledger-transfer-fields';fields.append(amountField,recipientField,sourceField,label('Grund / Provenienz',reason));
 const split=document.createElement('button'),merge=document.createElement('button'),transfer=document.createElement('button');split.textContent='Mengenstapel teilen';merge.textContent='Stapel zusammenführen';transfer.textContent='An Figur weitergeben';for(const button of [split,merge,transfer])button.type='button';
 split.onclick=()=>void send({kind:'ledger-split',entryId:l.id,expectedRevision:l.revision,quantity:Number(quantity.value),reason:reason.value});
 merge.onclick=()=>{const c=matches.find(c=>c.id===source.value);if(c)void send({kind:'ledger-merge',entryId:l.id,expectedRevision:l.revision,sourceId:c.id,expectedSourceRevision:c.revision,reason:reason.value});};
 transfer.onclick=()=>{const c=characters.find(c=>c.characterId===recipient.value);if(c)void send({kind:'ledger-transfer',entryId:l.id,expectedRevision:l.revision,quantity:Number(quantity.value),characterId:c.characterId,expectedMembershipRevision:c.membershipRevision,reason:reason.value});};
 preview.setAttribute('role','status');preview.className='caption';preview.dataset.ledgerStackPreview='true';
 const update=()=>{
  const action=mode.value;fields.dataset.operation=action;const n=Number(quantity.value),valid=quantity.value.trim()!==''&&Number.isSafeInteger(n)&&n>=1&&n<=l.quantity;
  amountField.hidden=action==='merge';recipientField.hidden=action!=='transfer';sourceField.hidden=action!=='merge';quantity.max=String(action==='split'?l.quantity-1:l.quantity);
  split.hidden=action!=='split';merge.hidden=action!=='merge';transfer.hidden=action!=='transfer';
  split.disabled=!!l.instanceId||!valid||n>=l.quantity;transfer.disabled=!recipient.options.length||!valid;
  const other=matches.find(c=>c.id===source.value);merge.disabled=!other;
  if(action==='merge')preview.textContent=other?`${l.quantity} + ${other.quantity} = ${l.quantity+other.quantity} × ${name} bei ${owner}. Der andere Stapel bleibt ohne Restbestand im Verlauf.`:matches.length?'Wähle den Stapel, der zu diesem hinzukommt.':'Kein passender Stapel in den angezeigten Einträgen. Such- und Statusfilter bei Bedarf erweitern.';
  else if(!valid||action==='split'&&split.disabled)preview.textContent=action==='split'?'Zum Teilen eine ganze Teilmenge kleiner als den Bestand eingeben.':'Eine ganze Teilmenge von 1 bis '+l.quantity+' eingeben.';
  else preview.textContent=action==='split'?`${n} × ${name} als neuer Stapel; ${l.quantity-n} bleiben in diesem Stapel bei ${owner}.`:`${n} × ${name} an ${characters.find(c=>c.characterId===recipient.value)?.name??'eine andere Figur'}; ${l.quantity-n} bleiben bei ${owner}. Interne Weitergaben zählen nicht als neue Belohnung.`;
 };
 mode.onchange=update;quantity.oninput=update;source.onchange=update;recipient.onchange=update;
 root.append(title,label('Aktion',mode),fields,preview,transfer,split,merge);update();
}
