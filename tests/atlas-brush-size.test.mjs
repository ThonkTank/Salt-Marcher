import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {parseHTML} from './helpers/dom.mjs';
buildSync({stdin:{contents:"export * from './src/app/atlas-brush-size';export * from './src/app/landscape-tool-settings';export * from './src/app/atlas-units';",resolveDir:process.cwd()},outfile:'.build/atlas-brush-size.cjs',bundle:true,platform:'node',format:'cjs'});
const {BrushSizes,BrushSizeControl,LandscapeToolSettings,HEIGHT_PRESETS,initAtlasUnits,setAtlasUnits,atlasFieldValue}=createRequire(import.meta.url)('../.build/atlas-brush-size.cjs');

test('all brush families retain a CSS-pixel radius across zoom, and fixed mode retains world geometry',()=>{
  for(const key of ['height','smooth','color','freshwater','property','reset','territory','vegetation','vegetation-clear','vegetation-thin','vegetation-dense','room-cave','room-erase','scatter']){
    const m=new BrushSizes();
    for(const scale of [.002,1,1000]){
      const s=m.size(key,scale);
      assert.equal(s.world/scale,48);
    }
    m.set(key,1000,75);const before=m.size(key,1000).world;
    m.setMode('world');
    assert.equal(m.size(key,1000).world,before);
    assert.equal(m.size(key,2).world,before);
    m.setMode('screen');assert.equal(m.size(key,2).world,before);
    assert.equal(m.size(key,1).world,before/2);
  }
});
test('mode, per-tool sizes, presets and invalid preferences remain independent of campaign storage',()=>{
  const m=new BrushSizes();m.set('height',5,80);m.set('smooth',2,20);
  m.setMode('world');m.preset('height',5,65);
  assert.equal(m.size('height',1).world,325);
  assert.equal(m.size('smooth',1).world,40);
  const restored=new BrushSizes(m.serialize());assert.equal(restored.mode,'world');
  assert.equal(restored.size('height',2).world,325);
  for(const invalid of ['bad','null','{"version":1,"sizes":{"height":null,"smooth":{"screen":-1}}}']){
    assert.equal(new BrushSizes(invalid).size('height',1).world,48);
  }
});
test('actual controls keep slider, typed units, locked drafts and preset parameters in agreement',t=>{
  const {document,window}=parseHTML('<html><body><main><label>Width<input id="land-width"></label><label>Radius<input id="land-radius" value="500"></label></main></body></html>');
  const old={document:global.document,Event:global.Event};global.document=document;global.Event=window.Event;t.after(()=>Object.assign(global,old));
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.getAttribute('data-value')??this.querySelector('option')?.value??'';},set(v){this.setAttribute('data-value',v);}});
  const panel=document.querySelector('main'),f=id=>document.getElementById(id),settings=new LandscapeToolSettings(panel,()=>{});
  initAtlasUnits(document);
  const control=new BrushSizeControl(f('land-radius'),()=>{});t.after(()=>control.dispose());
  settings.show('height');control.sync('dom-height',10,false);
  assert.equal(Number(atlasFieldValue(f('land-radius'))),480);
  assert.equal(f('land-height-direction').nextElementSibling.querySelector('input').id,'land-height-strength-slider');
  assert.equal(f('land-height-strength').closest('label').nextElementSibling,control.root);
  f('land-height-strength-slider').value='3';f('land-height-strength-slider').dispatchEvent(new Event('input',{bubbles:true}));
  assert.equal(settings.height().strength,1000);
  for(const [i,p]of HEIGHT_PRESETS.entries()){
    f('land-height-target-enabled').checked=true;
    f('land-height-preset').value=String(i);f('land-height-preset').dispatchEvent(new Event('input',{bubbles:true}));f('land-height-preset').dispatchEvent(new Event('change',{bubbles:true}));
    assert.deepEqual(settings.height(),{mode:p.direction,strength:p.strength,feather:p.feather,roughness:p.roughness});
    assert.equal(Number(atlasFieldValue(f('land-radius'))),p.radius*10);
  }
  f('land-radius-fixed').checked=true;f('land-radius-fixed').dispatchEvent(new Event('change'));
  assert.equal(Number(atlasFieldValue(f('land-radius'))),200);
  setAtlasUnits('metric');control.sync('dom-height',2,false);
  assert.equal(f('land-radius-value').value,'200');
  f('land-radius-value').value='123';f('land-radius-value').dispatchEvent(new Event('change'));
  assert.equal(Number(atlasFieldValue(f('land-radius'))),123);
  assert.equal(f('land-height-preset').value,'');
  setAtlasUnits('dnd');control.sync('dom-height',2,false);
  assert(Math.abs(Number(f('land-radius-value').value)*.3048-123)<.002);
  assert.equal(Number(atlasFieldValue(f('land-radius'))),123);
  control.sync('dom-height',2,true);
  f('land-radius-value').value='20';f('land-radius-value').dispatchEvent(new Event('change'));
  control.sync('dom-height',99,true);
  assert.equal(Number(atlasFieldValue(f('land-radius'))),123);
  assert(f('land-radius-value').disabled);
  control.sync('dom-height',2,false);
  assert(!f('land-radius-value').disabled);
});
