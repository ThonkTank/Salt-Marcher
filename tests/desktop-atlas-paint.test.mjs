import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {DOMParser} from 'linkedom';
buildSync({stdin:{contents:"export * from './src/app/drawing-model';export {cityPaint,citySvg} from './src/app/city-model';export * from './src/app/atlas-paint';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'.build/atlas-paint-test.cjs'});
const {elementPaint,elementSvg,cityPaint,citySvg,paintElement}=createRequire(import.meta.url)('../.build/atlas-paint-test.cjs');
const baseline=JSON.parse(readFileSync(new URL('./fixtures/atlas-paint-baseline.json',import.meta.url),'utf8'));
function tree(node){
 const attrs=node.attrs??Object.fromEntries([...node.attributes].map(a=>[a.name,a.value]));
 return {tag:node.tagName.toLowerCase(),attrs:{...attrs},text:node.children.length?'':node.textContent,children:[...node.children].map(tree)};
}
const parsed=svg=>new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;
for(const c of baseline.cases)test('Direct glyph geometry preserves baseline '+c.name,()=>{
 // No browser globals/DOMParser available to the actual geometry builder.
 const expected=tree(parsed(c.svg)),paint=elementPaint(c.element,baseline.rooms,[]);
 assert.deepEqual(tree(paint),expected);
 assert.deepEqual(tree(parsed(elementSvg(c.element,baseline.rooms,[]))),expected);
 assert.equal(paint.children[0].textContent,c.element.name);
});
test('City canvas and exported vectors preserve every unit family and escaped names',()=>{
 const expected=tree(parsed(baseline.citySvg));
 // The old SVG host used percentages; direct geometry has explicit local dimensions.
 expected.children[1].attrs.width=String(baseline.city.header.width);expected.children[1].attrs.height=String(baseline.city.header.height);
 assert.deepEqual(tree(cityPaint(baseline.city)),expected);
 assert.deepEqual(tree(parsed(citySvg(baseline.city))),expected);
});
test('Legacy SVG adapter builds safe nodes from the same geometry without parsing markup',()=>{
 const doc=parsed('<svg xmlns="http://www.w3.org/2000/svg"/>').ownerDocument;
 const c=baseline.cases.find(c=>c.name==='text'),paint=elementPaint(c.element,baseline.rooms,[]);
 const element=paintElement(paint,doc);
 assert.deepEqual(tree(element),tree(paint));
 assert.equal(element.querySelector('script'),null);
 assert.equal(element.querySelector('text').textContent,c.element.name);
});
