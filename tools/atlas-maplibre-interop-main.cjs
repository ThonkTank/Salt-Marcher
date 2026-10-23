const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {PNG}=require('pngjs');

const repo=process.env.SALTMARCHER_REPO;
const build=path.join(repo,'.build/atlas-maplibre-interop');
const profile=process.env.ATLAS_INTEROP_PROFILE;
app.setPath('userData',profile);

function makeDemTile(baseHeight){
  const png=new PNG({width:256,height:256});
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const i=(y*256+x)*4;
    // Known planes isolate metric elevation and cross-engine depth from sampling.
    const height=baseHeight;
    const value=Math.round((height+10000)*10);
    png.data[i]=(value>>16)&255;png.data[i+1]=(value>>8)&255;png.data[i+2]=value&255;png.data[i+3]=255;
  }
  return PNG.sync.write(png);
}
const dem=makeDemTile(0), elevatedDem=makeDemTile(450);
function handler(req,res){
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const files={
    '/':path.join(repo,'tools/atlas-maplibre-interop.html'),
    '/atlas-maplibre-interop.css':path.join(repo,'tools/atlas-maplibre-interop.css'),
    '/maplibre-gl.css':path.join(build,'node_modules/maplibre-gl/dist/maplibre-gl.css'),
    '/probe.bundle.mjs':path.join(build,'probe.bundle.mjs'),
    '/projection-handler.mjs':path.join(repo,'tools/atlas-maplibre-interop-projection-handler.mjs'),
    '/maplibre-worker.mjs':path.join(build,'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs')
  };
  if(/^\/(dem|dem-elevated)\/\d+\/\d+\/\d+\.png$/.test(pathname)){
    res.writeHead(200,{'content-type':'image/png','cache-control':'no-store'});res.end(pathname.startsWith('/dem-elevated/')?elevatedDem:dem);return;
  }
  const file=files[pathname];
  if(!file){res.writeHead(404);res.end('not found');return;}
  try{
    const bytes=fs.readFileSync(file);const ext=path.extname(file);
    const type=ext==='.css'?'text/css':ext==='.mjs'||ext==='.js'?'text/javascript':'text/html';
    res.writeHead(200,{'content-type':type,'cache-control':'no-store'});res.end(bytes);
  }catch(error){res.writeHead(500);res.end(String(error));}
}
const server=http.createServer(handler);
// The driver owns evaluation, evidence and process closure. Main only hosts the
// restricted renderer; no duplicated result-file watcher or destroyed-window read.
app.on('window-all-closed',()=>{server.close();app.quit();});
app.whenReady().then(async()=>{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const url=`http://127.0.0.1:${server.address().port}/`;
  const win=new BrowserWindow({width:1152,height:852,useContentSize:true,show:true,
    webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
  await win.loadURL(url);
}).catch(error=>{console.error(error);server.close();app.exit(1);});
