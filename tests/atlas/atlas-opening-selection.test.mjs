import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { buildSync } from '../helpers/build.mjs';

buildSync({
  stdin: {
    contents:
      "export {AtlasAuthor} from './src/app/atlas/atlas-author';export {CampaignAtlasWorkbench} from './src/app/atlas/campaign-atlas-ui';",
    resolveDir: process.cwd(),
  },
  outfile: '.build/atlas-opening-selection-test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
});
const { AtlasAuthor, CampaignAtlasWorkbench } = createRequire(import.meta.url)(
  '../../.build/atlas-opening-selection-test.cjs',
);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
function fixture() {
  const atlas = Object.create(CampaignAtlasWorkbench.prototype),
    surface = deferred(),
    read = deferred(),
    reading = deferred(),
    families = [];
  Object.assign(atlas, {
    root: { hidden: true, dataset: {} },
    owner: { token: 'campaign' },
    family: 'interior',
    transitionGeneration: 0,
    terrain: { open() {} },
    layout: { setActive() {} },
    regions: {
      openTerrain: () => surface.promise,
      refresh: () => {
        reading.resolve();
        return read.promise;
      },
    },
  });
  const author = new AtlasAuthor({
    get owner() {
      return atlas.owner;
    },
    root: atlas.root,
  });
  atlas.author = author;
  atlas.setFamily = async (family) => {
    families.push(family);
    author.changeTool();
    return true;
  };
  return { atlas, author, surface, read, reading, families };
}

test(
  'late opening completion cannot retire a newer room navigation',
  { timeout: 2000 },
  async () => {
    const x = fixture(),
      opening = x.atlas.open();
    x.surface.resolve();
    await x.reading.promise;
    const current = x.author.beginNavigation();
    x.read.resolve();
    await opening;
    assert.deepEqual(x.families, []);
    assert.equal(current(), true, 'the new focus response must retain its selection authority');
    assert.equal(x.atlas.opening, null);
  },
);

test(
  'ordinary opening still restores the current tool family once',
  { timeout: 2000 },
  async () => {
    const x = fixture(),
      opening = x.atlas.open();
    x.surface.resolve();
    await x.reading.promise;
    x.read.resolve();
    await opening;
    assert.deepEqual(x.families, ['interior']);
    assert.equal(x.atlas.opening, null);
  },
);

test('watching asynchronous setup preserves current navigation and observes newer selection or hide', () => {
  const x = fixture(),
    current = x.author.beginNavigation(),
    watched = x.author.watchNavigation();
  assert.equal(current(), true);
  assert.equal(watched(), true);
  const newer = x.author.beginNavigation();
  assert.equal(current(), false);
  assert.equal(watched(), false);
  assert.equal(newer(), true);
  x.author.hide();
  assert.equal(newer(), false);
});
