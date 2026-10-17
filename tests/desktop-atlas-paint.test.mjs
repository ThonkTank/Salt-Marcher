import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {DOMParser} from 'linkedom';
buildSync({stdin:{contents:"export * from './src/app/drawing-model';export {cityPaint,citySvg} from './src/app/city-model';export * from './src/app/atlas-paint-svg';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'.build/atlas-paint-test.cjs'});
const {elementPaint,elementSvg,cityPaint,citySvg,paintElement}=createRequire(import.meta.url)('../.build/atlas-paint-test.cjs');
const baseline=JSON.parse(readFileSync(new URL('./fixtures/atlas-paint-baseline.json',import.meta.url),'utf8'));
function tree(node){
 const attrs=Object.fromEntries([...node.attributes].map(a=>[a.name,a.value]));
 if(attrs.transform){const r=attrs.transform.match(/^rotate\(([^ ]+) ([^ ]+) ([^)]+)\)$/);if(r){const [angle,x,y]=r.slice(1).map(Number),c=Math.cos(angle*Math.PI/180),s=Math.sin(angle*Math.PI/180);attrs.transform="matrix("+[c,s,-s,c,x-x*c+y*s,y-x*s-y*c].join(" ")+")";}}
 if(attrs.transform)attrs.transform=attrs.transform.replace(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi,n=>String(Math.round(Number(n)*1e9)/1e9));
 if(attrs["dominant-baseline"]==="central")attrs["dominant-baseline"]="middle";
 return {tag:node.tagName.toLowerCase(),attrs:{...attrs},text:node.children.length?'':node.textContent,children:[...node.children].map(tree)};
}
const parsed=svg=>new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
for(const c of baseline.cases)test('Direct glyph geometry preserves baseline '+c.name,()=>{
 // No browser globals/DOMParser available to the actual geometry builder.
 const expected=tree(parsed(c.svg)),paint=elementPaint(c.element,baseline.rooms,[]);
 assert.deepEqual(tree(paintElement(paint,parsed("<svg/>").ownerDocument)),expected);
 assert.equal(paint.kind,"group");assert.equal(paint.attrs,undefined);
 assert.deepEqual(tree(parsed(elementSvg(c.element,baseline.rooms,[]))),expected);
 assert.equal(paint.title,c.element.name);
});
test('City canvas and exported vectors preserve every unit family and escaped names',()=>{
 const expected=tree(parsed(baseline.citySvg));
 // The old SVG host used percentages; direct geometry has explicit local dimensions.
 expected.children[1].attrs.width=String(baseline.city.header.width);expected.children[1].attrs.height=String(baseline.city.header.height);
 assert.deepEqual(tree(paintElement(cityPaint(baseline.city),parsed("<svg/>").ownerDocument)),expected);
 assert.deepEqual(tree(parsed(citySvg(baseline.city))),expected);
});
test('Legacy SVG adapter builds safe nodes from the same geometry without parsing markup',()=>{
 const doc=parsed('<svg xmlns="http://www.w3.org/2000/svg"/>').ownerDocument;
 const c=baseline.cases.find(c=>c.name==='text'),paint=elementPaint(c.element,baseline.rooms,[]);
 const element=paintElement(paint,doc);
 assert.deepEqual(tree(element),tree(parsed(elementSvg(c.element,baseline.rooms,[]))));
 assert.equal(element.querySelector('script'),null);
 assert.equal(element.querySelector('text').textContent,c.element.name);
});
