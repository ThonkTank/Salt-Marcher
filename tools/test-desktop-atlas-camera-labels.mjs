// Isolated renderer qualification; the normal Atlas workflow is checked separately.
import {createNativeSession} from './native-session.mjs';
import {atlasCameraLabelPixels} from './atlas-camera-label-probe.mjs';
import path from 'node:path';
const root=process.cwd(),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/atlas-camera-labels');
const native=await createNativeSession({root,output:out,name:'atlas-camera-labels'});
try{
 const page=await native.launch(),labels=await atlasCameraLabelPixels(page,out);
 await native.close();await native.finish({labels});
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
