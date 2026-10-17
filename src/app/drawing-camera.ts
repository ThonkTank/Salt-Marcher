export interface CameraBox {x:number;y:number;width:number;height:number}
export function zoomDrawingCamera(box:CameraBox,factor:number,anchor={x:box.x+box.width/2,y:box.y+box.height/2}):CameraBox {
 const scale=Math.max(1/box.width,Math.min(1000000/box.width,factor));
 return{x:anchor.x+(box.x-anchor.x)*scale,y:anchor.y+(box.y-anchor.y)*scale,width:box.width*scale,height:box.height*scale};
}
/** View changes have no authoring commands and never move the underlying geometry. */
export function initDrawingCamera(map:SVGSVGElement,redraw:()=>void,isHand:()=>boolean) {
 let held=false,drag:{id:number;x:number;y:number;box:CameraBox;inverse:DOMMatrix}|null=null;
 const read=():CameraBox=>{const b=map.viewBox.baseVal;return{x:b.x,y:b.y,width:b.width,height:b.height};};
 const apply=(b:CameraBox)=>{map.setAttribute('viewBox',`${b.x} ${b.y} ${b.width} ${b.height}`);redraw();};
 const zoom=(factor:number,anchor?:{x:number;y:number})=>apply(zoomDrawingCamera(read(),factor,anchor));
 document.getElementById('drawing-zoom-in')!.addEventListener('click',()=>zoom(.8));
 document.getElementById('drawing-zoom-out')!.addEventListener('click',()=>zoom(1.25));
 map.addEventListener('wheel',event=>{
  if(document.querySelector('dialog[open]'))return;
  const matrix=map.getScreenCTM();if(!matrix)return;event.preventDefault();
  const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());zoom(Math.exp(Math.max(-1,Math.min(1,event.deltaY*.002))),p);
 },{passive:false});
 map.addEventListener('pointerdown',event=>{
  if(event.button!==1&&!(event.button===0&&(held||isHand())))return;
  const matrix=map.getScreenCTM();if(!matrix)return;
  event.preventDefault();event.stopImmediatePropagation();map.focus();
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,box:read(),inverse:matrix.inverse()};map.setPointerCapture(event.pointerId);map.classList.add('camera-dragging');
 },true);
 map.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;event.stopImmediatePropagation();
  const a=new DOMPoint(drag.x,drag.y).matrixTransform(drag.inverse),b=new DOMPoint(event.clientX,event.clientY).matrixTransform(drag.inverse);
  apply({...drag.box,x:drag.box.x+a.x-b.x,y:drag.box.y+a.y-b.y});
 },true);
 const release=(event:PointerEvent)=>{if(drag?.id!==event.pointerId)return;event.stopImmediatePropagation();drag=null;map.classList.remove('camera-dragging');};
 map.addEventListener('pointerup',release,true);map.addEventListener('pointercancel',release,true);
 map.addEventListener('click',event=>{if(isHand()||held){event.preventDefault();event.stopImmediatePropagation();}},true);
 map.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||document.querySelector('dialog[open]'))return;
  if(event.key===' '){held=true;event.preventDefault();return;}
  if(['+','=','-'].includes(event.key)){event.preventDefault();zoom(event.key==='-'?1.25:.8);return;}
  const delta:{[key:string]:[number,number]}={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]},d=delta[event.key];
  if(d){event.preventDefault();const b=read();apply({...b,x:b.x+d[0]*b.width,y:b.y+d[1]*b.height});}
 });
 map.addEventListener('keyup',event=>{if(event.key===' ')held=false;});map.addEventListener('blur',()=>{held=false;});
}
