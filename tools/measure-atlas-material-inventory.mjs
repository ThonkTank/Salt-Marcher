#!/usr/bin/env node
// Reproducible, read-only inventory of authored Atlas material records.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frozen = resolve(root, '.build/atlas-rebuild-m0-frames/source.sqlite');
const fixture = resolve(root, 'tests/fixtures/atlas/mixed-world.sqlite.gz');
const fixtureCopy = resolve(root, '.build/atlas-material-inventory/mixed-world.sqlite');
const expected = '19d4edc88b50d8074578a5c40c870a50331fec1c78a7a8b4f4feee5d463fdb12';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fixtureBytes = readFileSync(fixture);
const fixtureHash = sha(gunzipSync(fixtureBytes));
let source = frozen;
if (!existsSync(frozen) || sha(readFileSync(frozen)) !== expected) {
  if (fixtureHash !== expected) throw new Error('Canonical fixture hash mismatch: ' + fixtureHash);
  mkdirSync(dirname(fixtureCopy), { recursive: true });
  if (existsSync(fixtureCopy)) {
    if (sha(readFileSync(fixtureCopy)) !== expected)
      throw new Error('Existing isolated fixture copy has unexpected bytes: ' + fixtureCopy);
  } else {
    writeFileSync(fixtureCopy, gunzipSync(fixtureBytes), { flag: 'wx' });
  }
  source = fixtureCopy;
}
const sourceHashBeforeRead = sha(readFileSync(source));
if (sourceHashBeforeRead !== expected || fixtureHash !== expected)
  throw new Error('Frozen source or canonical fixture hash mismatch.');

const python = String.raw`
import json, math, sqlite3, sys, collections
p=sys.argv[1]; db=sqlite3.connect('file:'+p+'?mode=ro&immutable=1',uri=True)
db.row_factory=sqlite3.Row
campaigns=[dict(r) for r in db.execute('select id,name from campaign order by id')]
rows=db.execute('select campaign_id,id,payload,min_x,max_x,min_y,max_y from atlas_landscape order by campaign_id,id').fetchall()
settings=[dict(r) for r in db.execute('select key,value from settings order by key')]
classes=collections.Counter(); roles=collections.Counter(); examples=collections.defaultdict(list); kindcounts=collections.Counter(); fields=collections.Counter(); flags=collections.Counter(); heights=collections.Counter(); paints=collections.Counter(); tips=collections.Counter(); pixels=collections.Counter(); ext=[math.inf,math.inf,-math.inf,-math.inf]; malformed_json=[]; malformed_geometry=[]; nonfinite=[]; geom_count=0
def finite(n): return isinstance(n,(int,float)) and math.isfinite(n)
def bucket(r):
    # Keep this precedence aligned with AtlasLandscapeReader.metadata.
    if r.get('height') is not None: return 'height'
    if r.get('route') is not None: return 'route'
    if r.get('paint') is not None: return 'color'
    if r.get('vegetation') is not None: return 'cover'
    if r.get('surface')=='freshwater': return 'lake'
    if r.get('kind')=='patch' and (r.get('values',{}).get('terrain') is not None or r.get('mask') is not None): return 'base'
    return 'unclassified'
def semantic_role(r,source_kind):
    # Every landscape row gets exactly one meaning; property-only is a role,
    # while the independent source kind above still follows canonical precedence.
    if r.get('propertyOnly'): return 'propertyOnlyMetadata'
    if source_kind=='height': return 'heightField'
    if source_kind=='route': return 'routeField'
    if source_kind=='color': return 'colorOverlay'
    if source_kind=='cover': return 'vegetationCover'
    if source_kind=='lake': return 'freshwaterSurface'
    if source_kind=='base': return 'visualBase'
    if r.get('kind') in ('road','river'): return 'lineInfrastructure'
    if r.get('kind')=='place': return 'place'
    return 'other'
for row in rows:
    try: r=json.loads(row['payload'])
    except Exception as e: malformed_json.append({'id':row['id'],'error':str(e)[:120]}); continue
    kindcounts[r.get('kind','<missing>')]+=1; c=bucket(r); classes[c]+=1
    role=semantic_role(r,c); roles[role]+=1
    if len(examples[c])<3: examples[c].append(row['id'])
    for key in ('height','route','paint','mask','maskManaged','terrainSettings','surface','vegetation','line','visible','locked','propertyOnly'):
        if key in r and r[key] is not None and r[key] is not False: fields[key]+=1
    if r.get('mask') is not None: flags['mask']+=1
    if r.get('maskManaged'): flags['maskManaged']+=1
    if r.get('terrainSettings') is not None: flags['terrainSettings']+=1
    if r.get('surface') is not None: flags['surface:'+str(r['surface'])]+=1
    if r.get('line') is not None: flags['line']+=1
    if r.get('kind') in ('road','river'): flags['lineKind:'+r['kind']]+=1
    if r.get('kind')=='place': flags['place']+=1
    if r.get('paint',{}).get('visibility') is not None: flags['paintVisibility']+=1
    for key in ('visible','locked'):
        if key in r: flags[key+':'+str(r[key]).lower()]+=1
    if isinstance(r.get('height'),dict):
        h=r['height']; heights[str(h.get('version','unknown'))]+=1
        if h.get('pixel') is not None: pixels[str(h['pixel'])]+=1
    if isinstance(r.get('paint'),dict):
        pnt=r['paint']; paints[str(pnt.get('version','unknown'))]+=1
        if pnt.get('tip') is not None: tips[str(pnt['tip'])]+=1
    coords=[]
    pts=r.get('points',[])
    if not isinstance(pts,list): malformed_geometry.append({'id':row['id'],'error':'points is not array'}); pts=[]
    for pt in pts:
        if not isinstance(pt,dict) or not finite(pt.get('x')) or not finite(pt.get('y')): nonfinite.append(row['id']); continue
        coords.append((pt['x'],pt['y']))
    polys=r.get('polygons',[])
    if not isinstance(polys,list): malformed_geometry.append({'id':row['id'],'error':'polygons is not array'}); polys=[]
    for poly in polys:
        if not isinstance(poly,dict) or not isinstance(poly.get('outer'),list) or not isinstance(poly.get('holes',[]),list): malformed_geometry.append({'id':row['id'],'error':'invalid polygon'}); continue
        for ring in [poly['outer']]+poly.get('holes',[]):
            if not isinstance(ring,list) or len(ring)<3: malformed_geometry.append({'id':row['id'],'error':'invalid ring'}); continue
            for pt in ring:
                if not isinstance(pt,dict) or not finite(pt.get('x')) or not finite(pt.get('y')):
                    nonfinite.append(row['id']); continue
                coords.append((pt['x'],pt['y']))
    if coords:
        geom_count+=1; xs=[p[0] for p in coords]; ys=[p[1] for p in coords]
        ext=[min(ext[0],min(xs)),min(ext[1],min(ys)),max(ext[2],max(xs)),max(ext[3],max(ys))]
    for col in ('min_x','max_x','min_y','max_y'):
        if not finite(row[col]): nonfinite.append(row['id']); break
    if row['min_x']>row['max_x'] or row['min_y']>row['max_y']: malformed_geometry.append({'id':row['id'],'error':'inverted cached extent'})
unsupported={'heightFieldRecordsUnsupported':classes['height'],'routeFieldRecordsUnsupported':classes['route'],'maskFlagRecordsUnsupported':flags['mask']+flags['maskManaged'],'terrainSettingsRecordsUnsupported':flags['terrainSettings'],'freshwaterRecordsUnsupported':classes['lake'],'colorRecordsSupported':classes['color'],'coverRecordsSupportedOnlyWithAuthoredWorldPolicy':classes['cover'],'nonMaterialLineAndPlaceRoles':sum(roles[k] for k in ('lineInfrastructure','place'))}
for name in ('height','route','color','cover','lake','base','unclassified'): classes.setdefault(name,0)
for name in ('propertyOnlyMetadata','heightField','routeField','colorOverlay','vegetationCover','freshwaterSurface','visualBase','lineInfrastructure','place','other'): roles.setdefault(name,0)
for name in ('mask','maskManaged','terrainSettings','paintVisibility','visible:true','visible:false','locked:true','locked:false','line','place'): flags.setdefault(name,0)
print(json.dumps({'campaigns':campaigns,'totalRecords':len(rows),'sourceKinds':dict(sorted(classes.items())),'semanticRoles':dict(sorted(roles.items())),'recordKinds':dict(sorted(kindcounts.items())),'examples':dict(examples),'fieldCounts':dict(sorted(fields.items())),'flags':dict(sorted(flags.items())),'heightVersions':dict(sorted(heights.items())),'heightPixelSizes':dict(sorted(pixels.items())),'paintVersions':dict(sorted(paints.items())),'paintTips':dict(sorted(tips.items())),'settingsCount':len(settings),'settingKeys':[r['key'] for r in settings],'geometry':{'recordsWithGeometry':geom_count,'extents':None if not math.isfinite(ext[0]) else {'minX':ext[0],'minY':ext[1],'maxX':ext[2],'maxY':ext[3]}},'unsupportedByCurrentSourceAdapter':{k:v for k,v in unsupported.items() if k!='nonMaterialLineAndPlaceRoles'},'supplementalCounts':{'nonMaterialLineAndPlaceRoles':sum(roles[k] for k in ('lineInfrastructure','place')),'landscapeTerrainSettingsFlags':flags['terrainSettings'],'storedSettingsRows':len(settings)},'integrity':{'malformedJsonCount':len(malformed_json),'malformedGeometryCount':len(malformed_geometry),'nonfiniteCoordinateOrExtentCount':len(nonfinite),'examples':{'malformedJson':malformed_json[:5],'malformedGeometry':malformed_geometry[:5],'nonfinite':nonfinite[:5]},'sourceCountSum':sum(classes.values()),'sourceCountEquality':sum(classes.values())==len(rows),'semanticRoleCountSum':sum(roles.values()),'semanticRoleCountEquality':sum(roles.values())==len(rows)},'settingsExamples':[{'key':r['key'],'valueLength':len(r['value'])} for r in settings[:5]]},allow_nan=False))
`;
const run = spawnSync('python3', ['-c', python, source], {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});
if (run.status !== 0) throw new Error(run.stderr || 'python exited ' + run.status);
const sourceHashAfterRead = sha(readFileSync(source));
if (sourceHashAfterRead !== sourceHashBeforeRead || sourceHashAfterRead !== expected)
  throw new Error('Frozen source changed during the read-only inventory run.');
const inventory = JSON.parse(run.stdout);
inventory.generatedAt = new Date().toISOString();
inventory.source = {
  path: source.slice(root.length + 1),
  sha256: sourceHashAfterRead,
  sha256BeforeRead: sourceHashBeforeRead,
  sha256AfterRead: sourceHashAfterRead,
  fixturePath: fixture.slice(root.length + 1),
  fixtureCompressedSha256: sha(fixtureBytes),
  fixtureDatabaseSha256: fixtureHash,
};
inventory.tool = {
  path: 'tools/measure-atlas-material-inventory.mjs',
  sha256: sha(readFileSync(fileURLToPath(import.meta.url))),
};
inventory.integrity.roleCountEquality =
  inventory.integrity.semanticRoleCountEquality &&
  inventory.integrity.semanticRoleCountSum === inventory.totalRecords;
if (
  inventory.integrity.malformedJsonCount ||
  inventory.integrity.malformedGeometryCount ||
  inventory.integrity.nonfiniteCoordinateOrExtentCount ||
  !inventory.integrity.sourceCountEquality ||
  !inventory.integrity.roleCountEquality
)
  throw new Error('Inventory integrity failure: ' + JSON.stringify(inventory.integrity));
const outDir = resolve(root, '.build/atlas-material-inventory');
mkdirSync(outDir, { recursive: true });
const out = resolve(
  outDir,
  'result-' + new Date().toISOString().replaceAll(':', '').replaceAll('.', '-') + '.json',
);
writeFileSync(out, JSON.stringify(inventory, null, 2) + '\n');
console.log(out);
console.log(
  JSON.stringify({
    totalRecords: inventory.totalRecords,
    sourceKinds: inventory.sourceKinds,
    semanticRoles: inventory.semanticRoles,
    integrity: inventory.integrity,
  }),
);
