import {VERSION} from '@deck.gl/core';
import type {Device, Framebuffer} from '@luma.gl/core';

interface PickerRuntime {
  device: Device;
  pickingFBO?: Framebuffer;
  depthFBO?: Framebuffer;
  _resizeBuffer: (...args: unknown[]) => void;
}
interface CanvasSize {getDrawingBufferSize():readonly [number,number]}
export interface AtlasPickingResizeReservation {
  oldColor:readonly [number,number];
  oldDepth:readonly [number,number];
  next:readonly [number,number];
}
type ReserveResize=(size:AtlasPickingResizeReservation)=>void;
const managed=new WeakSet<Framebuffer>();
const wrapped=new WeakMap<PickerRuntime,{reserve?:ReserveResize}>();
const format = (buffer: Framebuffer | undefined) => buffer?.depthStencilAttachment?.texture.format;
const size=(buffer:Framebuffer|undefined):readonly [number,number]=>[buffer?.width??0,buffer?.height??0];
function contextSize(picker:PickerRuntime,context?:CanvasSize):readonly [number,number]|undefined{
  const actual=context??(typeof picker.device.getDefaultCanvasContext==='function'?picker.device.getDefaultCanvasContext():undefined);
  if(!actual||typeof actual.getDrawingBufferSize!=='function')return;
  const [width,height]=actual.getDrawingBufferSize();
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)throw new Error('Invalid Atlas picking drawing buffer size');
  return[width,height];
}
function installResizeGuard(deck:object,picker:PickerRuntime,reserve?:ReserveResize){
  const state=wrapped.get(picker);
  if(state){if(reserve)state.reserve=reserve;return;}
  const installed={reserve};
  const original=picker._resizeBuffer;
  picker._resizeBuffer=(...args:unknown[])=>{
    const candidate=args[0] as CanvasSize|undefined;
    ensureAtlasDeckPickingDepth(deck,installed.reserve,candidate);
    // Deck keeps its own picker and call path. At this point both attachments
    // already have the target dimensions, so its luma resize is a no-op.
    original.apply(picker,args);
  };
  wrapped.set(picker,installed);
}

/** Deck 9.4 allocates 16-bit picking depth even on a 24-bit canvas.
 * Coplanar quantization can then select a buried room. Keep both 24-bit
 * pickers at the current drawing-buffer size without luma's attachment
 * resize, which retains old textures until the entire framebuffer dies. */
export function ensureAtlasDeckPickingDepth(deck:object,reserve?:ReserveResize,context?:CanvasSize):void{
  if(VERSION!=='9.4.0')throw new Error('Atlas picking requires reviewed deck.gl 9.4.0');
  const picker=(deck as {deckPicker?:PickerRuntime}).deckPicker;
  if(!picker||typeof picker._resizeBuffer!=='function'||!picker.device)
    throw new Error('Unsupported Atlas Deck picker contract');
  const oldColor=picker.pickingFBO,oldDepth=picker.depthFBO;
  if([{buffer:oldColor,expected:'rgba8unorm'},{buffer:oldDepth,expected:'rgba32float'}]
    .some(({buffer,expected})=>buffer&&(buffer.colorAttachments.length!==1||buffer.colorAttachments[0]!.texture.format!==expected)))
    throw new Error('Unsupported Atlas picking color attachment');
  const colorFormat=format(oldColor),depthFormat=format(oldDepth),already24=colorFormat==='depth24plus'&&depthFormat==='depth24plus';
  if([colorFormat,depthFormat].some(value=>value&&value!=='depth16unorm'&&value!=='depth24plus')||
    (oldColor&&oldDepth&&colorFormat!==depthFormat))throw new Error('Unsupported Atlas picking framebuffer format');
  const next=contextSize(picker,context),matches=already24&&(!next||[oldColor,oldDepth].every(buffer=>buffer?.width===next[0]&&buffer?.height===next[1]));
  if(matches){installResizeGuard(deck,picker,reserve);return;}
  if(already24&&(!oldColor||!oldDepth||!managed.has(oldColor)||!managed.has(oldDepth)))
    throw new Error('Unsupported Atlas picking framebuffer ownership');
  const device=picker.device;
  // luma's WebGL "renderable" capability asks about COLOR renderability;
  // depth attachments use the support check and framebuffer completeness.
  if(!device.isTextureFormatSupported('depth24plus')||!device.isTextureFormatRenderable('rgba32float'))
    throw new Error('Atlas requires 24-bit picking depth and floating-point height readback');
  if(next)reserve?.({oldColor:size(oldColor),oldDepth:size(oldDepth),next});
  const dimensions=next?{width:next[0],height:next[1]}:{};
  let color:Framebuffer|undefined,depth:Framebuffer|undefined;
  try{
    color=device.createFramebuffer({id:'atlas-picking-24',...dimensions,colorAttachments:['rgba8unorm'],depthStencilAttachment:'depth24plus'});
    depth=device.createFramebuffer({id:'atlas-height-24',...dimensions,colorAttachments:['rgba32float'],depthStencilAttachment:'depth24plus'});
    if(next&&[color,depth].some(buffer=>buffer.width!==next[0]||buffer.height!==next[1]))
      throw new Error('Atlas picking framebuffer dimensions do not match drawing buffer');
  }catch(error){color?.destroy();depth?.destroy();throw error;}
  // Both candidates are ready before the picker sees either of them.
  picker.pickingFBO=color;picker.depthFBO=depth;
  managed.add(color);managed.add(depth);
  for(const buffer of [oldColor,oldDepth]){
    if(!buffer)continue;
    const externalColors=!managed.has(buffer)?buffer.colorAttachments.map(attachment=>attachment.texture):[];
    buffer.destroy();
    for(const texture of externalColors)if(!texture.destroyed)texture.destroy();
  }
  installResizeGuard(deck,picker,reserve);
}
