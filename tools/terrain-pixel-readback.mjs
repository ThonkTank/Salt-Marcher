/** Probe-only WebGL2 readback. Bounded PBOs defer CPU access until a GPU fence
 * signals. Enqueue and copy costs are measured; neither is assumed free. */
export class TerrainPixelReadback {
 constructor(gl,capacity,count=3){
  this.gl=gl;this.capacity=capacity;this.pending=[];
  const binding=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
  this.slots=Array.from({length:count},()=>{const buffer=gl.createBuffer();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buffer);gl.bufferData(gl.PIXEL_PACK_BUFFER,capacity,gl.STREAM_READ);return {buffer,bytes:new Uint8Array(capacity),busy:false};});
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER,binding);
 }
 withBuffer(slot,read){
  const gl=this.gl,binding=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
  try{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,slot?.buffer??null);return read();}
  finally{gl.bindBuffer(gl.PIXEL_PACK_BUFFER,binding);}
 }
 transfer(slot,read){
  const gl=this.gl,names=[gl.PACK_ALIGNMENT,gl.PACK_ROW_LENGTH,gl.PACK_SKIP_PIXELS,gl.PACK_SKIP_ROWS],values=names.map(n=>gl.getParameter(n));
  try{for(let i=0;i<names.length;i++)gl.pixelStorei(names[i],i===0?1:0);return this.withBuffer(slot,read);}
  finally{for(let i=0;i<names.length;i++)gl.pixelStorei(names[i],values[i]);}
 }
 enqueue(region,meta){
  if(region.width*region.height*4>this.capacity)throw Error('Pixel probe exceeds its buffer capacity');
  const slot=this.slots.find(s=>!s.busy);if(!slot)return false;
  const gl=this.gl,start=performance.now();slot.busy=true;
  this.transfer(slot,()=>gl.readPixels(region.x,region.y,region.width,region.height,gl.RGBA,gl.UNSIGNED_BYTE,0));
  const sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)throw Error('Pixel probe fence failed');gl.flush();
  this.pending.push({slot,sync,region,meta,submittedAt:start,enqueueMs:performance.now()-start});return true;
 }
 poll(accept){
  const gl=this.gl;
  while(this.pending.length){
   const p=this.pending[0],status=gl.clientWaitSync(p.sync,0,0);
   if(status===gl.TIMEOUT_EXPIRED)break;
   if(status!==gl.ALREADY_SIGNALED&&status!==gl.CONDITION_SATISFIED)throw Error('Pixel probe fence wait failed');
   const start=performance.now(),bytes=p.slot.bytes.subarray(0,p.region.width*p.region.height*4);
   // Buffer-to-CPU copies do not use pixel pack parameters. Querying/restoring
   // those here needlessly synchronizes with the graphics process.
   this.withBuffer(p.slot,()=>gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,bytes));
   gl.deleteSync(p.sync);this.pending.shift();p.slot.busy=false;
   accept(bytes,{...p,availableAt:performance.now(),readMs:performance.now()-start});
  }
 }
 immediate(region){
  const gl=this.gl,bytes=new Uint8Array(region.width*region.height*4),start=performance.now();
  this.transfer(null,()=>gl.readPixels(region.x,region.y,region.width,region.height,gl.RGBA,gl.UNSIGNED_BYTE,bytes));
  return {bytes,submittedAt:start,availableAt:performance.now(),enqueueMs:performance.now()-start,readMs:0};
 }
 dispose(){for(const p of this.pending)this.gl.deleteSync(p.sync);for(const s of this.slots)this.gl.deleteBuffer(s.buffer);this.pending=[];this.slots=[];}
}

/** Only the interior is compared: the reticle lies outside 90% of the radius. */
export function terrainPixelDifference(before,after,region){
 let center=0,brush=0,maximum=0;
 for(let y=0;y<region.height;y++)for(let x=0;x<region.width;x++){
  const dx=x+region.x+.5-region.centerX,dy=y+region.y+.5-region.centerY,i=(y*region.width+x)*4;
  const difference=Math.max(Math.abs(before[i]-after[i]),Math.abs(before[i+1]-after[i+1]),Math.abs(before[i+2]-after[i+2]));
  if(Math.abs(dx)<16&&Math.abs(dy)<16&&difference>=3)center++;
  if(dx*dx+dy*dy<region.radius**2*.81){maximum=Math.max(maximum,difference);if(difference>=3)brush++;}
 }
 return {center,brush,maximum};
}

/** Stationary initial response only. Moving the pointer ends capture before
 * the cursor can cross the measurement interior. Ready time is an upper bound
 * on GPU pixel availability, not compositor presentation or a precise GPU clock. */
export function installTerrainResponseProbe(mode='async'){
 const map=document.querySelector('#campaign-map'),canvas=document.querySelector('#atlas-terrain-spatial'),gl=canvas.getContext('webgl2');
 const reader=new TerrainPixelReadback(gl,canvas.width*canvas.height*4),probe={runs:[],errors:[]};let active=null,raf;
 const accept=(bytes,p)=>{
  const run=p.meta.run;if(p.meta.baseline){run.baseline=bytes.slice();run.baselineRead={submittedAt:p.submittedAt,availableAt:p.availableAt,enqueueMs:p.enqueueMs,readMs:p.readMs};return;}
  if(!run.baseline||p.submittedAt>=run.stoppedAt)return;
  const changed=terrainPixelDifference(run.baseline,bytes,run.region),sample={submittedMs:p.submittedAt-run.pointerDownAt,readyMs:p.availableAt-run.pointerDownAt,enqueueMs:p.enqueueMs,readMs:p.readMs,draft:p.meta.draft,...changed};
  run.samples.push(sample);
  if(sample.draft==='height'&&changed.center>=4&&!run.firstCenter)run.firstCenter=sample;
  if(sample.draft==='height'&&changed.brush>=4&&!run.firstBrush)run.firstBrush=sample;
  if(run.firstCenter&&run.firstBrush&&active===run){run.stoppedAt=performance.now();run.stopReason='both-regions-changed';active=null;}
 };
 const capture=(run,baseline=false)=>{
  const meta={run,baseline,draft:map.dataset.terrainDraft??null};
  if(mode==='async'){if(!reader.enqueue(run.region,meta))run.skippedSamples++;}
  else{const p=reader.immediate(run.region);accept(p.bytes,{...p,meta});}
 };
 const stop=reason=>{if(active){active.stoppedAt=performance.now();active.stopReason=reason;active=null;}};
 const tick=()=>{try{reader.poll(accept);if(active)capture(active);}catch(e){probe.errors.push(String(e));stop('probe-error');reader.dispose();}raf=requestAnimationFrame(tick);};
 const down=e=>{
  if(e.target!==map||e.button!==0)return;
  try{
   stop('new-stroke');const v=JSON.parse(map.dataset.terrainProjection);if(v.tilt!==0)throw Error('Pixel probe currently requires a top-down camera');
   const box=map.getBoundingClientRect(),centerX=(e.clientX-box.x)*canvas.width/box.width,centerY=canvas.height-(e.clientY-box.y)*canvas.height/box.height,radius=Number(document.querySelector('#land-radius').value)/v.frame.width*canvas.width;
   if(!(radius>0))throw Error('Pixel probe needs a positive brush radius');
   const margin=Math.max(16,radius),x=Math.max(0,Math.floor(centerX-margin)),y=Math.max(0,Math.floor(centerY-margin)),right=Math.min(canvas.width,Math.ceil(centerX+margin)),top=Math.min(canvas.height,Math.ceil(centerY+margin));
   const run={pointerDownAt:e.timeStamp,clientX:e.clientX,clientY:e.clientY,region:{x,y,width:right-x,height:top-y,centerX,centerY,radius},samples:[],skippedSamples:0,stoppedAt:Infinity};probe.runs.push(run);active=run;capture(run,true);
  }catch(e){probe.errors.push(String(e));stop('probe-error');}
 };
 const move=e=>{if(active&&(e.clientX!==active.clientX||e.clientY!==active.clientY))stop('pointer-moved');};
 const up=()=>stop('pointer-up');document.addEventListener('pointerdown',down,true);document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);raf=requestAnimationFrame(tick);
 probe.reset=()=>{if(probe.errors.length||active||reader.pending.length)throw Error('Pixel probe has an error or unfinished stroke');probe.runs=[];};
 probe.snapshot=()=>{const error=gl.getError();if(error!==gl.NO_ERROR)probe.errors.push('WebGL error '+error);return {mode,errors:probe.errors,runs:probe.runs.map(({baseline,...run})=>run)};};
 probe.dispose=()=>{cancelAnimationFrame(raf);document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);reader.dispose();};
 window.__worldResponse=probe;return probe;
}
