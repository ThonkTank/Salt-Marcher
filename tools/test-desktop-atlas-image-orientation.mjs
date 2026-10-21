import {createNativeSession} from './native-session.mjs';
import {atlasImageOrientationPixels} from './atlas-image-orientation-probe.mjs';
import path from 'node:path';
const out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-image-orientation');
const native=await createNativeSession({output:out,name:'atlas-image-orientation'});
try{
 const page=await native.launch(),samples=await atlasImageOrientationPixels(page,out);
 await native.close();await native.finish({samples});
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
