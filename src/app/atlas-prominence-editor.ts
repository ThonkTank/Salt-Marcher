import type {LandscapeRecord} from './atlas-landscape';
import {automaticProminence,PROMINENCE_NAMES} from './atlas-prominence';

/** One compact control for ordinary lines, planned routes and inspector drafts. */
export function prominenceEditor(root:HTMLElement,id:string,record:()=>LandscapeRecord,changed:()=>void){
 const label=document.createElement('label');label.textContent='Kartenprominenz';
 const select=document.createElement('select');select.id=id;
 select.add(new Option('Automatisch',''));
 PROMINENCE_NAMES.forEach((name,index)=>select.add(new Option(`${index} · ${name}`,String(index))));
 const hint=document.createElement('small');hint.id=id+'-hint';select.setAttribute('aria-describedby',hint.id);
 const refresh=()=>{const r=record(),rank=automaticProminence(r);select.value=r.prominence===undefined?'':String(r.prominence);hint.textContent=`Automatisch: ${rank} · ${PROMINENCE_NAMES[rank]}`;};
 select.onchange=()=>{const r=record();if(select.value==='')delete r.prominence;else r.prominence=Number(select.value);refresh();changed();};
 label.append(select,hint);root.append(label);refresh();return {refresh,select};
}
