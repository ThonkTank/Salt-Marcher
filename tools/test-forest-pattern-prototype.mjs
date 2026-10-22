import {createNativeSession} from './native-session.mjs';
import {buildSync} from 'esbuild';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/forest-pattern-prototype');
const native=await createNativeSession({root,output,name:'forest-pattern-prototype'});
try{
 const page=await native.launch(),source=buildSync({entryPoints:['tools/forest-pattern-prototype/probe.ts'],bundle:true,format:'iife',globalName:'ForestPatternProbe',write:false}).outputFiles[0].text;
 const result=await page.evaluate(`(()=>{${source}\nreturn ForestPatternProbe.run();})()`);
 for(const {name,image}of result.images)await writeFile(path.join(output,name+'.png'),Buffer.from(image.split(',')[1],'base64'));
 delete result.images;result.probeSources={};for(const file of ['tools/forest-pattern-prototype/pattern.ts','tools/forest-pattern-prototype/probe.ts','src/app/landscape-raster.ts'])result.probeSources[file]=createHash('sha256').update(await readFile(file)).digest('hex');await native.close();await native.finish(result);
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
