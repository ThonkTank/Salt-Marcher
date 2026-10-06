#!/usr/bin/env node
// Conflict-checked Phase-6 transfer. Run only after the isolated host and physical-input gates.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const vault=option('--vault'),stage=option('--stage'),source=option('--source'),backup=option('--backup');
const apply=args.includes('--apply');
if(!vault||!stage||!source||!backup)throw Error('Benutzung: --vault <Vault> --stage <Ablage> --source <Editor-Repo> --backup <neuer Ordner außerhalb des Vaults> [--apply]');
const absolute=[vault,stage,source,backup].map(value=>path.resolve(value));
if(absolute[3].startsWith(absolute[0]+path.sep)||absolute[3]===absolute[0])throw Error('Die Sicherung muss außerhalb des Vaults liegen.');
const [vaultRoot,stageRoot,sourceRoot,backupRoot]=absolute;
const manifest=JSON.parse(fs.readFileSync(path.join(stageRoot,'migration.json'),'utf8'));
const hashFile=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inVault=rel=>path.join(vaultRoot,rel),inStage=rel=>path.join(stageRoot,rel);
for(const item of manifest.sourceFiles)assert.equal(hashFile(inVault(item.path)),item.sha256,'Produktive Quelldatei wurde verändert: '+item.path);
for(const item of manifest.stagedFiles)assert.equal(hashFile(inStage(item.path)),item.sha256,'Migrationsablage wurde verändert: '+item.path);
assert.equal(manifest.rooms.length,15);
assert.equal(manifest.links.total,532);
const plugins=[
 {destination:'.obsidian/plugins/dungeon-editor/main.js',source:path.join(sourceRoot,'main.js')},
 {destination:'.obsidian/plugins/dnd-ot-spielansicht/main.js',source:path.join(sourceRoot,'tools/spielansicht/main.js')},
 {destination:'.obsidian/plugins/dnd-ot-spielansicht/styles.css',source:path.join(sourceRoot,'tools/spielansicht/styles.css')},
 {destination:'.obsidian/plugins/dungeon-auswertung/main.js',source:path.join(stageRoot,'dungeon-auswertung-main.js')},
];
for(const item of plugins){assert(fs.existsSync(inVault(item.destination)),'Installiertes Plugin fehlt: '+item.destination);assert(fs.existsSync(item.source),'Neues Plugin fehlt: '+item.source);}
if(fs.existsSync(backupRoot))throw Error('Sicherungsziel existiert bereits: '+backupRoot);
const sourcePaths=new Set(manifest.sourceFiles.map(item=>item.path));
const overwritePaths=[...new Set([...manifest.stagedFiles.map(item=>item.path),...plugins.map(item=>item.destination)])];
const plan={map:manifest.map,roomFilesToRemove:manifest.rooms.map(item=>item.path),
 sourceFiles:manifest.sourceFiles.length,stagedFiles:manifest.stagedFiles.length,
 pluginFiles:plugins.map(item=>({path:item.destination,sha256:hashFile(item.source)})),
 backup:backupRoot,sourceHashes:manifest.sourceFiles,apply};
if(!apply){console.log(JSON.stringify(plan,null,2));process.exit(0);}
fs.mkdirSync(backupRoot,{recursive:true});
const backupFile=rel=>{const dest=path.join(backupRoot,'vault',rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(inVault(rel),dest);};
for(const rel of new Set([...sourcePaths,...plugins.map(item=>item.destination)]))backupFile(rel);
for(const optional of ['.obsidian/workspace.json','.obsidian/community-plugins.json',
 '.obsidian/plugins/dnd-ot-spielansicht/data.json','.obsidian/plugins/dungeon-auswertung/data.json'])
 if(fs.existsSync(inVault(optional)))backupFile(optional);
for(const item of manifest.sourceFiles)assert.equal(hashFile(inVault(item.path)),item.sha256,
 'Produktive Quelldatei änderte sich während der Sicherung: '+item.path);
fs.writeFileSync(path.join(backupRoot,'transfer-plan.json'),JSON.stringify(plan,null,2)+'\n');
const written=new Map();let removed=[];
function install(sourceFile,rel){
 const dest=inVault(rel),tmp=dest+'.phase6-tmp';
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.copyFileSync(sourceFile,tmp);
 fs.renameSync(tmp,dest);
 written.set(rel,hashFile(dest));
}
try{
 for(const item of manifest.stagedFiles)install(inStage(item.path),item.path);
 for(const item of plugins)install(item.source,item.destination);
 for(const item of manifest.stagedFiles)assert.equal(hashFile(inVault(item.path)),item.sha256,'Übertragene Datei weicht ab: '+item.path);
 for(const item of plugins)assert.equal(hashFile(inVault(item.destination)),hashFile(item.source),'Plugin weicht ab: '+item.destination);
 const doc=JSON.parse(fs.readFileSync(inVault(manifest.map),'utf8'));
 assert.equal(doc.version,4);assert.equal(doc.id,manifest.mapId);
 assert.equal(doc.entities.filter(entity=>entity.key?.sourcePath).length,15);
 assert.equal(doc.content.occurrences.length,80);assert.equal(doc.content.routes.length,22);
 for(const item of manifest.rooms){fs.unlinkSync(inVault(item.path));removed.push(item.path);}
 assert(manifest.rooms.every(item=>!fs.existsSync(inVault(item.path))));
 fs.writeFileSync(path.join(backupRoot,'transfer-result.json'),JSON.stringify({passed:true,
  installed:overwritePaths,removed,backup:backupRoot},null,2)+'\n');
 console.log(JSON.stringify({passed:true,installed:overwritePaths.length,removed:removed.length,backup:backupRoot}));
}catch(error){
 let conflict=false;
 for(const [rel,sha256] of written)if(fs.existsSync(inVault(rel))&&hashFile(inVault(rel))!==sha256)conflict=true;
 if(!conflict){
  for(const rel of new Set([...sourcePaths,...plugins.map(item=>item.destination)])){
   const copy=path.join(backupRoot,'vault',rel);
   if(fs.existsSync(copy)){fs.mkdirSync(path.dirname(inVault(rel)),{recursive:true});fs.copyFileSync(copy,inVault(rel));}
  }
 }
 fs.writeFileSync(path.join(backupRoot,'transfer-result.json'),JSON.stringify({passed:false,
  restored:!conflict,error:String(error),backup:backupRoot},null,2)+'\n');
 throw Error('Übertragung fehlgeschlagen; '+(conflict?'fremde Zwischenänderung, Sicherung manuell prüfen':'Sicherung zurückgespielt')+': '+error);
}
