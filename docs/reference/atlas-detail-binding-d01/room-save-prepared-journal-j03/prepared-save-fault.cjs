// QA-only native Vault boundary. Exact prepared Save journal; no product handler/model writes.
module.exports=({journalPath,draftPath,dungeonPath,campaignPath})=>{
 const probe=window.__roomSavePreparedFault={draftDeleteFailures:0,rollbackFailures:0,events:[]};
 const trash=app.vault.trash,process=app.vault.process;
 const current=async()=>{
  const f=app.vault.getAbstractFileByPath(journalPath);if(!f)return null;
  const j=JSON.parse(await app.vault.read(f));
  return j.state==='prepared'&&j.writes.length===3&&
   [draftPath,dungeonPath,campaignPath].every(p=>j.writes.some(w=>w.path===p))?j:null;
 };
 app.vault.trash=async function(file,...args){
  const j=file.path===draftPath?await current():null;
  if(j){
   probe.draftDeleteFailures++;
   probe.events.push({kind:'controlled_prepared_Room_Save_Draft_delete_failure',path:file.path,state:j.state,transactionId:j.transactionId});
   throw new Error('HEX J03 controlled prepared Room Save Draft delete failure');
  }
  return trash.call(this,file,...args);
 };
 app.vault.process=async function(file,change,...args){
  const j=file.path===dungeonPath&&probe.draftDeleteFailures?await current():null;
  if(j){
   const write=j.writes.find(w=>w.path===dungeonPath),raw=await app.vault.read(file);
   if(raw===write.after&&write.after!==write.before){
    probe.rollbackFailures++;
    probe.events.push({kind:'controlled_prepared_Room_Save_Dungeon_rollback_failure',path:file.path,state:j.state,transactionId:j.transactionId});
    throw new Error('HEX J03 controlled prepared Room Save Dungeon rollback failure');
   }
  }
  return process.call(this,file,change,...args);
 };
};

