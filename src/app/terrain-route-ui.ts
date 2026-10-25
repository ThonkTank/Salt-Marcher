import {prominenceEditor} from './atlas-prominence-editor';
import {atlasUnits,setAtlasUnits,atlasFieldValue,setAtlasFieldValue,lengthLabel} from './atlas-units';
import {emptyRecord,type LandscapeRecord,type LandscapeBox,type LandscapeAction} from './atlas-landscape';
import {routeSpec,routeDefaults,nearestRoute,type RouteStructure} from './terrain-route';
import {newLine,roadStyles} from './landscape-line';
import type {VegetationScene} from './vegetation';
import type {Point} from './contracts';

interface Host {
  token:string;box:()=>LandscapeBox;record?:LandscapeRecord;kind:'road'|'river';
  canvas:HTMLCanvasElement;panel:HTMLElement;
  point:(e:MouseEvent)=>Point;hit:(e:MouseEvent,keys:string[])=>{data:Record<string,string>}|null;
  navigation:(e:PointerEvent)=>boolean;current:()=>boolean;
  preview:(records:LandscapeRecord[]|undefined,anchors:Point[])=>void;closed:()=>void;
  write:(action:LandscapeAction|{kind:'undo'|'redo'})=>Promise<unknown>;
  changed?:()=>Promise<unknown>;navigate?:(box:LandscapeBox)=>void;
}
/** Route author controls on the main Atlas. Navigation, projection and rendering
 * belong to the Atlas; this session owns only the draft and canonical commands. */
export function openTerrainRoute(host:Host){
  const panel=document.createElement('section');panel.className='atlas-route-controls';panel.id='terrain-route-editor';
  panel.innerHTML=`<div class="toolbar"><strong>${host.kind==='river'?'Fluss':'Straße'} im Gelände</strong>
    <label>Maße <select id="route-units"><option value="dnd">DnD</option><option value="metric">Metrisch</option></select></label>
    <button data-action="fit">Verlauf einpassen</button>
    <button data-action="undo">Rückgängig</button><button data-action="redo">Wiederholen</button>
    <button data-action="close">Planung schließen</button></div>
    <div class="route-fields">
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
    </div><canvas id="route-profile" width="320" height="110" aria-label="Höhenprofil des Verlaufs"></canvas>
    <p id="route-status" role="status">Landschaft wird geladen …</p>`;
  host.panel.append(panel);host.panel.classList.add('route-planning');
  const field=<T extends HTMLElement>(id:string)=>panel.querySelector<T>('#route-'+id)!;
  const button=(action:string)=>panel.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  const status=field('status'),canvas=host.canvas;
  let record=structuredClone(host.record??emptyRecord(host.kind)),saved=host.record?structuredClone(host.record):undefined;
  record.route??=routeSpec(host.kind,record.points);record.line??=newLine(host.kind);
  let source:VegetationScene|undefined,proposal:LandscapeRecord|undefined,generation=0,closed=false,saving=false,dirty=false,timer:ReturnType<typeof setTimeout>|undefined;
  let selected=-1,insert=false,physicalDirty=!host.record?.route;
  const prominenceRoot=document.createElement('div');field('width').closest('label')!.after(prominenceRoot);
  const prominence=prominenceEditor(prominenceRoot,'route-prominence',()=>record,()=>{dirty=true;if(proposal)proposal.prominence=record.prominence;button('save').disabled=physicalDirty?!proposal:!saved;});
  const fitBox=()=>{
    const points=record.route!.anchors;if(points.length<2)return;
    const minX=Math.min(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxX=Math.max(...points.map(p=>p.x)),maxY=Math.max(...points.map(p=>p.y));
    const pad=Math.max(record.width*8,Math.min(200,record.route!.limits.corridor)),width=Math.max(80,maxX-minX+pad*2),height=Math.max(80,maxY-minY+pad*2,width*.65);
    host.navigate?.({x:(minX+maxX-width)/2,y:(minY+maxY-height)/2,width,height});
  };
  const limits=['corridor','cut','fill','shoulder','grade','depth','clearance'] as const;
  const setFields=()=>{
    record.line??=newLine(host.kind);
    prominence.refresh();
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
    prominence.refresh();
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
  let previewRecords:LandscapeRecord[]|undefined;
  function drawHandles(){host.preview(previewRecords,record.route!.anchors);}
  function invalidate(){physicalDirty=true;
    if(saving)return;dirty=true;proposal=undefined;previewRecords=undefined;button('save').disabled=true;generation++;clearTimeout(timer);
    drawHandles();showProfile({...record,route:{...record.route!,nodes:[]}});status.textContent='Entwurf geändert. Vorschau wird berechnet …';
    if(record.route!.anchors.length>=2)timer=setTimeout(()=>void preview(),250);
    else status.textContent='Start und Ziel auf dem Gelände anklicken.';
  }
  let profileRecord:LandscapeRecord|undefined;
  const showProfile=(r:LandscapeRecord)=>{
    profileRecord=r;
    const target=field<HTMLCanvasElement>('profile'),ctx=target.getContext('2d')!,nodes=r.route!.nodes;
    const width=target.clientWidth||800,height=target.clientHeight||110,dpr=window.devicePixelRatio||1;
    target.width=Math.round(width*dpr);target.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#eee7d6';ctx.fillRect(0,0,width,height);if(!nodes.length){target.setAttribute('aria-label','Höhenprofil noch nicht berechnet');return;}
    let length=0;const distances=nodes.map((p,i)=>{if(i)length+=Math.hypot(p.x-nodes[i-1]!.x,p.y-nodes[i-1]!.y);return length;});
    const min=Math.min(...nodes.map(p=>p.z)),max=Math.max(...nodes.map(p=>p.z)),range=Math.max(1,max-min);
    ctx.strokeStyle=host.kind==='river'?'#377f9e':'#856039';ctx.lineWidth=2;ctx.beginPath();
    nodes.forEach((p,i)=>{const x=20+distances[i]!/(length||1)*Math.max(1,width-40),y=height-25-(p.z-min)/range*Math.max(1,height-55);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
    ctx.fillStyle='#332d25';ctx.font='13px sans-serif';const text=`${lengthLabel(length)} · Höhe ${lengthLabel(min)} – ${lengthLabel(max)}`;
    target.setAttribute('aria-label','Höhenprofil: '+text);ctx.fillText(text,20,18);
  };
  const unitSelect=field<HTMLSelectElement>('units');
  const unitsChanged=()=>{unitSelect.value=atlasUnits();if(profileRecord)showProfile(profileRecord);};
  unitSelect.onchange=()=>{setAtlasUnits(unitSelect.value as 'dnd'|'metric');unitSelect.value=atlasUnits();};
  document.addEventListener('atlas-units-changed',unitsChanged);unitsChanged();
  async function preview(){
    if(!source||closed||saving||record.route!.anchors.length<2)return;
    readFields();const epoch=++generation;proposal=undefined;button('save').disabled=true;panel.setAttribute('aria-busy','true');
    status.textContent='Geländegerechter Verlauf wird berechnet …';
    try{
      const box=host.box();
      const result=await window.campaign.atlasSpatialScene(host.token,box,box.width/Math.max(1,canvas.clientWidth),{kind:'landscape-route',record:structuredClone(record)},source.fence);
      if(closed||epoch!==generation)return;if(!result.ok)throw Error(result.error);
      proposal=result.value.records.find(r=>r.id===record.id);if(!proposal?.route)throw Error('Verlauf fehlt in der Vorschau.');
      proposal.prominence=record.prominence;
      // City road copies only constrain the planner; their authored geometry is already in the Atlas.
      previewRecords=result.value.records.filter(r=>!r.id.startsWith('city-road:'));drawHandles();showProfile(proposal);
      button('save').disabled=false;
      const structures=[...new Set(proposal.route.nodes.map(n=>n.structure))].filter(k=>k!=='ground');
      const names={bridge:'Brücke',ford:'Furt',tunnel:'Tunnel'};
      status.textContent='Vorschau bereit · '+(structures.length?structures.map(k=>names[k as keyof typeof names]).join(', ')+' · ':'')+'Geländeform und Verlauf werden gemeinsam gespeichert.';
    }catch(e){if(epoch===generation&&!closed){status.textContent=(e as Error).message;previewRecords=undefined;drawHandles();}}
    finally{if(epoch===generation)panel.setAttribute('aria-busy','false');}
  }
  async function load(){
    const epoch=++generation,box=host.box();const result=await window.campaign.atlasSpatialScene(host.token,box,box.width/Math.max(1,canvas.clientWidth));
    if(closed||epoch!==generation)return;if(!result.ok)throw Error(result.error);source=result.value;previewRecords=undefined;drawHandles();
    if(host.kind==='river'){
      const select=field<HTMLSelectElement>('mouth');select.replaceChildren(new Option('Freies Ziel / Meer',''));
      for(const r of source.records)if(r.id!==record.id&&(r.kind==='river'&&r.route||r.surface==='freshwater'))select.add(new Option(r.name||r.kind,r.id));
      select.value=record.route?.mouth?.id??'';
    }
    status.textContent='Start, Zwischenpunkte und Ziel setzen. Punkte lassen sich ziehen.';
    panel.setAttribute('aria-busy','false');
  }
  // Capture author gestures before normal tools; navigation remains entirely in AtlasCanvas.
  const parent=canvas.parentElement!;
  const listen=<K extends keyof HTMLElementEventMap>(type:K,handler:(e:HTMLElementEventMap[K])=>void)=>{
    parent.addEventListener(type,handler,true);return()=>parent.removeEventListener(type,handler,true);
  };
  const stop=(e:Event)=>{e.preventDefault();e.stopImmediatePropagation();};
  let gesture:{pointer:number;index:number;start:Point;moved:boolean}|undefined;
  const release=()=>{if(gesture&&canvas.hasPointerCapture(gesture.pointer))canvas.releasePointerCapture(gesture.pointer);gesture=undefined;};
  const listeners=[
    listen('pointerdown',e=>{
      if(e.target!==canvas||host.navigation(e))return;stop(e);
      if(saving||!source||!host.current()||e.button!==0)return;
      canvas.focus({preventScroll:true});
      const handle=host.hit(e,['routeAnchor']),index=handle?Number(handle.data.routeAnchor):-1;
      gesture={pointer:e.pointerId,index,start:{x:e.clientX,y:e.clientY},moved:false};
      if(index>=0)selected=index;canvas.setPointerCapture(e.pointerId);
    }),
    listen('pointermove',e=>{
      if(!gesture||e.pointerId!==gesture.pointer)return;stop(e);
      if(Math.hypot(e.clientX-gesture.start.x,e.clientY-gesture.start.y)>3)gesture.moved=true;
      if(gesture.index>=0&&gesture.moved&&host.current()){
        record.route!.anchors[gesture.index]=host.point(e);previewRecords=undefined;proposal=undefined;button('save').disabled=true;drawHandles();
      }
    }),
    listen('pointerup',e=>{
      if(!gesture||e.pointerId!==gesture.pointer)return;stop(e);const d=gesture;release();
      if(!host.current())return;
      if(d.index<0&&!d.moved){
        const at=insert&&selected>=0?selected+1:record.route!.anchors.length;
        record.route!.anchors.splice(at,0,host.point(e));if(record.route!.anchors.length>1)record.route!.sections.splice(Math.max(0,at-1),0,'auto');selected=at;insert=false;
      }
      showPoints();if(d.index<0&&!d.moved||d.index>=0&&d.moved)invalidate();
    }),
    listen('pointercancel',e=>{if(gesture&&gesture.pointer===e.pointerId){stop(e);release();showPoints();invalidate();}}),
    listen('click',e=>{if(e.target===canvas&&!e.altKey)stop(e);}),
    listen('keydown',e=>{if(e.target!==canvas)return;if(e.key==='Escape'){stop(e);if(!saving){if(dirty)reset();else close();}}if(e.key==='Enter'){stop(e);button('save').click();}}),
  ];
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
  button('fit').onclick=fitBox;
  button('preview').onclick=()=>void preview();
  button('save').onclick=()=>void(async()=>{
    if((!proposal&&(physicalDirty||!saved))||!source||saving)return;saving=true;button('save').disabled=true;
    try{
      const result=await host.write(!physicalDirty&&saved?{kind:'landscape-prominence',id:saved.id,expectedRevision:saved.revision,prominence:record.prominence??null}:{kind:'landscape-route',record:proposal!,expectedRevision:saved?.revision??null,sourceRevision:source.revision});
      if(!result)throw Error('Änderung nicht bestätigt. Entwurf bleibt erhalten.');
      await host.changed?.();dirty=false;physicalDirty=false;await load();saved=source!.records.find(r=>r.id===record.id);
      if(saved)record=structuredClone(saved);proposal=undefined;setFields();status.textContent='Verlauf und Geländeform gespeichert.';
      button('delete').hidden=false;
    }catch(e){error(e);button('save').disabled=false;}finally{saving=false;}
  })();
  const reset=()=>{generation++;clearTimeout(timer);record=structuredClone(saved??emptyRecord(host.kind));record.route??=routeSpec(host.kind,record.points);record.line??=newLine(host.kind);proposal=undefined;dirty=false;physicalDirty=!saved?.route;selected=-1;button('save').disabled=true;setFields();previewRecords=undefined;drawHandles();showProfile(record);status.textContent='Entwurf verworfen.';};
  button('cancel').onclick=reset;
  for(const action of ['undo','redo'] as const)button(action).onclick=()=>void(async()=>{if(dirty||saving){status.textContent='Zuerst Entwurf übernehmen oder verwerfen.';return;}saving=true;try{await host.write({kind:action});await host.changed?.();await load();saved=source?.records.find(r=>r.id===record.id);reset();}catch(e){error(e);}finally{saving=false;}})();
  button('delete').onclick=()=>void(async()=>{if(!saved||saving)return;saving=true;try{await host.write({kind:'landscape-remove',id:saved.id,expectedRevision:saved.revision});await host.changed?.();dirty=false;close();}catch(e){error(e);}finally{saving=false;}})();
  function close(){
    if(closed)return;closed=true;release();listeners.forEach(remove=>remove());
    document.removeEventListener('atlas-units-changed',unitsChanged);generation++;clearTimeout(timer);observer.disconnect();
    host.preview(undefined,[]);panel.remove();host.panel.classList.remove('route-planning');host.closed();
  }
  button('close').onclick=()=>{if(dirty||saving){status.textContent='Zuerst Entwurf übernehmen oder verwerfen.';return;}close();};
  const observer=new ResizeObserver(()=>{if(profileRecord)showProfile(profileRecord);});observer.observe(field('profile'));
  setFields();let loading=true;
  const ready=load().then(async()=>{if(!closed&&record.route!.anchors.length>=2){dirty=!saved;await preview();}}).catch(error).finally(()=>{loading=false;});
  return {ready,hasDraft:()=>loading||dirty||saving||!!gesture,gesturing:()=>!!gesture,history:(kind:'undo'|'redo')=>button(kind).click(),close,cancel:reset};
}
