import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const directory=process.argv[2];if(!directory)throw Error('Pass x11 or wayland evidence directory');
const events=JSON.parse(gunzipSync(await readFile(directory+'/layout-trace.json.gz')));
const result={};
for(const name of ['NativeViewGLSurfaceEGL:RealSwapBuffers','FireAnimationFrame','ProxyMain::BeginMainFrame','EventDispatch']){
 const values=events.filter(e=>e.ph==='X'&&e.name===name&&Number.isFinite(e.dur)).map(e=>e.dur/1000).sort((a,b)=>a-b);
 result[name]={count:values.length,...values.length?{p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],max:values.at(-1),sum:values.reduce((a,b)=>a+b,0)}:{}};
}
await writeFile(directory+'/summary.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
