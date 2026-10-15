/** Presentation only. Scene units and DOM hits are interpreted by the adopter. */
export interface CanvasBox {x:number;y:number;width:number;height:number}
export type CameraReason='pan'|'zoom'|'reset'|'set';
export class PassiveMapCanvas {
 private box:CanvasBox;private initial:CanvasBox;private contextKey='';private rendering=false;private failed=false;
 private renderScene:(()=>void)|null=null;private emptyText='';
 private drag:{id:number;inverse:DOMMatrix;start:DOMPoint;box:CanvasBox;moved:boolean}|null=null;
 private suppressClick=false;private readonly panel:HTMLDivElement;private readonly note:HTMLSpanElement;
 constructor(readonly root:SVGSVGElement,private options:{initial:CanvasBox;minWidth?:number;maxWidth?:number;pan?:(event:PointerEvent)=>boolean;locked?:()=>boolean;changed?:(box:CanvasBox,reason:CameraReason)=>void}){
  this.box={...options.initial};this.initial={...options.initial};this.apply();
  const doc=root.ownerDocument;this.panel=doc.createElement('div');this.panel.className='map-canvas-state';this.panel.hidden=true;this.panel.dataset.canvasFor=root.id;this.note=doc.createElement('span');
  const retry=doc.createElement('button');retry.type='button';retry.textContent='Karte erneut zeichnen';retry.onclick=()=>{this.failed=false;this.render(this.renderScene!,this.emptyText);};this.panel.append(this.note,retry);root.after(this.panel);
  root.style.touchAction='none';
  root.addEventListener('pointerdown',e=>{
   if(this.failed){e.preventDefault();e.stopImmediatePropagation();return;}
   this.suppressClick=false;
   if(this.drag||this.options.locked?.()||!(this.options.pan?.(e)??e.button===1))return;
   const matrix=root.getScreenCTM();if(!matrix)return;
   this.suppressClick=false;const inverse=matrix.inverse();this.drag={id:e.pointerId,inverse,start:new DOMPoint(e.clientX,e.clientY).matrixTransform(inverse),box:{...this.box},moved:false};
   if(e.button===1){root.setPointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation();}
  },true);
  root.addEventListener('pointermove',e=>{
   const drag=this.drag;if(!drag||drag.id!==e.pointerId)return;
   if(!drag.moved&&Math.hypot(e.clientX-this.screenStart(drag).x,e.clientY-this.screenStart(drag).y)<3)return;
   drag.moved=true;this.suppressClick=true;root.setPointerCapture(e.pointerId);
   const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(drag.inverse);
   this.set({ ...drag.box,x:drag.box.x-(p.x-drag.start.x),y:drag.box.y-(p.y-drag.start.y)},true,'pan');e.preventDefault();e.stopImmediatePropagation();
  },true);
  const finish=(e:PointerEvent)=>{if(this.drag?.id!==e.pointerId)return;const moved=this.drag.moved;this.cancel();if(moved||e.button===1){e.preventDefault();e.stopImmediatePropagation();}};
  root.addEventListener('pointerup',finish,true);root.addEventListener('pointercancel',finish,true);root.addEventListener('lostpointercapture',()=>this.cancel());
  root.addEventListener('click',e=>{if(this.suppressClick||this.failed){this.suppressClick=false;e.preventDefault();e.stopImmediatePropagation();}},true);
  root.addEventListener('wheel',e=>{if(!e.deltaY)return;e.preventDefault();e.stopImmediatePropagation();if(this.options.locked?.()||this.drag)return;const matrix=root.getScreenCTM?.();const p=matrix?new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()):undefined;this.zoom(e.deltaY>0?1.2:1/1.2,p);},{capture:true,passive:false});
 }
 private screenStart(drag:NonNullable<PassiveMapCanvas['drag']>){return drag.start.matrixTransform(drag.inverse.inverse());}
 get view(){return{...this.box};}
 get panning(){return!!this.drag;}
 private apply(){this.root.setAttribute('viewBox',`${this.box.x} ${this.box.y} ${this.box.width} ${this.box.height}`);}
 set(box:CanvasBox,notify=false,reason:CameraReason='set'){
  if(!Object.values(box).every(Number.isFinite)||box.width<=0||box.height<=0)throw new Error('Kartenausschnitt benötigt endliche positive Maße.');
  this.box={...box};this.apply();if(notify)this.options.changed?.(this.view,reason);
 }
 context(key:string,initial:CanvasBox){if(key===this.contextKey)return false;this.contextKey=key;this.cancel();this.initial={...initial};this.set(initial);this.failed=false;return true;}
 zoom(factor:number,anchor={x:this.box.x+this.box.width/2,y:this.box.y+this.box.height/2}){
  if(!Number.isFinite(factor)||factor<=0)return;
  const width=Math.min(this.options.maxWidth??1e12,Math.max(this.options.minWidth??.001,this.box.width*factor)),ratio=width/this.box.width;
  this.set({x:anchor.x-(anchor.x-this.box.x)*ratio,y:anchor.y-(anchor.y-this.box.y)*ratio,width,height:this.box.height*ratio},true,'zoom');
 }
 reset(){this.cancel();this.set(this.initial,true,'reset');}
 pan(dx:number,dy:number){this.set({...this.box,x:this.box.x+dx,y:this.box.y+dy},true,'pan');}
 cancel(){const drag=this.drag;this.drag=null;if(drag&&this.root.hasPointerCapture(drag.id))this.root.releasePointerCapture(drag.id);}
 /** Render and hit-test share this one SVG scene. Failed partial scenes are never interactive. */
 render(draw:()=>void,emptyText=''){
  this.renderScene=draw;this.emptyText=emptyText;if(this.rendering||this.failed)return;
  this.rendering=true;const previous=[...this.root.childNodes];
  try{
   draw();this.root.style.visibility='';this.root.removeAttribute('aria-disabled');this.root.dataset.canvasState=emptyText?'empty':'loaded';
   this.panel.hidden=!emptyText;this.panel.setAttribute('role','status');this.note.textContent=emptyText;this.panel.querySelector('button')!.hidden=true;
  }catch(error){
   this.root.replaceChildren(...previous);this.failed=true;this.cancel();this.root.style.visibility='hidden';this.root.setAttribute('aria-disabled','true');this.root.dataset.canvasState='unavailable';
   this.panel.hidden=false;this.panel.setAttribute('role','alert');this.note.textContent='Karte konnte nicht gezeichnet werden. Daten und Navigation bleiben erhalten. '+(error as Error).message;this.panel.querySelector('button')!.hidden=false;
  }finally{this.rendering=false;}
 }
}
