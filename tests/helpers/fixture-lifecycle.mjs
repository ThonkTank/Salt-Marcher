// Reload only the fixture's own bundle. Removing require.cache alone leaves
// every previous module in its synthetic createRequire parent's children.
export function freshFixtureModule(require, filename) {
  const id = require.resolve(filename);
  const previous = require.cache[id];
  if (previous?.parent) {
    const children = previous.parent.children;
    const index = children.indexOf(previous);
    if (index !== -1) children.splice(index, 1);
  }
  delete require.cache[id];
  return require(id);
}

// Node's test resource registry can retain completed hook functions. Keep the
// awaited result/error, but release the fixture closure once cleanup starts.
export function afterFixture(t, cleanup) {
  let completion;
  t.after(() => {
    if (cleanup) {
      const run = cleanup;
      cleanup = undefined;
      completion = Promise.resolve().then(run);
    }
    return completion;
  });
}
