import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {buildSync} from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
buildSync({entryPoints:['src/app/workspace-navigation.ts'],outfile:'.build/workspace-navigation.cjs',bundle:true,platform:'node',format:'cjs'});
const ui=require('../.build/workspace-navigation.cjs');
function setup(t,narrow=false){
 const {window,document}=parseHTML(readFileSync('src/app/index.html','utf8')),saved={window:globalThis.window,document:globalThis.document,ResizeObserver:globalThis.ResizeObserver};
 const observations=[];let measure;
 const media={matches:narrow,addEventListener(type,fn){this.changes??=[];this.changes.push(fn);},change(){for(const fn of this.changes)fn();}};window.matchMedia=()=>media;
 Object.assign(globalThis,{window,document,ResizeObserver:class{constructor(fn){measure=fn;}observe(el){observations.push(el);}}});t.after(()=>Object.assign(globalThis,saved));
 const el=id=>document.getElementById(id);for(const id of ['quick-reference-open','narrative-journal-open','location-notebook-open','location-material-return']){const b=document.createElement('button');b.id=id;document.querySelector('header').append(b);}
 const heights={header:64,navigation:44,focus:54,footer:58};document.querySelector('header').getBoundingClientRect=()=>({height:heights.header});el('workspace-navigation').getBoundingClientRect=()=>({height:heights.navigation});el('live-focus-bar').getBoundingClientRect=()=>({height:heights.focus});el('music-mini').getBoundingClientRect=()=>({height:heights.footer});ui.initWorkspaceNavigation();return {window,document,el,media,heights,observations,measure};
}
test('navigation retains every original destination and each tool instance and handler',t=>{
 const x=setup(t),buttons=x.document.querySelectorAll('#workspace-navigation button');assert.equal(buttons.length,13);assert.equal(new Set([...buttons].map(b=>b.id)).size,13);
 for(const id of ['narrative-journal-open','location-notebook-open'])assert.equal(x.el(id).parentElement.id,'workspace-tools-content');
 assert.equal(x.el('quick-reference-open').parentElement.tagName,'HEADER');let clicks=0;const b=x.el('location-notebook-open');b.onclick=()=>clicks++;x.el('workspace-tools').open=true;b.click();assert.equal(clicks,1);assert.equal(x.el('workspace-tools').open,false);assert.equal(x.el('location-notebook-open'),b);assert.equal(x.el('day-trigger').parentElement.tagName,'HEADER');
 x.el('atlas-tab').setAttribute('aria-pressed','false');x.el('live-tab').setAttribute('aria-pressed','true');ui.syncWorkspaceNavigation();assert.match(x.el('workspace-nav-summary').textContent,/Party und Leiten/);
});
test('narrow destination menu closes after selection and follows viewport changes',t=>{
 const x=setup(t,true),menu=x.el('workspace-nav-menu');assert.equal(menu.open,false);menu.open=true;x.el('live-tab').click();assert.equal(menu.open,false);x.media.matches=false;x.media.change();assert.equal(menu.open,true);
});
test('Escape closes a tool menu but leaves a modal dialog in control',t=>{
 const x=setup(t),tools=x.el('workspace-tools');tools.open=true;x.el('tutorial-dialog').setAttribute('open','');const key=()=>{const e=new x.window.Event('keydown',{bubbles:true,cancelable:true});e.key='Escape';x.document.dispatchEvent(e);return e;};assert.equal(key().defaultPrevented,false);assert.equal(tools.open,true);x.el('tutorial-dialog').removeAttribute('open');assert.equal(key().defaultPrevented,true);assert.equal(tools.open,false);
});

test('one existing group selector stays outside profile details and measured sticky surfaces follow wrapping and visibility',t=>{
 const x=setup(t),bar=x.el('live-focus-bar'),selector=x.el('scene-focus'),move=x.el('group-move'),style=x.document.documentElement.style;
 assert.equal(x.document.querySelectorAll('#scene-focus').length,1);assert.equal(selector.parentElement,bar);assert.equal(move.parentElement,bar);assert.equal(bar.closest('details'),null);assert.equal(bar.parentElement.id,'live');assert.equal(x.el('combat-panel').parentElement,bar.parentElement);
 let changes=0;selector.onchange=()=>changes++;selector.dispatchEvent(new x.window.Event('change'));assert.equal(changes,1);
 assert.deepEqual(x.observations.map(e=>e.id||e.tagName),['HEADER','workspace-navigation','live-focus-bar','music-mini']);assert.equal(style.getPropertyValue('--workspace-nav-height'),'0px');assert.equal(style.getPropertyValue('--live-focus-height'),'54px');
 x.heights.header=110;x.heights.focus=100;x.media.matches=true;x.media.change();assert.equal(style.getPropertyValue('--workspace-header-height'),'110px');assert.equal(style.getPropertyValue('--workspace-nav-height'),'44px');assert.equal(style.getPropertyValue('--live-focus-height'),'100px');
 assert.equal(style.getPropertyValue('--workspace-footer-height'),'58px');x.heights.footer=110;x.measure();assert.equal(style.getPropertyValue('--workspace-footer-height'),'110px');
 x.heights.focus=0;x.measure();assert.equal(style.getPropertyValue('--live-focus-height'),'0px');
});
