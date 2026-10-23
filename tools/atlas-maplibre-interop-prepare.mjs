import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// The probe now shares the product's pinned dependency graph. Install it with
// the repository's npm ci; do not maintain a second resolution under .build.
const versions={'maplibre-gl':'6.15.0','@deck.gl/maplibre':'9.4.0','@deck.gl/core':'9.4.0','@deck.gl/layers':'9.4.0','@math.gl/core':'4.1.0'};
for(const [name,expected] of Object.entries(versions)){
  const actual=JSON.parse(await readFile(resolve('node_modules',name,'package.json'),'utf8')).version;
  if(actual!==expected)throw Error(`Atlas requires ${name}@${expected}; found ${actual}. Run npm ci.`);
}
await mkdir('.build/atlas-maplibre-interop',{recursive:true});
console.log('Pinned product dependencies ready for the Atlas interop probe');
