const {app,BrowserWindow,session}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
// R0 has no access to CampaignWorkbench and needs no preload capabilities.
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'saltmarcher-relief-r0-')));
app.whenReady().then(async()=>{
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  const win=new BrowserWindow({width:1440,height:1000,title:'SaltMarcher · Reliefstudie',backgroundColor:'#a5bec4',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.removeMenu();await win.loadFile(path.join(__dirname,'index.html'));
});
app.on('window-all-closed',()=>app.quit());
