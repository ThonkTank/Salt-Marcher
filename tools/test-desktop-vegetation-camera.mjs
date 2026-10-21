import {createNativeSession} from './native-session.mjs';
import {vegetationCameraPixels} from './vegetation-camera-probe.mjs';
import path from 'node:path';
const root=process.cwd(),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/vegetation-camera');
const native=await createNativeSession({root,output:out,name:'vegetation-camera'});
try{
 const page=await native.launch(),vegetation=await vegetationCameraPixels(page,out);
 await native.close();await native.finish({vegetation});
}catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
