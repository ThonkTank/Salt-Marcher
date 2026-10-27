// The public build command owns the active desktop application.
// Test preparation remains compatible with direct Node test invocations.
const args = process.argv.slice(2);
if (args.length === 0) {
  await import('./tools/build-desktop.mjs');
} else if (args.length === 1 && args[0] === '--test') {
  const { ensureTestAsset, publishTestAlias, prepareTestCatalog } = await import(
    './tools/test-assets.mjs'
  );
  prepareTestCatalog();
  publishTestAlias(ensureTestAsset('store'), '.build/test-shared/store.cjs');
} else {
  throw new Error(
    'Usage: node build.mjs [--test]; historical reference: npm run build:legacy:obsidian',
  );
}
