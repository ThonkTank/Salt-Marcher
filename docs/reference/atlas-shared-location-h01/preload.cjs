// Replace only the QA scenario at require time; source checkout and loaded product remain unmodified.
const path = require('node:path');
const scenario = path.join(__dirname, 'source-b87a066/tools/host/atlas-campaign-runtime.cjs');
require.cache[scenario] = { id: scenario, filename: scenario, loaded: true,
  exports: require('./location-key.cjs') };
