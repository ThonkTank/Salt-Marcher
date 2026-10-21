import {createNativeSession} from './native-session.mjs';
import {terrainCoveragePixels} from './terrain-coverage-probe.mjs';
import path from 'node:path';
const root=process.cwd(),out=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-coverage');
const native=await createNativeSession({root,output:out,name:'terrain-coverage'});
try{const page=await native.launch(),coverage=await terrainCoveragePixels(page,out);await native.close();await native.finish({coverage});}
catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
