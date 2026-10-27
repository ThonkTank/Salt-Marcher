/** Runs before application initialization in the disposable benchmark profile.
 * The one-word author seed is frozen; UUIDs and canonical command ids retain
 * their ordinary random identity. No production setting is changed. */
export async function installTerrainWaterObserver(page,seed,{continuousCheck=false}={}){
 await page.addInitScript(({seed,continuousCheck})=>{
  const original=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=array=>array instanceof Uint32Array&&array.length===1?(array[0]=seed,array):original(array);
  window.__tw={attempts:[],armed:null,active:null,frames:[],boundaries:[],continuousCheck,lastPreparedFrame:null};
  if(continuousCheck){
   const previous=window.__atlasTerrainFrameProbe;
   window.__atlasTerrainFrameProbe=drawn=>{
    previous?.(drawn);
    const prepared=drawn?.field?.prepared,screen=window.__twSurface?.preparedScreenSnapshot;
    if(!prepared||!screen||screen.content!==drawn.content)return;
    const binding={at:performance.now(),content:screen.content,draftRevision:screen.draftRevision,
     fieldState:screen.fieldState,basis:screen.basis,alpha:screen.alpha,
     frameRevision:screen.frameRevision,camera:{...drawn.frame.camera},
     viewport:{width:drawn.frame.viewport.width,height:drawn.frame.viewport.height},
     origin:{target:{...prepared.origin.target},epoch:prepared.origin.epoch,
      editSeries:prepared.origin.editSeries},
     sources:{old:prepared.source.oldSources.map(source=>({id:source.id,source:source.source,
       lod:source.lod,x:source.x,y:source.y})),
      next:prepared.source.newSources.map(source=>({id:source.id,source:source.source,
       lod:source.lod,x:source.x,y:source.y}))}};
    window.__tw.lastPreparedFrame=binding;
    const active=window.__tw.active;
    if(!active||active.releaseAt!==undefined||!active.events.some(e=>e.type==='pointermove')||
      active.baselineFrame?.draftRevision===binding.draftRevision||active.rawFrames.length>=24)return;
    const key=`${binding.content}:${binding.draftRevision}:${binding.fieldState}`;
    if(active.rawFrames.some(frame=>frame.key===key))return;
    const started=performance.now(),rgba=active.pixels();
    const readMs=performance.now()-started;
    const error=active.gl.getError();
    if(error){active.rawError=`Raw terrain read failed: ${error}`;return;}
    active.rawFrames.push({key,binding,readMs,rgba});
   };
  }
  const events=[];
  events.push=function(...items){
   for(const event of items){
    const active=window.__tw.active;
    if(active&&event.start>=active.inputAt){
     if(event.stage.startsWith('input.'))active.guard.push(event.stage);
     if(event.stage==='draft.height')active.localHeightAt=event.start;
     if(event.stage==='commit.roundtrip')active.commit={start:event.start,durationMs:event.duration,finishedAt:event.start+event.duration,afterReleaseMs:active.releaseAt===undefined?null:event.start+event.duration-active.releaseAt};
     if(!continuousCheck&&!active.visible&&event.stage==='frame.terrain'&&active.localHeightAt!==undefined&&document.querySelector('#campaign-map')?.dataset.terrainDraft==='height'){
      const started=performance.now(),after=active.pixels();
      let changed=0;for(let i=0;i<after.length;i++)if(after[i]!==active.before[i])changed++;
      const verifiedAt=performance.now();
      active.observerMs.push(performance.now()-started);
      if(changed)active.visible={afterRenderAt:event.start,verifiedAt,latencyMs:verifiedAt-active.inputAt,afterRenderLatencyMs:event.start-active.inputAt,changedChannels:changed,terrainRevision:event.revision};
     }
    }
   }
   return Array.prototype.push.apply(this,items);
  };
  window.__saltTerrainTrace={events,dropped:0};
  window.addEventListener('pointerdown',event=>{
   const inputAt=performance.now();
   if(event.target===document.querySelector('#campaign-map'))window.__tw.lastPointerId=event.pointerId;
   const armed=window.__tw.armed;if(!armed||event.target!==document.querySelector('#campaign-map'))return;
   window.__tw.armed=null;
   const canvas=document.querySelector('#atlas-terrain-spatial canvas'),gl=canvas.getContext('webgl2'),rect=canvas.getBoundingClientRect(),size=continuousCheck?96:16;
   // Interior of the brush footprint: the unchanged hover/radius ring is
   // outside this rectangle. Frame attribution additionally requires a local
   // height update followed by its real Deck afterRender callback.
   const x=Math.max(0,Math.min(gl.drawingBufferWidth-size,Math.round((event.clientX-rect.left)/rect.width*gl.drawingBufferWidth-size/2)));
   const y=Math.max(0,Math.min(gl.drawingBufferHeight-size,Math.round((1-(event.clientY-rect.top)/rect.height)*gl.drawingBufferHeight-size/2)));
   const pixels=()=>{const data=new Uint8Array(size*size*4),previous=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);gl.readPixels(x,y,size,size,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,previous);return data;};
   const started=performance.now(),before=pixels();
   const baselineReadMs=performance.now()-started;
   const rawError=continuousCheck&&gl.getError()?`Raw terrain pointerdown read failed`:null;
   window.__tw.active={...armed,inputAt,trusted:event.isTrusted,pointerId:event.pointerId,surface:{...document.querySelector('#campaign-map').dataset},before,pixels,gl,rawSize:size,rawFrames:[],rawError,baselineFrame:window.__tw.lastPreparedFrame,guard:[],events:[{type:'pointerdown',at:inputAt,timeStamp:event.timeStamp,x:event.clientX,y:event.clientY,trusted:event.isTrusted}],baselineSetupMs:started-inputAt,baselineReadMs,observerMs:[baselineReadMs],visible:null};
  },true);
  for(const type of ['pointermove','pointerup'])window.addEventListener(type,event=>{const active=window.__tw.active;if(active&&event.pointerId===active.pointerId){const at=performance.now();active.events.push({type,at,timeStamp:event.timeStamp,x:event.clientX,y:event.clientY,trusted:event.isTrusted});if(type==='pointerup')active.releaseAt=at;}},true);
  for(const kind of ['pointercancel','blur','focus','keydown'])window.addEventListener(kind,event=>{if(kind!=='keydown'||event.key==='Escape')window.__tw.boundaries.push({kind,at:performance.now(),trusted:event.isTrusted,hasFocus:document.hasFocus(),target:event.target===window?'window':event.target?.id??null});},true);
 },{seed,continuousCheck});
}

/** Every planned attempt is emitted once. Actual event arrival times are
 * recorded by the renderer; scheduler delay is never hidden by replacement. */
export async function replayTerrainWaterAttempt(page,app,attempt,box,uiScale=1){
 await page.evaluate(()=>{window.__tw.active=null;window.__saltTerrainTrace.events.length=0;window.__saltTerrainTrace.dropped=0;});
 const point=p=>({x:box.x+box.width*(.5+p.x),y:box.y+box.height*.5+p.y*box.width});
 const first=point(attempt.path[0]);await page.mouse.move(Math.round(first.x*uiScale)/uiScale,Math.round(first.y*uiScale)/uiScale);
 await page.evaluate(attempt=>{window.__tw.armed={id:attempt.id,kind:attempt.kind,planned:attempt};},attempt);
 const plan=[{type:'mouseDown',atMs:0,...first},...attempt.path.slice(1).map(p=>({type:'mouseMove',atMs:p.atMs,...point(p)})),{type:'mouseUp',atMs:attempt.durationMs,...point(attempt.path.at(-1))}];
 // Dispatch the complete timed plan inside Main. Per-event inspector/CDP round
 // trips must not lengthen dense gestures or let GPU readback gate the writer.
 const actual=await app.evaluate(({BrowserWindow},plan)=>new Promise(resolve=>{
  const window=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html')),contents=window.webContents,zoom=contents.getZoomFactor(),start=performance.now(),sent=[];
  for(const event of plan)setTimeout(()=>{
   contents.sendInputEvent({type:event.type,x:Math.round(event.x*zoom),y:Math.round(event.y*zoom),button:'left',clickCount:1,...(event.type==='mouseMove'?{modifiers:['leftbuttondown']}:{})});
   sent.push({...event,sentAtMs:performance.now()-start,zoom});if(event.type==='mouseUp')resolve(sent);
  },event.atMs);
 }),plan);
 await page.waitForFunction(()=>window.__tw.active?.releaseAt!==undefined,null,{timeout:10000});
 return page.evaluate(actual=>{
  const active=window.__tw.active;if(!active)return{error:'No pointer event received',actual};
  active.mainReplay=actual;
  const {pixels,gl,before,...record}=active;
  if(window.__tw.continuousCheck){record.rawBaseline=[...before];record.rawFrames=record.rawFrames.map(frame=>({...frame,rgba:[...frame.rgba]}));}
  record.dropped=window.__saltTerrainTrace.dropped;
  window.__tw.attempts.push(record);return record;
 },actual);
}

export async function terrainWaterAttemptEvidence(page){
 return page.evaluate(()=>{const active=window.__tw.active;if(!active)return null;const{pixels,before,gl,...evidence}=active;return{...evidence,dropped:window.__saltTerrainTrace.dropped};});
}
