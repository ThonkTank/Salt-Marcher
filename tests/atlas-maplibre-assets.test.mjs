import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

buildSync({entryPoints:['src/app/atlas-maplibre-assets.ts'],outfile:'.build/atlas-maplibre-assets-test.cjs',bundle:true,platform:'node',format:'cjs'});
const {
  ATLAS_MAPLIBRE_FONT_COVERAGE, ATLAS_MAPLIBRE_FONT_FAMILY, ATLAS_MAPLIBRE_FONT_FILES,
  ATLAS_MAPLIBRE_FONT_STACK, ATLAS_MAPLIBRE_MARKER_IMAGE_ID, ATLAS_MAPLIBRE_SYMBOLS_FAMILY,
  atlasMapLibreFontStyle, atlasMapLibreMarkerImage, installAtlasMapLibreSymbols, preloadAtlasMapLibreFonts
} = createRequire(import.meta.url)('../.build/atlas-maplibre-assets-test.cjs');

test('MapLibre style declares only bundled scoped font faces and no glyph PBF fallback',()=>{
  const style=atlasMapLibreFontStyle('campaign://app/');
  assert.deepEqual(ATLAS_MAPLIBRE_FONT_STACK,[ATLAS_MAPLIBRE_FONT_FAMILY,ATLAS_MAPLIBRE_SYMBOLS_FAMILY]);
  assert.deepEqual(Object.keys(style),['font-faces']);
  assert.equal('glyphs' in style,false);
  assert.equal(style['font-faces'][ATLAS_MAPLIBRE_FONT_FAMILY][0].url,'campaign://app/atlas-maplibre-fonts/NotoSans-VF.ttf');
  assert.equal(style['font-faces'][ATLAS_MAPLIBRE_SYMBOLS_FAMILY][0].url,'campaign://app/atlas-maplibre-fonts/NotoSansSymbols-VF.ttf');
  assert(style['font-faces'][ATLAS_MAPLIBRE_FONT_FAMILY][0]['unicode-range'].includes('U+0370-0377'));
  assert(style['font-faces'][ATLAS_MAPLIBRE_FONT_FAMILY][0]['unicode-range'].includes('U+0400-052F'));
  assert(style['font-faces'][ATLAS_MAPLIBRE_SYMBOLS_FAMILY][0]['unicode-range'].includes('U+2190-2199'));
  assert.deepEqual([...ATLAS_MAPLIBRE_FONT_COVERAGE.sans],style['font-faces'][ATLAS_MAPLIBRE_FONT_FAMILY][0]['unicode-range']);
  assert.deepEqual(ATLAS_MAPLIBRE_FONT_FILES,{sans:'NotoSans-VF.ttf',symbols:'NotoSansSymbols-VF.ttf'});
  assert.throws(()=>atlasMapLibreFontStyle('https://example.invalid/'),/local application asset origin/);
});

test('font preflight fetches only same-origin assets and waits for loaded faces before resolving',async()=>{
  const calls=[],added=[],loaded=[];
  class FakeFontFace {
    constructor(family,source,descriptors){this.family=family;this.source=source;this.descriptors=descriptors;this.status='unloaded';}
    async load(){this.status='loaded';return this;}
  }
  const document={location:{protocol:'campaign:',host:'app',href:'campaign://app/index.html'},fonts:{
    add(face){assert.equal(face.status,'loaded');added.push(face);},
    async load(specimen,text){loaded.push({specimen,text});return added;}
  }};
  const fetcher=async(url,options)=>{
    calls.push({url,options});
    return {ok:true,status:200,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
  };
  const options={base:'campaign://app/',document,fetcher,FontFaceConstructor:FakeFontFace};
  const first=preloadAtlasMapLibreFonts(options),second=preloadAtlasMapLibreFonts(options);
  assert.equal(first,second);
  await first;
  assert.equal(calls.length,2);
  assert(calls.every(call=>call.url.startsWith('campaign://app/atlas-maplibre-fonts/')));
  assert(calls.every(call=>call.options.credentials==='same-origin'));
  assert.deepEqual(added.map(face=>face.family),[ATLAS_MAPLIBRE_FONT_FAMILY,ATLAS_MAPLIBRE_SYMBOLS_FAMILY]);
  assert(added.every(face=>face.descriptors.weight==='100 900'));
  assert.equal(loaded.length,2);
  await assert.rejects(()=>preloadAtlasMapLibreFonts({...options,base:'campaign://elsewhere/'}),/local application asset origin/);
});

test('vendored font bytes match the recorded provenance and include the full OFL license',()=>{
  const files=[
    ['resources/atlas-maplibre-fonts/NotoSans-VF.ttf','fb53504de62e767a54695416123d68d67f71c9b69722175184ad56e7dd13547b'],
    ['resources/atlas-maplibre-fonts/NotoSansSymbols-VF.ttf','63724daeff6755a45933b9a5e3a3b41df5df8fe925c0f4c991f2f68c08a4182d']
  ];
  for(const [file,expected] of files){
    const digest=createHash('sha256').update(readFileSync(file)).digest('hex');
    assert.equal(digest,expected,file);
  }
  const license=readFileSync('resources/atlas-maplibre-fonts/OFL-1.1.txt','utf8');
  const provenance=readFileSync('resources/atlas-maplibre-fonts/PROVENANCE.md','utf8');
  assert.match(license,/SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(license,/PERMISSION & CONDITIONS/);
  assert.match(license,/DISCLAIMER/);
  assert.match(provenance,/google-noto-fonts-20251201-2\.fc44\.src\.rpm/);
  assert.match(provenance,/Copyright 2022 The Noto\s+Project Authors/);
  assert.match(provenance,/not complete Unicode coverage/i);
});

test('generated marker is deterministic RGBA and installs idempotently through MapLibre addImage',()=>{
  const image=atlasMapLibreMarkerImage(),again=atlasMapLibreMarkerImage();
  assert.equal(image.width,48);assert.equal(image.height,72);
  assert.deepEqual(image,again);
  assert.equal(image.data.length,image.width*image.height*4);
  const pixel=(x,y)=>Array.from(image.data.slice((y*image.width+x)*4,(y*image.width+x)*4+4));
  assert.deepEqual(pixel(0,0),[0,0,0,0]);
  assert.deepEqual(pixel(24,24),[242,223,173,255]);
  assert.deepEqual(pixel(24,62),[54,92,83,255]);
  const installed=new Map();
  const map={hasImage:id=>installed.has(id),addImage:(id,source,options)=>installed.set(id,{source,options})};
  assert.equal(installAtlasMapLibreSymbols(map),true);
  assert.equal(installAtlasMapLibreSymbols(map),false);
  assert.deepEqual(installed.get(ATLAS_MAPLIBRE_MARKER_IMAGE_ID).options,{pixelRatio:2});
  assert.deepEqual(installed.get(ATLAS_MAPLIBRE_MARKER_IMAGE_ID).source,image);
});
