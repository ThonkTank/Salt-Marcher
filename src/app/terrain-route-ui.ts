import {atlasUnits,setAtlasUnits,atlasFieldValue,setAtlasFieldValue,lengthLabel} from './atlas-units';
import {VegetationSpatialView} from './vegetation-spatial';
import {emptyRecord,type LandscapeRecord,type LandscapeBox,type LandscapeAction} from './atlas-landscape';
import {routeSpec,routeDefaults,nearestRoute,type RouteStructure} from './terrain-route';
import {newLine,roadStyles} from './landscape-line';
import type {VegetationScene} from './vegetation';
import type {Point} from './contracts';

interface Host {
  token:string;box:LandscapeBox;record?:LandscapeRecord;kind:'road'|'river';tilt?:number;
  write:(action:LandscapeAction|{kind:'undo'|'redo'})=>Promise<unknown>;
  changed?:()=>Promise<unknown>;navigate?:(box:LandscapeBox)=>void;
}
/** Both atlas entry points use this editor and the same canonical command.
 * The canvas shows the same orthographic scene at zero or nonzero tilt. */
export async function openTerrainRoute(host:Host){
  const dialog=document.createElement('dialog');dialog.className='vegetation-dialog';dialog.id='terrain-route-editor';
  dialog.innerHTML=`<div class="vegetation-top"><strong>${host.kind==='river'?'Fluss':'Straße'} im Gelände</strong>
    <label>Maße <select id="route-units"><option value="dnd">DnD</option><option value="metric">Metrisch</option></select></label>
    <button data-action="fit">Verlauf einpassen</button><button data-action="top">Draufsicht</button><button data-action="tilt">Kippen</button>
    <button data-action="undo">Rückgängig</button><button data-action="redo">Wiederholen</button>
    <button data-action="export">PNG</button><button data-action="close">Zur Karte</button></div>
    <div class="vegetation-body"><aside>
    <label>Name<input id="route-name"></label>
    <label>Breite in m<input id="route-width" type="number" min=".1" step="any"></label>
    <label><input id="route-protected" type="checkbox"> Beim Geländeformen schützen</label>
    <p>Start, Zwischenpunkte und Ziel anklicken. Punkte ziehen oder unten korrigieren. Mittlere Maustaste verschiebt die Ansicht.</p>
    <ol id="route-points"></ol><button data-action="insert">Nächsten Punkt hinter Auswahl einfügen</button>
    <label>Abschnitt<select id="route-section"></select></label>
    <label>Ausführung<select id="route-structure"><option value="auto">Automatisch vorschlagen</option><option value="ground">Auf dem Gelände</option>${host.kind==='road'?'<option value="bridge">Brücke</option><option value="ford">Furt</option><option value="tunnel">Tunnel</option>':''}</select></label>
    ${host.kind==='river'?'<label>Mündung<select id="route-mouth"><option value="">Freies Ziel / Meer</option></select></label>':''}
    <details><summary>Planungsgrenzen</summary><button data-action="defaults">Vorgaben wiederherstellen</button>
    <label>Seitlicher Spielraum in m<input id="route-corridor" type="number" min="1"></label>
    <label>Maximaler Abtrag in m<input id="route-cut" type="number" min="0" step=".1"></label>
    <label>Maximaler Auftrag in m<input id="route-fill" type="number" min="0" step=".1" ${host.kind==='river'?'disabled':''}></label>
    <label>Geländeübergang je Seite in m<input id="route-shoulder" type="number" min=".1" step=".1"></label>
    <label>Maximales Gefälle / Steigung in %<input id="route-grade" type="number" min=".1" step=".1"></label>
    <label>${host.kind==='river'?'Wassertiefe':'Bettvertiefung'} in m<input id="route-depth" type="number" min="0" step=".1" ${host.kind==='road'?'disabled':''}></label>
    <label>Brückenfreiheit / Tunnelüberdeckung in m<input id="route-clearance" type="number" min=".1" step=".1" ${host.kind==='river'?'disabled':''}></label></details>
    <details><summary>Kartenstil</summary><label>Farbe<input id="route-color" type="color"></label>
    ${host.kind==='road'?'<label>Linienstil<select id="route-style">'+roadStyles.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')+'</select></label>':'<label><input id="route-fade" type="checkbox">Schmale Quelle</label>'}</details>
    <button data-action="preview">Vorschau berechnen</button><button data-action="save" disabled>Verlauf übernehmen</button>
    <button data-action="cancel">Entwurf verwerfen</button><button data-action="delete" ${host.record?'':'hidden'}>Verlauf löschen</button>
    </aside><div class="route-viewports"><canvas id="route-canvas" tabindex="0" aria-label="Verlaufpunkte auf dem Gelände"></canvas>
    <canvas id="route-profile" width="800" height="110" aria-label="Höhenprofil des Verlaufs"></canvas></div></div>
    <p id="route-status" role="status">Landschaft wird geladen …</p>`;
  document.body.append(dialog);dialog.showModal();
  const field=<T extends HTMLElement>(id:string)=>dialog.querySelector<T>('#route-'+id)!;
  const button=(action:string)=>dialog.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  const status=field('status'),canvas=field<HTMLCanvasElement>('canvas');
  let view:VegetationSpatialView;
  try{view=new VegetationSpatialView(canvas);}catch(e){dialog.remove();throw e;}
  view.tilt=host.tilt??45;
  let box={...host.box},record=structuredClone(host.record??emptyRecord(host.kind)),saved=host.record?structuredClone(host.record):undefined;
  record.route??=routeSpec(host.kind,record.points);record.line??=newLine(host.kind);
  let source:VegetationScene|undefined,proposal:LandscapeRecord|undefined,generation=0,closed=false,saving=false,dirty=false,timer:ReturnType<typeof setTimeout>|undefined;
  let selected=-1,insert=false,drag:{index:number;start:Point;moved:boolean;pan?:LandscapeBox}|undefined;
  const fitBox=()=>{
    const points=record.route!.anchors;if(points.length<2)return;
    const minX=Math.min(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxX=Math.max(...points.map(p=>p.x)),maxY=Math.max(...points.map(p=>p.y));
    const pad=Math.max(record.width*8,Math.min(200,record.route!.limits.corridor)),width=Math.max(80,maxX-minX+pad*2),height=Math.max(80,maxY-minY+pad*2,width*.65);
    box={x:(minX+maxX-width)/2,y:(minY+maxY-height)/2,width,height};
  };
  if(host.record)fitBox();
  const limits=['corridor','cut','fill','shoulder','grade','depth','clearance'] as const;
  const setFields=()=>{
    field<HTMLInputElement>('name').value=record.name;
    setAtlasFieldValue(field<HTMLInputElement>('width'),record.width);
    field<HTMLInputElement>('protected').checked=record.route!.protected;
    for(const key of limits){const input=field<HTMLInputElement>(key),value=record.route!.limits[key];if(key==='grade')input.value=String(value*100);else setAtlasFieldValue(input,value);}
    field<HTMLInputElement>('color').value=record.line!.color;
    if(host.kind==='road')field<HTMLSelectElement>('style').value=record.line!.style;
    else field<HTMLInputElement>('fade').checked=record.line!.fadeIn;
    showPoints();
  };
  const readFields=()=>{
    record.name=field<HTMLInputElement>('name').value;record.width=Number(atlasFieldValue(field<HTMLInputElement>('width')));
    record.route!.protected=field<HTMLInputElement>('protected').checked;
    for(const key of limits)record.route!.limits[key]=Number(key==='grade'?field<HTMLInputElement>(key).value:atlasFieldValue(field<HTMLInputElement>(key)))/(key==='grade'?100:1);
    record.line!.color=field<HTMLInputElement>('color').value;
    if(host.kind==='road')record.line!.style=field<HTMLSelectElement>('style').value as NonNullable<LandscapeRecord['line']>['style'];
    else record.line!.fadeIn=field<HTMLInputElement>('fade').checked;
  };
  function showPoints(){
    const list=field('points');list.replaceChildren();
    record.route!.anchors.forEach((p,i)=>{
      const li=document.createElement('li'),choose=document.createElement('button');choose.textContent=(i===0?'Start':i===record.route!.anchors.length-1?'Ziel':'Punkt '+(i+1))+(selected===i?' •':'');
      choose.onclick=()=>{selected=i;showPoints();drawHandles();};
      const x=document.createElement('input'),y=document.createElement('input'),remove=document.createElement('button');x.type=y.type='number';x.step=y.step='any';x.id='route-point-x-'+i;y.id='route-point-y-'+i;x.dataset.atlasUnit=y.dataset.atlasUnit='meters';x.setAttribute('aria-label','X Punkt '+(i+1));y.setAttribute('aria-label','Y Punkt '+(i+1));setAtlasFieldValue(x,p.x);setAtlasFieldValue(y,p.y);x.style.width=y.style.width='7em';
      const move=()=>{record.route!.anchors[i]={x:Number(atlasFieldValue(x)),y:Number(atlasFieldValue(y))};invalidate();};x.onchange=y.onchange=move;
      remove.textContent='Entfernen';remove.onclick=()=>{record.route!.anchors.splice(i,1);record.route!.sections.splice(Math.max(0,i-1),1);invalidate();showPoints();};
      li.append(choose,x,y,remove);list.append(li);
    });
    const section=field<HTMLSelectElement>('section'),old=section.value;section.replaceChildren();
    record.route!.anchors.slice(1).forEach((_,i)=>section.add(new Option(`${i+1} → ${i+2}`,String(i))));
    section.value=old||'0';if(section.selectedIndex<0)section.selectedIndex=0;
    field<HTMLSelectElement>('structure').value=record.route!.sections[Number(section.value)]??'auto';
  }
  function drawHandles(){
    view.showDraft(record.route!.anchors);view.render();
  }
  function invalidate(){
    if(saving)return;dirty=true;proposal=undefined;button('save').disabled=true;generation++;clearTimeout(timer);
    drawHandles();showProfile({...record,route:{...record.route!,nodes:[]}});status.textContent='Entwurf geändert. Vorschau wird berechnet …';
    if(record.route!.anchors.length>=2)timer=setTimeout(()=>void preview(),250);
    else status.textContent='Start und Ziel auf dem Gelände anklicken.';
  }
  let profileRecord:LandscapeRecord|undefined;
  const showProfile=(r:LandscapeRecord)=>{
    profileRecord=r;
    const target=field<HTMLCanvasElement>('profile'),ctx=target.getContext('2d')!,nodes=r.route!.nodes;
    ctx.clearRect(0,0,800,110);ctx.fillStyle='#eee7d6';ctx.fillRect(0,0,800,110);if(!nodes.length){target.setAttribute('aria-label','Höhenprofil noch nicht berechnet');return;}
    let length=0;const distances=nodes.map((p,i)=>{if(i)length+=Math.hypot(p.x-nodes[i-1]!.x,p.y-nodes[i-1]!.y);return length;});
    const min=Math.min(...nodes.map(p=>p.z)),max=Math.max(...nodes.map(p=>p.z)),range=Math.max(1,max-min);
    ctx.strokeStyle=host.kind==='river'?'#377f9e':'#856039';ctx.lineWidth=2;ctx.beginPath();
    nodes.forEach((p,i)=>{const x=20+distances[i]!/(length||1)*760,y=85-(p.z-min)/range*55;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
    ctx.fillStyle='#332d25';ctx.font='13px sans-serif';const text=`${lengthLabel(length)} · Höhe ${lengthLabel(min)} – ${lengthLabel(max)}`;
    target.setAttribute('aria-label','Höhenprofil: '+text);ctx.fillText(text,20,18);
  };
  const unitSelect=field<HTMLSelectElement>('units');
  const unitsChanged=()=>{unitSelect.value=atlasUnits();if(profileRecord)showProfile(profileRecord);};
  unitSelect.onchange=()=>{setAtlasUnits(unitSelect.value as 'dnd'|'metric');unitSelect.value=atlasUnits();};
  document.addEventListener('atlas-units-changed',unitsChanged);unitsChanged();
  async function preview(){
    if(!source||closed||saving||record.route!.anchors.length<2)return;
    readFields();const epoch=++generation;proposal=undefined;button('save').disabled=true;canvas.setAttribute('aria-busy','true');
    status.textContent='Geländegerechter Verlauf wird berechnet …';
    try{
      const result=await window.campaign.atlasSpatialScene(host.token,box,box.width/Math.max(1,canvas.clientWidth),{kind:'landscape-route',record:structuredClone(record)},source.fence);
      if(closed||epoch!==generation)return;if(!result.ok)throw Error(result.error);
      proposal=result.value.records.find(r=>r.id===record.id);if(!proposal?.route)throw Error('Verlauf fehlt in der Vorschau.');
      view.selectedArea=record.id;view.setData(result.value);drawHandles();showProfile(proposal);
      button('save').disabled=false;
      const structures=[...new Set(proposal.route.nodes.map(n=>n.structure))].filter(k=>k!=='ground');
      const names={bridge:'Brücke',ford:'Furt',tunnel:'Tunnel'};
      status.textContent='Vorschau bereit · '+(structures.length?structures.map(k=>names[k as keyof typeof names]).join(', ')+' · ':'')+'Geländeform und Verlauf werden gemeinsam gespeichert.';
    }catch(e){if(epoch===generation&&!closed){status.textContent=(e as Error).message;view.setData(source);drawHandles();}}
    finally{if(epoch===generation)canvas.setAttribute('aria-busy','false');}
  }
  async function load(){
    const epoch=++generation;const result=await window.campaign.atlasSpatialScene(host.token,box,box.width/Math.max(1,canvas.clientWidth));
    if(closed||epoch!==generation)return;if(!result.ok)throw Error(result.error);source=result.value;view.setData(source);drawHandles();
    if(host.kind==='river'){
      const select=field<HTMLSelectElement>('mouth');select.replaceChildren(new Option('Freies Ziel / Meer',''));
      for(const r of source.records)if(r.id!==record.id&&(r.kind==='river'&&r.route||r.surface==='freshwater'))select.add(new Option(r.name||r.kind,r.id));
      select.value=record.route?.mouth?.id??'';
    }
    status.textContent='Start, Zwischenpunkte und Ziel setzen. Punkte lassen sich ziehen.';
    canvas.setAttribute('aria-busy','false');
  }
  const local=(e:MouseEvent)=>{const b=canvas.getBoundingClientRect();return{x:e.clientX-b.x,y:e.clientY-b.y};};
  canvas.onpointerdown=e=>{
    if(saving||!source||![0,1].includes(e.button))return;e.preventDefault();const p=local(e);
    if(e.button===1){drag={index:-1,start:p,moved:false,pan:{...box}};canvas.setPointerCapture(e.pointerId);return;}
    const index=record.route!.anchors.findIndex(v=>{const q=view.project(v);return Math.hypot(q.x-p.x,q.y-p.y)<12;});
    drag={index,start:p,moved:false};if(index>=0)selected=index;canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove=e=>{
    if(!drag)return;const p=local(e);if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>3)drag.moved=true;
    if(drag.pan){const m=box.width/canvas.clientWidth;box={...drag.pan,x:drag.pan.x-(p.x-drag.start.x)*m,y:drag.pan.y-(p.y-drag.start.y)*m/Math.max(.4,Math.cos(view.tilt*Math.PI/180))};view.setViewport(box);return;}
    if(drag.index>=0&&drag.moved){const hit=view.hit(p.x,p.y);if(hit){record.route!.anchors[drag.index]={x:hit.x,y:hit.y};proposal=undefined;button('save').disabled=true;drawHandles();}}
  };
  canvas.onpointerup=e=>{
    const d=drag;drag=undefined;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!d)return;
    if(d.pan){void load().then(()=>{if(dirty)void preview();}).catch(error);return;}
    if(d.index<0&&!d.moved){const p=local(e),hit=view.hit(p.x,p.y);if(hit){
      const at=insert&&selected>=0?selected+1:record.route!.anchors.length;
      record.route!.anchors.splice(at,0,{x:hit.x,y:hit.y});if(record.route!.anchors.length>1)record.route!.sections.splice(Math.max(0,at-1),0,'auto');selected=at;insert=false;
    }}
    showPoints();invalidate();
  };
  canvas.onpointercancel=()=>{drag=undefined;showPoints();invalidate();};
  canvas.onwheel=e=>{e.preventDefault();if(saving)return;const factor=Math.exp(Math.max(-.4,Math.min(.4,e.deltaY*.001))),width=Math.max(20,Math.min(1e7,box.width*factor)),height=width*box.height/box.width;box={x:box.x+(box.width-width)/2,y:box.y+(box.height-height)/2,width,height};clearTimeout(timer);timer=setTimeout(()=>void load().then(()=>{if(dirty)void preview();}).catch(error),150);};
  const error=(e:unknown)=>{status.textContent=(e as Error).message;};
  for(const id of ['name','width','protected','color',...limits,host.kind==='road'?'style':'fade'])field(id).addEventListener('change',invalidate);
  field<HTMLSelectElement>('section').onchange=()=>{field<HTMLSelectElement>('structure').value=record.route!.sections[Number(field<HTMLSelectElement>('section').value)]??'auto';};
  field<HTMLSelectElement>('structure').onchange=()=>{record.route!.sections[Number(field<HTMLSelectElement>('section').value)]=field<HTMLSelectElement>('structure').value as 'auto'|RouteStructure;invalidate();};
  if(host.kind==='river')field<HTMLSelectElement>('mouth').onchange=()=>{
    const id=field<HTMLSelectElement>('mouth').value,p=record.route!.anchors.at(-1);
    if(id&&p){
      const target=source?.records.find(r=>r.id===id),hit=target?.route?nearestRoute(target.route.nodes,p):undefined;
      record.route!.mouth={id,point:hit?.point??{...p}};if(hit)record.route!.anchors[record.route!.anchors.length-1]=hit.point;
    }else delete record.route!.mouth;
    showPoints();invalidate();
  };
  button('insert').onclick=()=>{insert=true;status.textContent='Auf die Karte klicken: neuer Punkt hinter der Auswahl.';};
  button('defaults').onclick=()=>{record.route!.limits=routeDefaults(host.kind);setFields();invalidate();};
  button('fit').onclick=()=>{fitBox();void load().then(()=>preview()).catch(error);};
  button('preview').onclick=()=>void preview();
  button('top').onclick=()=>{view.tilt=0;view.render();drawHandles();};
  button('tilt').onclick=()=>{view.tilt=45;view.render();drawHandles();};
  button('save').onclick=()=>void(async()=>{
    if(!proposal||!source||saving)return;saving=true;button('save').disabled=true;
    try{
      const result=await host.write({kind:'landscape-route',record:proposal,expectedRevision:saved?.revision??null,sourceRevision:source.revision});
      if(!result)throw Error('Änderung nicht bestätigt. Entwurf bleibt erhalten.');
      await host.changed?.();dirty=false;await load();saved=source!.records.find(r=>r.id===record.id);
      if(saved)record=structuredClone(saved);proposal=undefined;setFields();status.textContent='Verlauf und Geländeform gespeichert.';
      button('delete').hidden=false;
    }catch(e){error(e);button('save').disabled=false;}finally{saving=false;}
  })();
  const reset=()=>{generation++;clearTimeout(timer);record=structuredClone(saved??emptyRecord(host.kind));record.route??=routeSpec(host.kind,record.points);record.line??=newLine(host.kind);proposal=undefined;dirty=false;selected=-1;button('save').disabled=true;setFields();if(source)view.setData(source);drawHandles();showProfile(record);status.textContent='Entwurf verworfen.';};
  button('cancel').onclick=reset;
  for(const action of ['undo','redo'] as const)button(action).onclick=()=>void(async()=>{if(dirty||saving){status.textContent='Zuerst Entwurf übernehmen oder verwerfen.';return;}saving=true;try{await host.write({kind:action});await host.changed?.();await load();saved=source?.records.find(r=>r.id===record.id);reset();}catch(e){error(e);}finally{saving=false;}})();
  button('delete').onclick=()=>void(async()=>{if(!saved||saving)return;saving=true;try{await host.write({kind:'landscape-remove',id:saved.id,expectedRevision:saved.revision});await host.changed?.();dirty=false;close();}catch(e){error(e);}finally{saving=false;}})();
  button('export').onclick=()=>void(async()=>{if(dirty||!source){status.textContent='Für die Ausgabe zuerst übernehmen oder verwerfen.';return;}view.showDraft([]);view.render();const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Bildausgabe fehlgeschlagen.');const result=await window.campaign.exportAtlasPNG(host.token,new Uint8Array(await blob.arrayBuffer()),'gm','png',source.fence);if(!result.ok)throw Error(result.error);drawHandles();})().catch(error);
  function close(){document.removeEventListener('atlas-units-changed',unitsChanged);closed=true;generation++;clearTimeout(timer);observer.disconnect();view.dispose();dialog.close();dialog.remove();host.navigate?.(box);}
  button('close').onclick=()=>{if(dirty||saving){status.textContent='Zuerst Entwurf übernehmen oder verwerfen.';return;}close();};
  dialog.oncancel=e=>{e.preventDefault();if(saving)return;if(dirty)reset();else close();};
  const observer=new ResizeObserver(()=>{view.render();});observer.observe(canvas);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='GPU-Kontext verloren. Entwurf bleibt erhalten; zur Karte zurückkehren.';button('save').disabled=true;});
  setFields();try{await load();if(record.route!.anchors.length>=2){dirty=!saved;await preview();}}catch(e){error(e);}
}
