import {buildSync} from 'esbuild';import{createRequire}from'node:module';import{readFileSync,writeFileSync}from'node:fs';
buildSync({entryPoints:['src/app/landscape-brush.ts'],outfile:'.build/brush-coordinate-integer.cjs',bundle:true,platform:'node',format:'cjs'});
const {brushFootprint}=createRequire(import.meta.url)('./brush-coordinate-integer.cjs');
const {points,radius}=JSON.parse(readFileSync('tests/fixtures/landscape-brush-distant-stroke.json'));
const result={pass:0,fail:0,ms:0};const start=performance.now();
for(let n=0;n<30;n++){const moved=points.map(p=>({x:p.x+n*.0123456789,y:p.y+n*.00987654321}));try{const p=brushFootprint(moved,radius);if(!p.length)throw Error('Empty');result.pass++;}catch(e){result.fail++;result.lastError=String(e);}}
result.ms=performance.now()-start;
for(const count of [100,2000]){const path=Array.from({length:count},(_,i)=>({x:-8130000+i*2,y:-983700+Math.sin(i/100)*40})),start=performance.now();const out=brushFootprint(path,55);result['samples'+count]={ms:performance.now()-start,polygons:out.length,vertices:out.reduce((sum,p)=>sum+p.outer.length,0)};}
writeFileSync('.build/brush-coordinate-integer-comparison.json',JSON.stringify(result,null,2));console.log(result);
