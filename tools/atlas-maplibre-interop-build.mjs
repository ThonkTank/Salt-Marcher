import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve('.build/atlas-maplibre-interop');
await mkdir(root,{recursive:true});
await build({
  entryPoints:['tools/atlas-maplibre-interop-probe.mjs'],
  bundle:true,format:'esm',platform:'browser',target:'chrome130',
  nodePaths:[resolve(root,'node_modules')],
  outfile:resolve(root,'probe.bundle.mjs'),sourcemap:true,logLevel:'info'
});
