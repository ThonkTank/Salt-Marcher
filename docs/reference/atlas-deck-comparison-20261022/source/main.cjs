const {app,BrowserWindow}=require('electron');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {PNG}=require(process.env.SALTMARCHER_ROOT+'/node_modules/pngjs');
const root=__dirname,dist=path.resolve(root,'../node_modules/@loaders.gl/terrain/dist');
app.setPath('userData',process.env.PROBE_PROFILE);
let server;
const extent=45000000;
function height(x,y){const mainland=Math.max(0,1-Math.hypot(x/14000000,y/7000000));return mainland>0?80+mainland*300+Math.max(0,Math.sin(x/700000)*Math.cos(y/900000))*mainland*1800:0;}
const cache=new Map();
function tile(kind,z,x,y){
 const key=[kind,z,x,y].join('/');if(cache.has(key))return cache.get(key);
 const png=new PNG({width:256,height:256}),step=1/2**z;
 for(let row=0;row<256;row++)for(let col=0;col<256;col++){
  const xx=(x*256+col+.5)*step,yy=(y*256+row+.5)*step,h=height(xx,yy),i=(row*256+col)*4;
  let rgb;if(kind==='dem'){const encoded=Math.round((h+10000)*10);rgb=[encoded>>16&255,encoded>>8&255,encoded&255];}
  else rgb=h===0?[116,168,178]:h>900?[177,163,132]:h>250?[164,176,127]:[195,194,145];
  png.data.set([...rgb,255],i);
 }
 const data=PNG.sync.write(png);cache.set(key,data);if(cache.size>160)cache.delete(cache.keys().next().value);return data;
}
(async()=>{
 await app.whenReady();
 server=http.createServer(async(req,res)=>{
  try{
   const pathname=new URL(req.url,'http://localhost').pathname;let data,type='text/javascript';
   const match=pathname.match(/^\/(dem|color)\/(-?\d+)\/(-?\d+)\/(-?\d+)\.png$/);
   if(match){data=tile(match[1],...match.slice(2).map(Number));type='image/png';}
   else if(pathname==='/font.ttf'){data=await fs.readFile('/usr/share/fonts/google-noto/NotoSerif-Regular.ttf');type='font/ttf';}
   else if(pathname==='/terrain-worker.js')data=await fs.readFile(path.join(dist,'terrain-worker.js'));
   else if(['/','/index.html','/probe.mjs','/bundle.mjs','/style.css'].includes(pathname)){
    const file=pathname==='/'?'index.html':pathname.slice(1);data=await fs.readFile(path.join(root,file));type=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':type;
   }else{res.writeHead(404);res.end();return;}
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);
  }catch(e){res.writeHead(500);res.end(e.message);}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const win=new BrowserWindow({width:1440,height:900,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,webSecurity:true}});
 win.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith(origin+'/')&&!details.url.startsWith('blob:'+origin)&&!details.url.startsWith('data:')}));
 await win.loadURL(origin+'/');
})();
app.on('window-all-closed',()=>{server?.close();app.quit();});
