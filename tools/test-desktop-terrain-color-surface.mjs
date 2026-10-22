import path from 'node:path';
import {createNativeSession} from './native-session.mjs';
import {terrainColorSurfacePixels} from './terrain-color-surface-probe.mjs';
const output=path.resolve(process.env.QA_EVIDENCE_DIR??'.build/terrain-color-surface');
const native=await createNativeSession({output,name:'terrain-color-surface'});
try{const page=await native.launch();const pixels=await terrainColorSurfacePixels(page);await native.close();await native.finish({pixels});console.log(JSON.stringify(pixels));}
catch(error){await native.fail(error);throw error;}finally{await native.dispose();}
