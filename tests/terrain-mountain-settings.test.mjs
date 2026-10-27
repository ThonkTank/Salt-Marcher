import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
import {parseHTML} from './helpers/dom.mjs';
buildSync({stdin:{contents:"export {LandscapeToolSettings} from './src/app/landscape-tool-settings';export {BrushSizeControl} from './src/app/atlas-brush-size';",resolveDir:process.cwd()},outfile:'.build/terrain-mountain-settings.cjs',bundle:true,platform:'node',format:'cjs'});
const {LandscapeToolSettings,BrushSizeControl}=createRequire(import.meta.url)('../.build/terrain-mountain-settings.cjs');
test('mountain presets select the real specialist, retain it through size/height changes, and leave the basic controls reachable',t=>{
 const {window,document}=parseHTML('<html><body></body></html>'),prior={document:global.document,Event:global.Event};Object.assign(global,{document,Event:window.Event});t.after(()=>Object.assign(global,prior));
 const panel=document.createElement('div');document.body.append(panel);panel.innerHTML='<label>Width<input id="land-width"></label><label>Radius<input id="land-radius" value="500"></label>';
 const settings=new LandscapeToolSettings(panel,()=>{}),f=id=>panel.querySelector('#'+id),size=new BrushSizeControl(f('land-radius'),()=>{});t.after(()=>size.dispose());
 settings.show('height');size.sync('test:mountain',10,false);f('land-height-presets').querySelector('[data-preset="1"]').click();
 assert.equal(settings.height().form,'mountain');assert(Math.abs(settings.height().strength-455)<1e-8);assert.equal(f('land-radius').value,'650');
 for(const id of ['land-height-feather','land-coast-roughness','land-height-target-enabled'])assert(f(id).closest('label').hidden);
 assert.match(f('land-height-strength').closest('label').textContent,/Reliefhöhe/);assert.equal(f('land-preset-status').textContent,'Bergpinsel');
 f('land-radius-value').value='120';f('land-radius-value').dispatchEvent(new Event('change'));assert.equal(settings.height().form,'mountain');assert(Math.abs(settings.height().strength-840)<1e-8);
 f('land-height-strength').value='900';f('land-height-strength').dispatchEvent(new Event('input',{bubbles:true}));assert.equal(settings.height().form,'mountain');assert.equal(settings.height().strength,900);
 Object.defineProperty(document,'activeElement',{configurable:true,value:f('land-height-strength')});
 for(const value of ['', '0', '0.', '0.4']){f('land-height-strength').value=value;f('land-height-strength').dispatchEvent(new Event('input',{bubbles:true}));assert.equal(f('land-height-strength').value,value);}
 assert(Math.abs(settings.height().strength-.4)<1e-10);Object.defineProperty(document,'activeElement',{configurable:true,value:null});
 f('land-height-strength').value='900';f('land-height-strength').dispatchEvent(new Event('input',{bubbles:true}));
 f('land-height-target-enabled').checked=true;assert.equal(settings.height().targetM,undefined);
 settings.show('smooth');assert.equal(settings.height().form,undefined);settings.show('height');assert.equal(settings.height().form,'mountain');
 size.sync('test:mountain',20,false);settings.show('height');assert.equal(settings.height().strength,1800);assert.equal(f('land-height-strength').value,'1800');size.sync('test:mountain',10,false);settings.show('height');
 f('land-height-direction').querySelector('[data-direction="raise"]').click();assert.equal(settings.height().form,undefined);assert(!f('land-height-feather').closest('label').hidden);assert.match(f('land-height-strength').closest('label').textContent,/m\/s/);
 f('land-height-presets').querySelector('[data-preset="2"]').click();assert.equal(settings.height().form,'mountain');assert(Math.abs(settings.height().strength-850)<1e-8);assert.equal(f('land-radius').value,'1000');
});

test('hills select the shared form, scale relief with size, allow manual relief and return to basic correction tools',t=>{
 const {window,document}=parseHTML('<html><body></body></html>'),prior={document:global.document,Event:global.Event};Object.assign(global,{document,Event:window.Event});t.after(()=>Object.assign(global,prior));
 const panel=document.createElement('div');document.body.append(panel);panel.innerHTML='<label>Width<input id="land-width"></label><label>Radius<input id="land-radius" value="500"></label>';
 const settings=new LandscapeToolSettings(panel,()=>{}),f=id=>panel.querySelector('#'+id),size=new BrushSizeControl(f('land-radius'),()=>{});t.after(()=>size.dispose());
 settings.show('height');size.sync('test:hills',10,false);f('land-height-presets').querySelector('[data-preset="0"]').click();
 assert.equal(settings.height().form,'hills');assert.equal(settings.height().strength,128);assert.equal(f('land-radius').value,'400');assert.equal(f('land-preset-status').textContent,'Hügelpinsel');
 f('land-radius-value').value='120';f('land-radius-value').dispatchEvent(new Event('change'));assert.equal(settings.height().strength,384);
 f('land-height-strength').value='80';f('land-height-strength').dispatchEvent(new Event('input',{bubbles:true}));assert.equal(settings.height().strength,80);assert.equal(settings.height().targetM,undefined);
 settings.show('smooth');assert.equal(settings.height().form,undefined);assert.equal(settings.height().mode,'smooth');settings.show('height');assert.equal(settings.height().form,'hills');
 f('land-height-direction').querySelector('[data-direction="lower"]').click();assert.equal(settings.height().form,undefined);assert.equal(settings.height().mode,'lower');
});

test('canyon selects the shared form, scale relief with size, allow manual relief and return to basic correction tools',t=>{
 const {window,document}=parseHTML('<html><body></body></html>'),prior={document:global.document,Event:global.Event};Object.assign(global,{document,Event:window.Event});t.after(()=>Object.assign(global,prior));
 const panel=document.createElement('div');document.body.append(panel);panel.innerHTML='<label>Width<input id="land-width"></label><label>Radius<input id="land-radius" value="500"></label>';
 const settings=new LandscapeToolSettings(panel,()=>{}),f=id=>panel.querySelector('#'+id),size=new BrushSizeControl(f('land-radius'),()=>{});t.after(()=>size.dispose());
 settings.show('height');size.sync('test:canyon',10,false);f('land-height-presets').querySelector('[data-preset="4"]').click();
 assert.equal(settings.height().mode,'lower');assert.equal(settings.height().form,'canyon');assert.equal(settings.height().strength,176);assert.equal(f('land-radius').value,'320');assert.equal(f('land-preset-status').textContent,'Schluchtenpinsel');
 f('land-radius-value').value='120';f('land-radius-value').dispatchEvent(new Event('change'));assert.equal(settings.height().strength,660);
 f('land-height-strength').value='80';f('land-height-strength').dispatchEvent(new Event('input',{bubbles:true}));assert.equal(settings.height().strength,80);assert.equal(settings.height().targetM,undefined);
 settings.show('smooth');assert.equal(settings.height().form,undefined);assert.equal(settings.height().mode,'smooth');settings.show('height');assert.equal(settings.height().form,'canyon');
 f('land-height-direction').querySelector('[data-direction="lower"]').click();assert.equal(settings.height().form,undefined);assert.equal(settings.height().mode,'lower');
});
