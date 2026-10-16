/** DOM composition only. The Hex owner keeps the sole Scene, route and position state. */
export function liveHexSurface(){
 const get=(id:string)=>document.getElementById(id)!;
 const writing=document.querySelector<HTMLElement>('.live-desk-writing')!;
 const tabs=document.createElement('div');tabs.id='live-center-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Szenenmitte');
 const scene=document.createElement('div');scene.id='live-center-scene';scene.setAttribute('role','tabpanel');scene.append(...writing.childNodes);
 const map=document.createElement('section');map.id='live-center-map';map.setAttribute('role','tabpanel');map.hidden=true;
 writing.append(tabs,scene,map);
 let center:'scene'|'map'='scene',docked=false;
 const sceneTab=document.createElement('button'),mapTab=document.createElement('button');
 for(const [button,id,label]of [[sceneTab,'scene','Szene'],[mapTab,'map','Karte']] as const){button.type='button';button.id='live-center-'+id+'-tab';button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls','live-center-'+id);button.onclick=()=>show(id);tabs.append(button);get('live-center-'+id).setAttribute('aria-labelledby',button.id);}
 const reference=document.querySelector<HTMLElement>('.live-desk-reference')!,panel=get('live-world-panel'),panelHome=document.createComment('world panel home');panel.before(panelHome);
 const host=get('live-travel-host'),open=document.createElement('button');open.type='button';open.id='live-travel-map-open';open.textContent='Karte öffnen';open.onclick=()=>{show('map');get('world-map').focus();};host.append(open);
 const canvas=get('world-map').closest<HTMLElement>('.world-map-canvas')!;
 const zoom=get('world-zoom-in').parentElement!,travel=get('world-travel-form').closest<HTMLElement>('.world-travel')!;
 const nodes=[get('world-map-select').closest<HTMLElement>('.world-map-selection')!,get('world-current'),get('world-map-modes'),zoom,get('world-map').parentElement!.querySelector<HTMLElement>('.map-canvas-controls')!,travel];
 const homes=[...nodes,canvas].map(node=>{const marker=document.createComment('hex surface home');node.before(marker);return{node,marker};});
 function paint(){scene.hidden=docked&&center==='map';map.hidden=!docked||center!=='map';sceneTab.setAttribute('aria-selected',String(!scene.hidden));mapTab.setAttribute('aria-selected',String(!map.hidden));mapTab.disabled=!docked;open.hidden=!docked||center==='map';writing.classList.toggle('live-map-center-open',!map.hidden);}
 function show(next:'scene'|'map'){if(next==='map'&&!docked)return;center=next;paint();}
 paint();
 return{show,get center(){return center;},dock(on:boolean){
  if(on!==docked){docked=on;if(on){reference.prepend(panel);host.append(...nodes);map.append(canvas);}else{panelHome.before(panel);for(const {node,marker}of homes)marker.before(node);}}
  host.classList.toggle('live-travel-owner',on);canvas.classList.toggle('live-hex-canvas',on);paint();
 },close(){center='scene';this.dock(false);}};
}
