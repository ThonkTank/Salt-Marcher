/** Controller fixture only: project retained paint to a queryable DOM.
 * Real Canvas2D painting/picking is tested in desktop-atlas-canvas and the browser.
 * These controller tests retain their command/history/draft assertions without
 * pretending linkedom implements Canvas2D or native pointer hit-testing.
 */
import {PassiveMapCanvas} from '../src/app/passive-map-canvas';
import {AtlasPaint} from '../src/app/atlas-paint';
import {paintElement} from '../src/app/atlas-paint-svg';
export class AtlasCanvas {
 private camera:PassiveMapCanvas;
 constructor(readonly root:SVGSVGElement,options:ConstructorParameters<typeof PassiveMapCanvas>[1]){this.camera=new PassiveMapCanvas(root,options);}
 get view(){return this.camera.view;}
 context(...args:Parameters<PassiveMapCanvas['context']>){return this.camera.context(...args);}
 set(...args:Parameters<PassiveMapCanvas['set']>){return this.camera.set(...args);}
 zoom(...args:Parameters<PassiveMapCanvas['zoom']>){return this.camera.zoom(...args);}
 reset(){return this.camera.reset();}

 get ready(){return this.root.dataset.canvasState!=='unavailable';}
 point(e:MouseEvent){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(this.root.getScreenCTM()!.inverse());return{x:p.x+this.view.x,y:p.y+this.view.y};}
 hitAt(e:MouseEvent,keys:string[]){const node=(e.target as Element)?.closest?.(keys.map(k=>'[data-'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']').join(','));return node?{data:{...(node as SVGElement).dataset}}:null;}
 render(draw:(scene:AtlasPaint)=>void,empty=''){
  this.camera.render(root=>{
   const paint=new AtlasPaint('group');draw(paint);
   const element=(p:AtlasPaint)=>paintElement(p,root.ownerDocument);
   for(const p of paint.children)root.append(element(p));
  },empty);
 }
}
