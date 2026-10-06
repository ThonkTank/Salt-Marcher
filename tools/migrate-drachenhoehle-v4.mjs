#!/usr/bin/env node
// Offline, read-only source migration. Writes only below --out.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const vault = option('--vault');
const out = option('--out');
if (!vault || !out || path.resolve(out).startsWith(path.resolve(vault) + path.sep))
  throw Error('Benutzung: --vault <Vault> --out <Ablage außerhalb des Vaults>');
const root = 'Dungeons/Drachenhöhle';
const mapRel = root + '/Karte.dungeon';
const read = rel => fs.readFileSync(path.join(vault, rel), 'utf8');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const stableId = value => { const h = crypto.createHash('sha256').update(value).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; };
const originalMap = read(mapRel);
const doc = JSON.parse(originalMap);
if (doc.version !== 2 && doc.version !== 3) throw Error('Erwartete V2/V3-Karte fehlt.');
const rooms = doc.entities.filter(e => e.kind === 'building' && e.number && e.note?.path?.startsWith(root + '/Räume/'));
if (rooms.length !== 15 || new Set(rooms.map(r => r.note.path)).size !== 15) throw Error('Rauminventar ist nicht eindeutig.');
const byPath = new Map(rooms.map(r => [r.note.path, r]));
const byId = new Map(rooms.map(r => [r.id, r]));
const files = new Map();
const roomData = new Map();
const issue = [];
function splitRoom(text, room) {
  const fm = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!fm || !new RegExp(`^room_id: ["']?${room.number}["']?$`, 'm').test(fm[0]))
    throw Error('room_id fehlt oder weicht ab: ' + room.note.path);
  const body = text.slice(fm[0].length);
  const headers = [...body.matchAll(/^#{2,6} [^\r\n]+(?:\r?\n|$)/gm)];
  const cuts = [0, ...headers.map(m => m.index), body.length];
  const unique = [...new Set(cuts)].sort((a,b) => a - b);
  const sections = unique.slice(0,-1).map((start,i) => {
    const markdown = body.slice(start, unique[i+1]);
    const heading = markdown.match(/^#{2,6} ([^\r\n]+)/)?.[1];
    return {id:stableId(doc.id + ':' + room.id + ':section:' + i),kind:'markdown',markdown,heading};
  });
  if (sections.map(s => s.markdown).join('') !== body) throw Error('Abschnittstrennung verändert Text.');
  return {frontmatter:fm[0],body,sections};
}
function normalizeAnchor(anchor) {
  return String(anchor ?? '').replace(/^\^/, '');
}
const headingOf = section => section.heading ?? section.markdown.match(/^#{2,6} ([^\r\n]+)/)?.[1];
const hasBlock = (section, id) => new RegExp('(?:^|\\s)\\^' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'm')
  .test(section.markdown);
function sectionFor(data, anchor) {
  if (!anchor) return data.sections[0];
  const a = normalizeAnchor(anchor);
  let match = data.sections.find(s => headingOf(s) === a || hasBlock(s,a));
  if (match) return match;
  const legacy = a.match(/^(\d+)\s*·\s*(.+)$/);
  if (legacy && +legacy[1] >= 1 && +legacy[1] <= 26) {
    const letter = String.fromCharCode(64 + +legacy[1]);
    match = data.sections.find(s => headingOf(s) === letter + ' · ' + legacy[2]);
    if (match) return match;
  }
  const base = a.replace(/\/exemplar-\d+$/, '');
  return data.sections.find(s => hasBlock(s,base));
}
for (const room of rooms) {
  const text = read(room.note.path);
  files.set(room.note.path, text);
  roomData.set(room.id, splitRoom(text, room));
}
function roomPath(raw) {
  const p = raw.endsWith('.md') ? raw : raw + '.md';
  return byPath.has(p) ? p : undefined;
}
function target(raw) {
  const [base, ...anchorParts] = raw.split('#');
  const p = roomPath(base);
  if (!p) return undefined;
  const room = byPath.get(p), data = roomData.get(room.id), anchor = anchorParts.join('#');
  const section = sectionFor(data, anchor);
  if (anchor && !section) throw Error('Raum-Link ohne Ziel: ' + raw);
  const query = new URLSearchParams({map:doc.id,room:room.id});
  if (section) query.set('section',section.id);
  if (anchor) query.set('anchor',anchor.startsWith('^') ? anchor : anchor);
  return {url:'obsidian://dungeon-room?' + query,room,section,anchor};
}
const linkStats = {total:0,roomOnly:0,heading:0,block:0,unaliased:0};
function rewriteLinks(text, rel, count = true) {
  return text.replace(/(!?)\[\[([^\]]+)\]\]/g, (token, embed, inner) => {
    const pipe = inner.indexOf('|');
    const raw = (pipe < 0 ? inner : inner.slice(0, pipe)).replace(/\\$/, '');
    const t = target(raw);
    if (!t) return token;
    if (embed) throw Error('Raumdatei als Embed: ' + rel + ': ' + token);
    const label = pipe < 0 ? path.basename(raw.split('#')[0], '.md') : inner.slice(pipe + 1);
    if (!label || /[\[\]]/.test(label)) throw Error('Nicht konvertierbarer Linktext: ' + token);
    if (count) {
      linkStats.total++;
      if (pipe < 0) linkStats.unaliased++;
      if (!t.anchor) linkStats.roomOnly++;
      else if (t.anchor.startsWith('^')) linkStats.block++;
      else linkStats.heading++;
    }
    return `[${label}](${t.url})`;
  });
}
const textIds = new Map();
for (const old of doc.content.occurrences) {
  const data = roomData.get(old.roomId), room = byId.get(old.roomId);
  if (!data || !room || old.note?.path !== room.note.path) throw Error('Feature ohne eindeutigen Raum: ' + old.id);
  const section = sectionFor(data, old.note.anchor);
  if (!section) throw Error('Feature-Anker fehlt: ' + old.id + ' / ' + old.note.anchor);
  const key = old.roomId + ':' + section.id;
  const textId = textIds.get(key) ?? stableId(doc.id + ':feature-text:' + key);
  textIds.set(key,textId);
  delete old.note;
  old.sectionId = section.id;
  old.textId = textId;
}
for (const room of rooms) {
  const data = roomData.get(room.id), oldPath = room.note.path;
  for (const section of data.sections) {
    const textId = textIds.get(room.id + ':' + section.id);
    let markdown = rewriteLinks(section.markdown, oldPath);
    if (textId) {
      const head = markdown.match(/^#{2,6} [^\r\n]+\r?\n/);
      const prefix = head?.[0] ?? '';
      const body = markdown.slice(prefix.length);
      markdown = prefix + `<!-- dungeon-feature:${textId}:start -->\n` + body +
        `\n<!-- dungeon-feature:${textId}:end -->`;
    }
    section.markdown = markdown;
    delete section.heading;
  }
  const reconstructed = data.sections.map(section => section.markdown
    .replace(/^<!-- dungeon-feature:[^\r\n]+:start -->\r?\n/gm, '')
    .replace(/^\r?\n<!-- dungeon-feature:[^\r\n]+:end -->/gm, '')).join('');
  const expectedBody = rewriteLinks(data.body, oldPath, false);
  if (reconstructed !== expectedBody) {
    const at = [...reconstructed].findIndex((char,i) => char !== expectedBody[i]);
    throw Error('Sichtbarer Raumwortlaut verändert: ' + oldPath + ' bei ' + at +
      '\nIst: ' + JSON.stringify(reconstructed.slice(at - 45, at + 100)) +
      '\nSoll: ' + JSON.stringify(expectedBody.slice(at - 45, at + 100)));
  }
  const creatureMarkers = new Set(doc.content.occurrences.filter(o => o.roomId === room.id &&
    doc.content.definitions.find(d => d.id === o.definitionId)?.kind === 'creature').map(o => o.marker));
  const ordinals = doc.content.occurrences.filter(o => o.roomId === room.id &&
    !creatureMarkers.has(o.marker) && /^[A-Z]$/.test(o.marker)).map(o => o.marker.charCodeAt(0) - 64);
  delete room.note;
  room.key = {sourcePath:oldPath,sections:data.sections,nextFeatureOrdinal:Math.max(1,...ordinals.map(n => n + 1))};
}
for (const entity of doc.entities) {
  if (!entity.note || !byPath.has(entity.note.path)) continue;
  const room = byPath.get(entity.note.path),data = roomData.get(room.id);
  const linked = doc.content.occurrences.find(o => o.entityId === entity.id);
  const anchor = entity.note.anchor;
  const section = linked ? data.sections.find(s => s.id === linked.sectionId) : sectionFor(data,anchor);
  if (!section) throw Error('Objekt-Key-Ziel fehlt: ' + entity.id + ' / ' + anchor);
  entity.keyTarget = {roomId:room.id,sectionId:section.id};
  if (!linked && anchor) {
    let adjusted = anchor;
    if (/\/exemplar-\d+$/.test(adjusted)) adjusted = adjusted.replace(/\/exemplar-\d+$/, '');
    if (/^\d+\s*·/.test(adjusted)) adjusted = headingOf(section) ?? adjusted;
    entity.keyTarget.anchor = adjusted;
  }
  delete entity.note;
}
function rewriteMapStrings(value, location) {
  if (typeof value === 'string') return rewriteLinks(value, mapRel + ':' + location);
  if (Array.isArray(value)) return value.map((item, index) => rewriteMapStrings(item, location + '[' + index + ']'));
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value))
      value[key] = rewriteMapStrings(item, location + '.' + key);
  }
  return value;
}
rewriteMapStrings(doc, 'doc');
doc.version = 4;
const staged = new Map([[mapRel,JSON.stringify(doc,null,2) + '\n']]);
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(vault,dir),{withFileTypes:true})) {
    const rel = path.posix.join(dir,entry.name);
    if (entry.isDirectory()) walk(rel);
    else if (rel.endsWith('.md') && !byPath.has(rel)) {
      const before = read(rel), after = rewriteLinks(before,rel);
      if (after !== before) { files.set(rel,before); staged.set(rel,after); }
    }
  }
}
walk('Dungeons');
for (const [rel,value] of staged) {
  const destination = path.join(out,rel);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.writeFileSync(destination,value);
}
files.set(mapRel,originalMap);
const inventory = {map:mapRel,mapId:doc.id,sourceVersion:JSON.parse(originalMap).version,targetVersion:4,
  rooms:rooms.map(r => ({id:r.id,number:r.number,name:r.name,path:r.key.sourcePath,
    sourceHash:hash(files.get(r.key.sourcePath)),sections:r.key.sections.length,
    occurrences:doc.content.occurrences.filter(o => o.roomId === r.id).length})),
  entities:doc.entities.length,occurrences:doc.content.occurrences.length,routes:doc.content.routes.length,
  genericTargets:doc.entities.filter(e => e.keyTarget && !doc.content.occurrences.some(o => o.entityId === e.id)).length,
  sharedTexts:[...textIds].filter(([key]) => doc.content.occurrences.filter(o => o.roomId + ':' + o.sectionId === key).length > 1).length,
  links:linkStats,sourceFiles:[...files].map(([rel,value]) => ({path:rel,sha256:hash(value)})),
  stagedFiles:[...staged].map(([rel,value]) => ({path:rel,sha256:hash(value)})),issues:issue};
fs.writeFileSync(path.join(out,'migration.json'),JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify({rooms:rooms.length,occurrences:inventory.occurrences,routes:inventory.routes,
  genericTargets:inventory.genericTargets,sharedTexts:inventory.sharedTexts,links:linkStats,
  stagedFiles:staged.size,sourceFiles:files.size,issues:issue},null,2));
