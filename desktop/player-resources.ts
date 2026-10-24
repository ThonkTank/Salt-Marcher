import type {Session} from 'electron';
/** The player session exposes only its own static shell and explicitly published art. */
export type PlayerResource = {kind:'static';name:'player-display.html'|'player-display.js'|'player.css'|'atlas-deck-runtime.js'}|{kind:'image';id:string};
export function playerResource(address:string):PlayerResource|null {
 try {
  const url=new URL(address);
  if(url.protocol!=='campaign:'||url.hostname!=='player'||url.port||url.username||url.password||url.search||url.hash)return null;
  const name=url.pathname.slice(1);
  if(name==='player-display.html'||name==='player-display.js'||name==='player.css'||name==='atlas-deck-runtime.js')return{kind:'static',name};
  if(!url.pathname.startsWith('/art/'))return null;
  const id=decodeURIComponent(url.pathname.slice(5));
  return id&&!/[\u0000/\\]/.test(id)&&url.pathname==='/art/'+encodeURIComponent(id)?{kind:'image',id}:null;
 }catch{return null;}
}
export function playerRequestAllowed(address:string,requestWindowId:number|undefined,currentWindowId:number|null) {
 return currentWindowId!==null&&requestWindowId===currentWindowId&&playerResource(address)!==null;
}
interface ResourceOptions {
 current:()=>{windowId:number;imageId:string|null}|null|Promise<{windowId:number;imageId:string|null}|null>;
 uiFile:(name:string)=>string;
 imageFile:(id:string)=>string|Promise<string>;
 fetchFile:(filename:string)=>Promise<Response>;
}
const unavailable=()=>new Response('Not available',{status:404});
export async function servePlayerResource(address:string,options:ResourceOptions):Promise<Response> {
 const resource=playerResource(address);if(!resource)return unavailable();
 try {
  if(resource.kind==='static')return await options.fetchFile(options.uiFile(resource.name));
  const before=await options.current();if(!before||before.imageId!==resource.id)return unavailable();
  const response=await options.fetchFile(await options.imageFile(resource.id)),after=await options.current();
  if(!after||after.windowId!==before.windowId||after.imageId!==resource.id){void response.body?.cancel().catch(()=>{});return unavailable();}
  const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }catch{return unavailable();}
}

export function installPlayerResources(session:Session,options:ResourceOptions&{windowId:()=>number|null}) {
 session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 session.setPermissionCheckHandler(()=>false);
 session.on('will-download',event=>event.preventDefault());
 session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!playerRequestAllowed(details.url,details.webContentsId,options.windowId())}));
 session.protocol.handle('campaign',request=>servePlayerResource(request.url,options));
}
