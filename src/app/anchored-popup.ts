export function bindAnchoredPopup(trigger:HTMLButtonElement,popup:HTMLElement,options:{width:number;placement?:'below'|'trailing';offset?:number}){
 const view=popup.ownerDocument.defaultView!,gap=8,offset=options.offset??8;
 const opened=()=>popup.matches(':popover-open');
 const close=()=>{if(opened())popup.hidePopover();trigger.setAttribute('aria-expanded','false');};
 const place=()=>{
  if(!opened())return;
  const anchor=trigger.getBoundingClientRect();
  if(!trigger.isConnected||!anchor.width||anchor.bottom<=0||anchor.top>=view.innerHeight){close();return;}
  const below=Math.max(0,view.innerHeight-anchor.bottom-offset-gap),above=Math.max(0,anchor.top-offset-gap);
  const height=popup.scrollHeight+2,under=height<=below||below>=above;
  popup.style.maxHeight=(under?below:above)+'px';
  const bounds=popup.getBoundingClientRect();
  const desired=options.placement==='trailing'?anchor.right-bounds.width:anchor.left;
  popup.style.left=Math.max(gap,Math.min(desired,view.innerWidth-bounds.width-gap))+'px';
  popup.style.top=(under?anchor.bottom+offset:Math.max(gap,anchor.top-offset-bounds.height))+'px';
 };
 popup.style.position='fixed';popup.style.inset='auto';popup.style.margin='0';
 popup.style.width='min('+options.width+'px, calc(100vw - '+gap*2+'px))';
 trigger.setAttribute('aria-controls',popup.id);trigger.setAttribute('aria-expanded','false');
 // Native auto popovers own Escape, light-dismiss and focus restoration. The
 // invoker is focused before even a programmatic opening captures return focus.
 popup.addEventListener('beforetoggle',event=>{if((event as ToggleEvent).newState==='open')trigger.focus({preventScroll:true});});
 const observer=view.ResizeObserver?new view.ResizeObserver(place):null;
 popup.addEventListener('toggle',()=>{
  trigger.setAttribute('aria-expanded',String(opened()));
  if(opened()){place();view.addEventListener('resize',place);view.addEventListener('scroll',place,true);observer?.observe(popup);observer?.observe(trigger);}
  else{view.removeEventListener('resize',place);view.removeEventListener('scroll',place,true);observer?.disconnect();}
 });
 const open=()=>{if(trigger.disabled||!trigger.isConnected)return false;if(!opened())(popup.showPopover as (options:{source:HTMLElement})=>void).call(popup,{source:trigger});trigger.setAttribute('aria-expanded','true');return true;};
 return{open,close,toggle:()=>{if(opened()){close();return false;}return open();}};
}
