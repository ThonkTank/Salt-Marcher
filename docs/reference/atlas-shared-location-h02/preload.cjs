// QA scenario only; frozen source and loaded product remain unmodified.
const path = require('node:path');
const scenario = path.join(__dirname, 'source-4515088/tools/host/atlas-campaign-runtime.cjs');
require.cache[scenario] = { id: scenario, filename: scenario, loaded: true, exports: require('./location-key.cjs') };
