import {build} from 'esbuild';
import {homedir} from 'node:os';
const root=homedir()+'/.cache/saltmarcher/deck-comparison/probe';
await build({entryPoints:[root+'/probe.mjs'],outfile:root+'/bundle.mjs',bundle:true,format:'esm',platform:'browser'});
