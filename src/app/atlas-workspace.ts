/** Keep the map visible while inspecting a hex or planning a journey. */
export function arrangeAtlasWorkspace(root:HTMLElement,drain:()=>Promise<boolean>){
 const columns=root.querySelector<HTMLElement>('.world-map-columns')!,places=columns.children[1] as HTMLElement,travel=root.querySelector<HTMLElement>('.world-travel')!;
 const mapSettings=columns.children[0]!.querySelector<HTMLElement>('details.world-authoring'),title=columns.children[0]!.querySelector<HTMLElement>('.world-map-title');if(mapSettings&&title)mapSettings.prepend(title);
 const marker=places.querySelector<HTMLElement>('.world-marker-editor'),hexForm=places.querySelector<HTMLElement>('#hex-form');
 if(marker&&hexForm){
  const fold=(title:string,nodes:Element[])=>{const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=title;details.append(summary,...nodes);return details;};
  const create=marker.querySelector<HTMLElement>('#world-anchor-create')!,read=marker.querySelector<HTMLElement>('#world-anchor-open')!,edit=marker.querySelector<HTMLElement>('#world-anchor-edit')!,position=read.parentElement!,actions=document.createElement('div');actions.className='atlas-place-actions';actions.append(create,read,edit);
  marker.querySelector('h3')!.after(actions);
  const search=marker.querySelector('#world-anchor-search')!.closest('label')!,location=marker.querySelector('#world-anchor-location')!.closest('label')!,style=marker.querySelector('#world-marker-form')!;
  marker.append(fold('Andere Orte und Markerposition',[search,location,position]),fold('Kartendarstellung',[style]));
  places.insertBefore(marker,hexForm);const terrain=fold('Gelände und Hexbeschriftung',[...places.querySelectorAll('#hex-authored-status'),hexForm]);places.insertBefore(terrain,marker.nextSibling);
 }
 places.id='world-location-controls';travel.id='world-travel-controls';const inspector=document.createElement('section');inspector.className='atlas-inspector';
 const tabs=document.createElement('div');tabs.className='toolbar atlas-inspector-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Kartenaufgabe');
 const buttons=(['places','travel'] as const).map((kind,i)=>{const b=document.createElement('button');b.type='button';b.textContent=i?'Reise':'Ort und Hex';b.id='atlas-panel-'+kind;tabs.append(b);b.onclick=()=>showInspector(kind);return b;});
 const scroll=document.createElement('div');scroll.className='atlas-inspector-scroll';scroll.append(places,travel);inspector.append(tabs,scroll);columns.append(inspector);
 function showInspector(kind:'places'|'travel'){places.hidden=kind!=='places';travel.hidden=kind!=='travel';buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===(kind==='places'?0:1))));}
 showInspector('places');
 const settings=root.querySelector<HTMLElement>(':scope > .world-columns')!,dialog=document.createElement('dialog');dialog.id='atlas-settings-dialog';dialog.setAttribute('aria-labelledby','atlas-settings-heading');
 const header=document.createElement('div');header.className='toolbar';const heading=document.createElement('h2');heading.id='atlas-settings-heading';heading.textContent='Kalender und Wetter';const close=document.createElement('button');close.type='button';close.textContent='Schließen';header.append(heading,close);dialog.append(header,settings);document.body.append(dialog);
 const open=document.createElement('button');open.id='atlas-settings-open';open.type='button';open.textContent='Kalender und Wetter';root.querySelector('.catalog-heading')!.append(open);let generation=0;
 const feedback=document.createElement('p');feedback.id='atlas-settings-status';feedback.setAttribute('role','status');header.after(feedback);
 open.onclick=()=>{generation++;feedback.textContent='';dialog.showModal();};
 const finish=async()=>{const g=generation;try{if(!await drain()||g!==generation){if(g===generation)feedback.textContent=document.getElementById('status')?.textContent??'Offene Eingaben zuerst abschließen.';return false;}dialog.close();return true;}catch(error){if(g===generation)feedback.textContent=(error as Error).message;return false;}};
 close.onclick=()=>void finish();dialog.addEventListener('cancel',e=>{e.preventDefault();void finish();});
 const agenda=dialog.querySelector<HTMLButtonElement>('#world-agenda-open');agenda?.addEventListener('click',event=>{if(!dialog.open)return;event.preventDefault();event.stopImmediatePropagation();void finish().then(ok=>{if(ok)agenda.click();});},true);
 return{showInspector,reset(){generation++;if(dialog.open)dialog.close();}};
}
