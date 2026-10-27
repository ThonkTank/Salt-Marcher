/**
 * Assemble the exact prepared terrain shader through Deck's layer and Luma's
 * shader assembler, then bind it to one already-built desktop runtime.
 * This is an offline preparation step. It never creates a GL context.
 *
 * Required before use: an accepted source freeze, its manifest, a serial
 * desktop build, and a platform-info file fixed before the native launch.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root=path.resolve(import.meta.dirname,'..');
const hash=value=>createHash('sha256').update(value).digest('hex');
const args=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const match=/^--([^=]+)=(.+)$/.exec(arg);
  assert(match,`Expected --name=value, received ${arg}`);
  return[match[1],match[2]];
}));
const sourceManifest=args['source-manifest'];
const runtime=args.runtime;
const platformFile=args['platform-info'];
const output=args.output;
const candidate=args.candidate;
assert(sourceManifest&&runtime&&platformFile&&output&&candidate,
  'Required: --source-manifest=FILE --runtime=DIR --platform-info=FILE --output=DIR --candidate=ID');

const sourceManifestPath=path.resolve(sourceManifest);
const runtimePath=path.resolve(runtime);
const platformPath=path.resolve(platformFile);
const outputPath=path.resolve(output);
assert(outputPath.startsWith(path.join(root,'.build')+path.sep),'Output must be inside .build.');
const frozen=JSON.parse(await readFile(sourceManifestPath,'utf8'));
assert(frozen?.accepted===true&&frozen?.acceptedS1S2===true&&
  frozen?.sourceHashes&&typeof frozen.sourceHashes==='object',
  'Accepted S1/S2 source manifest with sourceHashes is required.');
for(const [filename,expected] of Object.entries(frozen.sourceHashes)){
  assert(!path.isAbsolute(filename)&&!filename.split(path.sep).includes('..'),`Unsafe source path ${filename}`);
  assert.equal(hash(await readFile(path.join(root,filename))),expected,`Source changed: ${filename}`);
}
assert(frozen.sourceHashes['src/app/atlas-terrain-field-presentation.ts'],
  'The shader-owning product file must be in the accepted freeze.');
assert(frozen.sourceHashes['src/app/atlas-terrain-prepared-field.ts']&&
  frozen.sourceHashes['tools/terrain-water-p-program-expectation.mjs']&&
  frozen.sourceHashes['tools/terrain-water-field-gate.mjs'],
  'Prepared GLSL dependency, offline assembler and FieldGate must be frozen.');
const platformRecord=JSON.parse(await readFile(platformPath,'utf8'));
assert.equal(platformRecord?.schema,'terrain-p-platform-info/v1');
assert(platformRecord?.provenance&&platformRecord?.capturedBeforeLaunch===true,
  'Independent prelaunch platform information and provenance are required.');
const platform=platformRecord.platformInfo;
assert.equal(platform?.type,'webgl');
assert.equal(platform?.shaderLanguage,'glsl');
assert.equal(platform?.shaderLanguageVersion,300);
assert.equal(platform?.gpu,'intel');
assert(Array.isArray(platform.features)&&platform.limits&&typeof platform.limits==='object');
const platformInfo={...platform,features:new Set(platform.features)};

await mkdir(outputPath,{recursive:true});
// Bundle current TypeScript source for offline import. Installed library packages
// remain external so the same Deck/Luma implementations used by Model are called.
const importPath=path.join(outputPath,'current-presentation.mjs');
await build({entryPoints:[path.join(root,'src/app/atlas-terrain-field-presentation.ts')],
  outfile:importPath,bundle:true,packages:'external',platform:'node',format:'esm',target:'node22'});
const {AtlasTerrainFieldLayer}=await import(pathToFileURL(importPath).href);
const {getShaderAssembler,layerUniforms}=await import(pathToFileURL(
  path.join(root,'node_modules/@deck.gl/core/dist/shaderlib/index.js')).href);

// Layer.getShaders -> SimpleMeshLayer.getShaders -> AtlasTerrainFieldLayer.getShaders
// is the actual product path. The minimal context contains LayerManager's sole
// default module; a preparedBasis selects the current P vertex shader.
const layer=Object.create(AtlasTerrainFieldLayer.prototype);
layer.props={geometry:{preparedBasis:{}},extensions:[]};
layer.context={defaultShaderModules:[layerUniforms]};
const props=layer.getShaders();
assert(props.vs?.includes('atlas-terrain-prepared-vs')&&
  props.fs?.includes('atlas-terrain-field-fs'),
  'Current layer did not select the complete prepared VS and field FS.');
assert(Array.isArray(props.modules)&&props.modules.some(module=>module.name==='atlasTerrainField'),
  'Current field module is missing.');
const assembler=getShaderAssembler('glsl');
const assembled=assembler.assembleGLSLShaderPair({
  platformInfo,...props,modules:props.modules,defines:props.defines??{},
  pluginInjections:{},pluginVertexInputs:{},pluginVaryings:{}
});
assert(assembled.vs?.includes('void main')&&assembled.fs?.includes('void main'),
  'Complete assembler output is missing.');
const vertexFile=path.join(outputPath,'vertex.glsl');
const fragmentFile=path.join(outputPath,'fragment.glsl');
await writeFile(vertexFile,assembled.vs);
await writeFile(fragmentFile,assembled.fs);
const provenance={schema:'terrain-p-offline-program/v1',candidate,
  sourceManifest:path.relative(root,sourceManifestPath),
  sourceManifestSha256:hash(await readFile(sourceManifestPath)),
  platformInfo:path.relative(root,platformPath),platformInfoSha256:hash(await readFile(platformPath)),
  assembler:'AtlasTerrainFieldLayer.getShaders + Deck getShaderAssembler(glsl) + Luma assembleGLSLShaderPair',
  packageLockSha256:hash(await readFile(path.join(root,'package-lock.json'))),
  raw:{vs:hash(props.vs),fs:hash(props.fs)},
  complete:{vs:hash(assembled.vs),fs:hash(assembled.fs)},
  generatedBundleSha256:hash(await readFile(importPath))};
const manifestPath=path.join(outputPath,'program-source-manifest.json');
await writeFile(manifestPath,JSON.stringify(provenance,null,2));
const expectationPath=path.join(outputPath,'program-expectation.json');
const pack=path.join(root,'.build/terrain-water-e/tw06-e-r3-abc-20261026-2152/pack-program-expectation.mjs');
const result=spawnSync(process.execPath,[pack,candidate,vertexFile,fragmentFile,runtimePath,manifestPath,expectationPath],
  {cwd:root,encoding:'utf8'});
assert.equal(result.status,0,`E-R3 expectation pack failed: ${result.stderr||result.stdout}`);
const expectation=JSON.parse(await readFile(expectationPath,'utf8'));
assert.equal(expectation.provenance.manifestSha256,hash(await readFile(manifestPath)));
assert.equal(Object.keys(expectation.runtimeHashes??{}).length,13);
console.log(JSON.stringify({candidate,manifestPath,expectationPath,
  programIdentity:expectation.identity,complete:provenance.complete},null,2));
