import {closeSync,fsyncSync,lstatSync,mkdirSync,openSync,readFileSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {checkedAtlasWriteReference,sameAtlasWriteReference,type AtlasWriteReference} from '../src/app/atlas-write-receipt';

const syncDirectory=(directory:string)=>{const fd=openSync(directory,'r');try{fsyncSync(fd);}finally{closeSync(fd);}};
function exists(filename:string){try{lstatSync(filename);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}}
/** Two bounded local slots per campaign. Not part of portable campaign archives.
 * A broken or interrupted file is a blocker, never an empty pending list. */
export class AtlasWriteReferences {
 constructor(private root:string){}
 private directory(create=false){
  if(!exists(this.root)){if(!create)return false;mkdirSync(this.root,{mode:0o700});syncDirectory(dirname(this.root));}
  const stat=lstatSync(this.root);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Atlas-Klärungsspeicher ist kein eigenes Verzeichnis.');return true;
 }
 private filename(campaignId:string,lane:'atlas'|'travel'){
  if(typeof campaignId!=='string'||!campaignId||campaignId.length>1000)throw Error('Kampagnenkennung prüfen.');
  return join(this.root,createHash('sha256').update(campaignId).digest('hex')+'-'+lane+'.json');
 }
 private read(campaignId:string,lane:'atlas'|'travel'):AtlasWriteReference|null {
  if(!this.directory())return null;
  const file=this.filename(campaignId,lane);
  if(exists(file+'.candidate'))throw Error('Atlas-Klärungsreferenz wurde unvollständig gesichert.');
  if(!exists(file))return null;
  const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8192)throw Error('Atlas-Klärungsreferenz ist beschädigt.');
  const ref=checkedAtlasWriteReference(JSON.parse(readFileSync(file,'utf8')));
  if(ref.campaignId!==campaignId||(ref.family==='travel'?'travel':'atlas')!==lane)throw Error('Atlas-Klärungsreferenz gehört zu einer anderen Kampagne oder Familie.');
  return ref;
 }
 list(campaignId:string):AtlasWriteReference[]{return [this.read(campaignId,'atlas'),this.read(campaignId,'travel')].filter((r):r is AtlasWriteReference=>r!==null);}
 keep(value:AtlasWriteReference){
  const ref=checkedAtlasWriteReference(value),lane=ref.family==='travel'?'travel':'atlas';
  if(this.read(ref.campaignId,lane))throw Error('Vorhandenen Atlasauftrag zuerst klären. Kein erneuter Dispatch.');
  const payload=JSON.stringify(ref);if(Buffer.byteLength(payload)>8192)throw Error('Atlas-Klärungsreferenz ist zu groß.');
  this.directory(true);const file=this.filename(ref.campaignId,lane),candidate=file+'.candidate';
  const fd=openSync(candidate,'wx',0o600);
  try{writeFileSync(fd,payload);fsyncSync(fd);}finally{closeSync(fd);}
  renameSync(candidate,file);syncDirectory(this.root);
 }
 matches(value:AtlasWriteReference){const ref=checkedAtlasWriteReference(value),current=this.read(ref.campaignId,ref.family==='travel'?'travel':'atlas');return current!==null&&sameAtlasWriteReference(ref,current);}
 clear(value:AtlasWriteReference){
  const ref=checkedAtlasWriteReference(value),lane=ref.family==='travel'?'travel':'atlas',current=this.read(ref.campaignId,lane);
  if(!current)return;
  if(!sameAtlasWriteReference(ref,current))throw Error('Ein anderer Atlasauftrag bleibt ungeklärt.');
  unlinkSync(this.filename(ref.campaignId,lane));syncDirectory(this.root);
 }
}
