import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { AtlasRepository } from '../../../src/features/atlas/atlas-repository';
import { AtlasCampaignManifestSave } from '../../../src/features/atlas/atlas-campaign-save';
import { spatialChange } from '../../../src/features/atlas/spatial-schema';
import { locationDocumentChange } from '../../../src/features/location/location-source';
import { newLocationPath } from '../../../src/features/atlas/location-owners';
const root = resolve('tests/fixtures/atlas-e2e-spatial-v2') + '/';
const fixture = JSON.parse(readFileSync(root+'manifest.json','utf8'));
const digest = (s:string) => 'sha256:'+createHash('sha256').update(s).digest('hex');
const worldPath = fixture.input.find((x:any)=>x.path.endsWith('.overworld')).path;
const campaignPath = fixture.campaign.path;
const results:any[]=[];
async function run(mode:string) {
 const files = new Map<string,string>(fixture.input.map((f:any)=>[f.path,readFileSync(root+f.fixtureFile,'utf8')]));
 files.set(campaignPath,readFileSync(root+fixture.campaign.input.fixtureFile,'utf8'));
 const writes:string[]=[];
 const store = {read:async(p:string)=>files.get(p)??null,compareAndWrite:async(p:string,b:string|null,a:string|null)=>{assert.equal(files.get(p)??null,b);writes.push(p);if(a===null)files.delete(p);else files.set(p,a);}};
 const repo = new AtlasRepository(store,worldPath,store,{locations:true,details:true,campaignSave:new AtlasCampaignManifestSave(campaignPath,files.get(campaignPath)!,digest),resolveLocation:async(id:string)=>[...files].find(([p,b])=>p.endsWith('.location')&&JSON.parse(b).id===id)?.[0]??newLocationPath(id),resolveDetail:async(_w:string,k:string,id:string)=>[...files].filter(([p,b])=>p.endsWith('.'+k)&&JSON.parse(b).id===id).map(([p])=>p)});
 const source=await repo.open();
 const initial = new Map(files);
 const before = source.spatialState();
 const dungeon=before.detailPlacements.find((x:any)=>x.kind==='dungeon')!;
 const locationId=source.placements()[1]!.locationId;
 await repo.ensureLocation(locationId);
 const location=repo.location(locationId).read()!;
 if(mode!=='no-op'){
   const changes=[];
   if(mode!=='link-only'){
    const replacement={...dungeon,id:mode==='new-placement-identity'?'00000000-0000-4000-8000-000000009001':dungeon.id,parent:{kind:'location' as const,locationId},anchor:{...dungeon.anchor,parentPointMeters:{x:0,y:0}}};
    changes.push(spatialChange(source.world.id,before,{version:2,detailPlacements:before.detailPlacements.map((p)=>p.id===dungeon.id?replacement:p)}));
   }
   if(mode!=='new-placement-identity')changes.push(locationDocumentChange(location.id,location,{...location,detailMaps:[...location.detailMaps,{kind:'dungeon' as const,documentId:dungeon.documentId}]}));
   assert.equal(source.history.execute({label:'Diagnose: Dungeon an bestehenden Ort binden',changes}),true);
   const changedWorld=JSON.stringify(source.spatialState()),changedLocation=JSON.stringify(repo.location(locationId).read());
   assert.equal(source.history.undo(),true);assert.deepEqual(source.spatialState(),before);assert.deepEqual(repo.location(locationId).read(),location);
   assert.equal(source.history.redo(),true);assert.equal(JSON.stringify(source.spatialState()),changedWorld);assert.equal(JSON.stringify(repo.location(locationId).read()),changedLocation);
   await repo.persistDraft();
 }
 const beforeSave=new Map(files),writesBefore=writes.length;
 let error:string|null=null;
 try{await repo.save();}catch(e){error=e instanceof Error?e.message:String(e);}
 const nativeKeys=[...initial.keys()];
 const nativeChanged=nativeKeys.filter(p=>files.get(p)!==initial.get(p));
 if(error){assert.deepEqual(files,beforeSave);assert.equal(writes.length,writesBefore);assert.equal(repo.dirty,true);assert.equal(files.has(worldPath+'.journal'),false);}
 const manifest=JSON.parse(files.get(campaignPath)!);
 const dungeonPath=fixture.input.find((x:any)=>x.path.endsWith('.dungeon')).path;
 assert.equal(files.get(dungeonPath),initial.get(dungeonPath));
 const differences:any[]=[];
 if(!error){
  const fresh=new AtlasRepository(store,worldPath,store,{locations:true,details:true,campaignSave:new AtlasCampaignManifestSave(campaignPath,files.get(campaignPath)!,digest),resolveLocation:async(id:string)=>[...files].find(([p,b])=>p.endsWith('.location')&&JSON.parse(b).id===id)?.[0]??newLocationPath(id),resolveDetail:async(_w:string,k:string,id:string)=>[...files].filter(([p,b])=>p.endsWith('.'+k)&&JSON.parse(b).id===id).map(([p])=>p)});
  await fresh.open();
  const capture=await fresh.captureNative({worldId:source.world.id});
  for(const rid of [locationId,dungeon.id]){
   const native=capture.records.find(x=>x.id===rid)!;
   const registry=manifest.registry.owners.flatMap((o:any)=>o.records).find((x:any)=>x.id===rid);
   const expected=[...new Set(native.references.map(x=>x.id))].sort();
   const actual=[...new Set(registry.references.map((x:any)=>x.id))].sort();
   if(JSON.stringify(expected)!==JSON.stringify(actual))differences.push({recordId:rid,kind:native.kind,expectedFromSavedNativeBytes:expected,actualCampaignRegistry:actual,missing:expected.filter(x=>!actual.includes(x)),stale:actual.filter(x=>!expected.includes(x))});
  }
  assert.equal(differences.length,mode==='no-op'?0:mode==='link-only'?1:2);
 }

 const owner=manifest.registry.owners.find((o:any)=>o.ownerId==='atlas');
 const place=owner.records.find((x:any)=>x.id===dungeon.id);
 const loc=owner.records.find((x:any)=>x.id===locationId);
 results.push({mode,dungeonBytesUnchanged:true,savedNativeVsRegistryDifferences:differences,historyUndoRedoExact:mode!=='no-op',error,saveWrites:writes.slice(writesBefore),nativeChanged,draftRetainedOnError:!!error&&files.has(worldPath+'.draft'),placementReferences:place?.references,locationReferences:loc?.references});
}
async function main(){if(!process.argv[2])throw new Error('Pass an output JSON path outside the repository and user vault.');for(const mode of ['no-op','link-only','reparent-and-link','new-placement-identity'])await run(mode);writeFileSync(process.argv[2]!,JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),fixtureVersion:'e2e01-spatial-v2',results},null,2)+'\n');console.log(JSON.stringify(results.map(({mode,error,savedNativeVsRegistryDifferences,dungeonBytesUnchanged,historyUndoRedoExact,saveWrites}:any)=>({mode,error,savedNativeVsRegistryDifferences,dungeonBytesUnchanged,historyUndoRedoExact,saveWriteCount:saveWrites.length}))));}
main().catch(e=>{console.error(e);process.exitCode=1});
