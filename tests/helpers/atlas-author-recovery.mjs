import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import path from 'node:path';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
const file=path.resolve('.build/atlas-author-reference-fixture-'+process.pid+'.cjs');
buildSync({stdin:{contents:"export {CampaignStore} from './src/app/storage/store';export {AtlasWriteReferences} from './desktop/atlas-write-references';export {atlasWriteReference} from './src/app/atlas-write-recovery';export {sameAtlasWriteReference} from './src/app/atlas-write-receipt';",resolveDir:process.cwd()},outfile:file,bundle:true,platform:'node',format:'cjs',external:['better-sqlite3']});
const {CampaignStore,AtlasWriteReferences,atlasWriteReference,sameAtlasWriteReference}=createRequire(import.meta.url)(file);
/** Existing synchronous DOM fixtures use the real disk-reference class and Store
 * receipt reader. This adapter is not evidence for Main/Preload transport; those
 * boundaries run separately through desktopMainHost in the recovery suite. */
export function attachAtlasAuthorRecovery(api,store,directory){
 const refs=new AtlasWriteReferences(path.join(directory,'author-references')),active=new Set();let witness;
 const result=fn=>{try{return{ok:true,value:fn()};}catch(e){return{ok:false,error:e.message};}};
 for(const method of ['executeGraph','atlasDrawingCommit','atlasRoomCommit','executeAtlas','executeAtlasCommit']){
  const write=api[method];if(!write)continue;
  api[method]=async c=>{
   if(c.action?.kind==='select')return write(c);
   active.add(c.commandId);witness=undefined;
   try{const response=await write(c);if(method==='executeGraph'&&!response.ok&&response.errorKind!=='store-outcome-unknown')witness=await atlasWriteReference({kind:'graph',command:c});return response;}
   finally{active.delete(c.commandId);}
  };
 }
 api.keepAtlasWriteReference=async(ref,token)=>result(()=>{store.authorizeAtlasWriteReference(ref.campaignId,token);refs.keep(ref);witness=undefined;});
 api.atlasWriteReferences=async(campaignId,token)=>result(()=>{store.authorizeAtlasWriteReference(campaignId,token);return refs.list(campaignId);});
 api.atlasWriteStatus=async(ref,token)=>result(()=>store.atlasWriteStatus(ref,token,active.has(ref.commandId)));
 api.clearAtlasWriteReference=async(ref,token)=>result(()=>{const status=store.atlasWriteStatus(ref,token,active.has(ref.commandId));if(status.outcome==='unknown'&&(!witness||!sameAtlasWriteReference(ref,witness)||!refs.matches(ref)||active.has(ref.commandId)))throw Error('Atlasauftrag bleibt ungeklärt.');refs.clear(ref);witness=undefined;});
 return refs;
}

/** Mocked drawing/render actions still exercise mandatory durable reference I/O
 * and an actual authorized Store status reader; their business projection stays
 * the fixture's explicit double. */
export function atlasAuthorReferenceFixture(t){
 const directory=mkdtempSync(path.join(tmpdir(),'atlas-reference-owner-')),store=new CampaignStore(path.join(directory,'campaign.sqlite')),campaign=store.create('Reference owner'),workspace=store.activateShell(campaign.id);
 t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
 return{store,workspace,bind:api=>attachAtlasAuthorRecovery(api,store,directory)};
}
