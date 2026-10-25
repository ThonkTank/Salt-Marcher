import {closeSync,fsyncSync,lstatSync,mkdirSync,openSync,readdirSync,readFileSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {GraphPreviewLifecycle,GraphPreviewTarget} from '../graph-contracts';
import {GraphShadow,graphBasis} from './graph';
import {requirePreviewTarget} from './graph-preview-commands';

interface ActivePreview {version:1;profileId:string;campaignId:string;previewId:string;scopeId:string;basis:string}
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=1000;
// A dangling symlink is a damaged entry, never an absent preview owner.
function exists(filename:string){try{lstatSync(filename);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}
const syncDirectory=(directory:string)=>{const fd=openSync(directory,'r');try{fsyncSync(fd);}finally{closeSync(fd);}};
function read(filename:string):any {
 if(!lstatSync(filename).isFile()||lstatSync(filename).isSymbolicLink()||lstatSync(filename).size>4096)throw Error('Vorschauverwaltung ist keine eigene Datei.');
 return JSON.parse(readFileSync(filename,'utf8'));
}
function write(filename:string,value:unknown){
 const candidate=filename+'.candidate';
 try{const fd=openSync(candidate,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value));fsyncSync(fd);}finally{closeSync(fd);}renameSync(candidate,filename);syncDirectory(dirname(filename));}
 catch(error){throw Error('Vorschauverwaltung konnte nicht sicher gespeichert werden: '+String(error));}
}
export const graphLifecycleKey=(campaignId:string,previewId:string)=>'graph-preview-lifecycle:'+campaignId+':'+previewId;
export function checkedGraphLifecycle(value:unknown):GraphPreviewLifecycle&{profileId?:string}{
 const v=value as GraphPreviewLifecycle&{profileId?:string};
 if(!v||v.version!==1||!text(v.campaignId)||!id(v.previewId)||!text(v.scopeId)||!Number.isSafeInteger(v.revision)||v.revision<0||!['accepted','restored'].includes(v.status)||!text(v.commandId)||!/^[a-f0-9]{64}$/.test(v.fingerprint)||v.profileId!==undefined&&!id(v.profileId))throw Error('Vorschauabschlussbeleg ist beschädigt.');
 return v;
}

/** Paths are derived only from this Store's own filename and a checked ID.
 * The profile identity lives outside Main backups. A copied marker is never
 * authority to open or delete another profile's preview. */
export class GraphPreviewFiles {
 readonly root:string;
 constructor(filename:string){this.root=resolve(filename)+'.graph-previews';}
 private get activeFile(){return join(this.root,'active.json');}
 private profile(create=false):string|null {
  const fresh=!exists(this.root);
  if(fresh){if(!create)return null;mkdirSync(this.root,{mode:0o700});syncDirectory(dirname(this.root));}
  if(!lstatSync(this.root).isDirectory()||lstatSync(this.root).isSymbolicLink())throw Error('Vorschauprofil ist kein eigenes Verzeichnis.');
  const filename=join(this.root,'profile.json');
  if(!exists(filename)){if(!create||!fresh)throw Error('Vorschauprofilkennung fehlt.');write(filename,{version:1,id:randomUUID()});}
  const value=read(filename);if(value.version!==1||!id(value.id))throw Error('Vorschauprofilkennung ist beschädigt.');return value.id;
 }
 private active():ActivePreview|null {
  const profileId=this.profile();if(!profileId)return null;
  if(exists(this.activeFile+'.candidate'))throw Error('Vorschauanlage wurde unterbrochen. Gesicherten Bestand prüfen.');
  if(!exists(this.activeFile)){
   // A retired profile contains only its identity. Never choose or replace an
   // unassigned remainder: it may hold the user's still-open local work.
   if(readdirSync(this.root).some(name=>name!=='profile.json'))throw Error('Gesicherter Vorschaubestand ohne Zuordnung. Bestand zuerst prüfen.');
   return null;
  }
  const v=read(this.activeFile) as ActivePreview;
  if(v.version!==1||v.profileId!==profileId||!text(v.campaignId)||!id(v.previewId)||!text(v.scopeId)||!/^[a-f0-9]{64}$/.test(v.basis))throw Error('Gesicherte Vorschauzuordnung ist beschädigt oder profilfremd.');
  return v;
 }
 private directory(value:ActivePreview){
  const directory=join(this.root,value.previewId);
  if(exists(directory)&&(!lstatSync(directory).isDirectory()||lstatSync(directory).isSymbolicLink()))throw Error('Vorschauverzeichnis ist nicht profilgebunden.');
  return directory;
 }
 profileId(){return this.profile();}
 create(db:any,campaignId:string,scopeId:string,target:GraphPreviewTarget):GraphShadow {
  requirePreviewTarget(target);if(this.active())throw Error('Die gesicherte Graphvorschau zuerst abschließen.');
  const value:ActivePreview={version:1,profileId:this.profile(true)!,campaignId,scopeId,previewId:target.previewId,basis:graphBasis(db,campaignId,scopeId)};
  const dir=this.directory(value);if(exists(dir))throw Error('Vorschaukennung besitzt bereits einen gespeicherten Bestand.');
  // Persist authority before creating the DB. An interrupted initialization is
  // visibly incomplete; it can never be replaced by an empty new preview.
  write(this.activeFile,value);
  let shadow:GraphShadow|undefined;
  try{shadow=new GraphShadow(db,campaignId,scopeId,target,{dir,basis:value.basis,reopen:false});syncDirectory(dir);syncDirectory(this.root);return shadow;}
  catch(error){shadow?.close();rmSync(dir,{recursive:true,force:true});rmSync(this.activeFile);syncDirectory(this.root);throw error;}
 }
 reopen(db:any):GraphShadow|null {
  const value=this.active();if(!value)return null;
  // A completed Main erasure owns file cleanup even after its receipts are gone.
  if(db.prepare("SELECT 1 FROM campaign_erasure WHERE id=? AND phase='cleanup'").get(value.campaignId))return null;
  const row=db.prepare('SELECT value FROM settings WHERE key=?').get(graphLifecycleKey(value.campaignId,value.previewId));
  if(row){const retired=checkedGraphLifecycle(JSON.parse(row.value));
   if(retired.profileId!==value.profileId||retired.previewId!==value.previewId||retired.campaignId!==value.campaignId||retired.scopeId!==value.scopeId)throw Error('Vorschauabschluss gehört zu einem anderen Profil.');
   this.confirmAcceptance(db,retired);this.remove(value);return null;
  }
  if(!db.prepare('SELECT 1 FROM campaign WHERE id=?').get(value.campaignId))throw Error('Gesicherte Vorschau gehört zu einer fehlenden Kampagne.');
  return new GraphShadow(db,value.campaignId,value.scopeId,{kind:'graph-preview',previewId:value.previewId,scopeId:value.scopeId,revision:0},{dir:this.directory(value),basis:value.basis,reopen:true});
 }
 retire(db:any,shadow:GraphShadow){
  const value=this.active();if(!value||value.previewId!==shadow.state().id||value.campaignId!==shadow.campaignId)throw Error('Vorschauabschluss verliert seine ursprüngliche Zuordnung.');
  const row=db.prepare('SELECT value FROM settings WHERE key=?').get(graphLifecycleKey(value.campaignId,value.previewId));
  const receipt=row&&checkedGraphLifecycle(JSON.parse(row.value));
  if(!receipt||receipt.profileId!==value.profileId||receipt.scopeId!==value.scopeId||receipt.previewId!==value.previewId||receipt.campaignId!==value.campaignId)throw Error('Vorschauabschluss ist nicht bestätigt.');
  this.confirmAcceptance(db,receipt);shadow.close();this.remove(value);
 }
 private confirmAcceptance(db:any,receipt:GraphPreviewLifecycle){
  if(receipt.status==='accepted'&&!db.prepare('SELECT 1 FROM atlas_receipt WHERE command_id=? AND campaign_id=?').get(receipt.commandId,receipt.campaignId))throw Error('Kanonischer Übernahmebeleg fehlt; Vorschau bleibt erhalten.');
 }
 erase(campaignId:string){const value=this.active();if(value?.campaignId===campaignId)this.remove(value);}
 private remove(value:ActivePreview){
  rmSync(this.directory(value),{recursive:true,force:true});syncDirectory(this.root);
  rmSync(this.activeFile,{force:true});syncDirectory(this.root);
 }
}
