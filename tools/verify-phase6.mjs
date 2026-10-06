#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const vault=option('--vault'),stage=option('--stage'),reportPlugin=option('--report-plugin'),resultPath=option('--result');
if(!vault||!stage||!reportPlugin)throw Error('Benutzung: --vault <Vault> --stage <Ablage> --report-plugin <Quellordner> [--result <JSON>]');
const read=(root,rel)=>fs.readFileSync(path.join(root,rel),'utf8');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const manifest=JSON.parse(read(stage,'migration.json'));
for(const item of manifest.sourceFiles)assert.equal(digest(read(vault,item.path)),item.sha256,'Quelldatei geändert: '+item.path);
for(const item of manifest.stagedFiles)assert.equal(digest(read(stage,item.path)),item.sha256,'Ablage geändert: '+item.path);
const old=JSON.parse(read(vault,manifest.map)),map=JSON.parse(read(stage,manifest.map));
assert.equal(old.id,map.id);assert.equal(map.version,4);
assert.equal(map.entities.length,old.entities.length);
assert.deepEqual(map.floors,old.floors);
assert.deepEqual(map.settings,old.settings);
const omit=(object,...keys)=>Object.fromEntries(Object.entries(object).filter(([key])=>!keys.includes(key)));
const rooms=map.entities.filter(entity=>entity.key?.sourcePath),byId=new Map(rooms.map(room=>[room.id,room]));
assert.equal(rooms.length,15);
const strip=markdown=>markdown.replace(/^<!-- dungeon-feature:[^\r\n]+:start -->\r?\n/gm,'').replace(/^\r?\n<!-- dungeon-feature:[^\r\n]+:end -->/gm,'');
const visible=markdown=>markdown.replace(/\[([^\[\]\n]+)\]\(obsidian:\/\/dungeon-room\?[^)]+\)/g,'$1').replace(/(!?)\[\[([^\]]+)\]\]/g,(full,embed,inner)=>{
 if(embed)return full;const pipe=inner.indexOf('|');return pipe<0?path.basename(inner.split('#')[0],'.md'):inner.slice(pipe+1);
});
const visibleValue=value=>typeof value==='string'?visible(value):Array.isArray(value)?value.map(visibleValue):
 value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,visibleValue(item)])):value;
assert.deepEqual(visibleValue(map.content.definitions),visibleValue(old.content.definitions));
assert.deepEqual(visibleValue(map.content.routes),visibleValue(old.content.routes));
for(let i=0;i<old.entities.length;i++)assert.deepEqual(
 visibleValue(omit(map.entities[i],'note','key','keyTarget')),
 visibleValue(omit(old.entities[i],'note','key','keyTarget')),'Geometrie '+old.entities[i].id);
for(let i=0;i<old.content.occurrences.length;i++)assert.deepEqual(
 visibleValue(omit(map.content.occurrences[i],'note','sectionId','textId')),
 visibleValue(omit(old.content.occurrences[i],'note','sectionId','textId')),'Vorkommen '+old.content.occurrences[i].id);
const hasBlock=(markdown,id)=>new RegExp('(?:^|\\s)\\^'+id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*$','m').test(markdown);
let exactRooms=0;
for(const room of rooms){
 const source=read(vault,room.key.sourcePath),fm=source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)?.[0];
 assert(fm,'Frontmatter fehlt: '+room.key.sourcePath);
 const projected=fm+room.key.sections.map(section=>strip(section.markdown)).join('');
 assert.equal(visible(projected),visible(source),'Sichtbarer Wortlaut: '+room.key.sourcePath);
 assert.equal((projected.match(/^# /gm)||[]).length,(source.match(/^# /gm)||[]).length,'Titel: '+room.key.sourcePath);
 assert.deepEqual([...projected.matchAll(/!\[\[[^\]]+\]\]/g)].map(m=>m[0]),[...source.matchAll(/!\[\[[^\]]+\]\]/g)].map(m=>m[0]),'Bilder und Breiten: '+room.key.sourcePath);
 exactRooms++;
}
for(const item of manifest.stagedFiles.filter(item=>item.path.endsWith('.md')))
 assert.equal(visible(read(stage,item.path)),visible(read(vault,item.path)),'Sichtbarer Wortlaut: '+item.path);
function strings(value){if(typeof value==='string')return [value];if(Array.isArray(value))return value.flatMap(strings);
 if(value&&typeof value==='object')return Object.values(value).flatMap(strings);return [];}
assert(!JSON.stringify(map).includes('[[Dungeons/Drachenhöhle/Räume/'),'Alte Raum-Links in Karte');
const linkTexts=[...strings(map),...manifest.stagedFiles.filter(item=>item.path.endsWith('.md')).map(item=>read(stage,item.path))];
let stableLinks=0;
for(const markdown of linkTexts)for(const match of markdown.matchAll(/\[([^\[\]\n]+)\]\((obsidian:\/\/dungeon-room\?[^)\s]+)\)/g)){
 const q=new URL(match[2]).searchParams,room=byId.get(q.get('room'));
 assert.equal(q.get('map'),map.id,'Kartenkennung des Links');assert(room,'Raumziel des Links');
 const section=room.key.sections.find(item=>item.id===q.get('section'));
 assert(section,'Abschnittsziel des Links');
 const anchor=q.get('anchor');
 if(anchor){const value=anchor.replace(/^\^/,'');assert(section.markdown.match(/^#{1,6} ([^\r\n]+)/m)?.[1]===value||hasBlock(section.markdown,value),'Ankerziel: '+anchor);}
 stableLinks++;
}
assert.equal(stableLinks,manifest.links.total,'Zahl stabiler Links');
assert.equal(map.entities.filter(entity=>entity.keyTarget).length,99);
assert.equal(map.content.occurrences.length,80);
assert.equal(map.content.routes.length,22);
const require=createRequire(import.meta.url),core=require(path.join(reportPlugin,'core.js'));
require(path.join(reportPlugin,'format2.js'));
const dungeonRoot='Dungeons/Drachenhöhle',files=[];
function walk(dir){for(const entry of fs.readdirSync(path.join(vault,dir),{withFileTypes:true})){const rel=path.posix.join(dir,entry.name);if(entry.isDirectory())walk(rel);else if(rel.endsWith('.md'))files.push(rel);}}
walk(dungeonRoot);
const reverse=markdown=>markdown.replace(/\[([^\[\]\n]+)\]\((obsidian:\/\/dungeon-room\?[^)\s]+)\)/g,(full,label,url)=>{
 const q=new URL(url).searchParams,room=byId.get(q.get('room'));return room?'[['+room.key.sourcePath.replace(/\.md$/,'')+(q.get('anchor')?'#'+q.get('anchor'):'')+'|'+label+']]':full;
});
const progression=JSON.parse(read(vault,'Dungeons/_System/Progression.json'));
function reportInput(migrated){
 const documents=files.map(rel=>({path:rel,text:migrated&&rel.includes('/Räume/')?null:
   migrated&&fs.existsSync(path.join(stage,rel))?read(stage,rel):read(vault,rel)}));
 if(migrated)for(const doc of documents)if(doc.text===null){const room=rooms.find(item=>item.key.sourcePath===doc.path);doc.text=`---\nroom_id: "${room.number}"\n---\n`+room.key.sections.map(section=>strip(section.markdown)).join('');}
 const overview=documents.find(doc=>doc.path===dungeonRoot+'/Drachenhöhle.md');
 const config=JSON.parse(overview.text.match(/^dungeon: (.+)$/m)[1]);
 if(migrated){config.bosses=config.bosses.map(boss=>({...boss,feature:reverse(boss.feature)}));for(const doc of documents)doc.text=reverse(doc.text);}
 for(const doc of documents)if(doc.path.includes('/Räume/'))doc.room=doc.text.match(/room_id: ["']?(\d+)/)?.[1];
 const paths=new Set(documents.map(doc=>doc.path)),links={};
 for(const doc of documents)for(const match of doc.text.matchAll(/\[\[([^\]]+)\]\]/g)){
  const raw=match[1].split('|')[0].replace(/\\$/,''),name=raw.split('#')[0],target=name.endsWith('.md')?name:name+'.md';
  if(paths.has(target))links[doc.path+'\0'+raw]=target;
 }
 return {config,rooms:manifest.rooms.map(room=>({id:room.number,path:room.path,name:room.number+' '+room.name})),
  entries:[],issues:[],documents,links,progression,overview:overview.path};
}
const baseline=core.analyze2(reportInput(false)),converted=core.analyze2(reportInput(true));
const summary=result=>({rooms:result.model.rooms.length,features:result.model.features.length,
 edges:result.model.edges.length,entries:result.model.entries.length,
 issues:result.model.issues.length,fights:result.all.fights.length,
 bosses:result.model.config.bosses.length,groups:result.groups.length,
 xp:result.base.xp,adjustedXp:result.base.adjusted});
assert.deepEqual(summary(converted),summary(baseline),'Auswertungssummen');
const result={passed:true,exactRooms,stableLinks,sourceFiles:manifest.sourceFiles.length,
 stagedFiles:manifest.stagedFiles.length,geometryEntities:map.entities.length,
 occurrences:map.content.occurrences.length,routes:map.content.routes.length,
 report:summary(converted)};
if(resultPath){fs.mkdirSync(path.dirname(resultPath),{recursive:true});fs.writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result,null,2));
