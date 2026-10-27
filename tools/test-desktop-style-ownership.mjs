// Native cascade comparison on actual application DOM, using an explicitly saved
// pre-change stylesheet. No application data or renderer code is replaced.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createNativeSession } from './native-session.mjs';
const root = process.cwd(),
  require = createRequire(root + '/package.json');
const baselinePath = process.argv[process.argv.indexOf('--baseline-css') + 1];
assert(
  process.argv.includes('--baseline-css') && baselinePath,
  'Pass --baseline-css PATH to the saved, previously shipped stylesheet',
);
const baseline = await readFile(baselinePath, 'utf8');
const output = process.env.QA_EVIDENCE_DIR ?? root + '/.build/style-ownership-evidence';
const native = await createNativeSession({ root, output, name: 'style-ownership' });
const comparisons = [];
try {
  require('esbuild').buildSync({
    entryPoints: ['src/app/storage/store.ts'],
    outfile: '.build/style-ownership-store.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['better-sqlite3'],
  });
  const { CampaignStore } = require(root + '/.build/style-ownership-store.cjs');
  const store = new CampaignStore(native.profile + '/workbench.sqlite');
  const campaign = store.create('CSS-Arbeitsbereiche'),
    w = store.activate(campaign.id);
  const cmd = (action) => ({
    commandId: randomUUID(),
    token: w.token,
    campaignId: campaign.id,
    action,
  });
  const scene = store.executeLive(cmd({ kind: 'initialize', expectedRosterRevision: 0 })).scene;
  let combat = store.executeCombat({
    ...cmd({
      kind: 'create',
      sceneId: scene.id,
      title: 'Torwache',
      includeParty: false,
      expectedMembershipRevision: scene.membershipRevision,
    }),
    combatId: null,
    expectedRevision: null,
  }).combat;
  for (const action of [
    { kind: 'add-creature', creatureId: 'goblin', count: 2, grouped: true, initiative: 12 },
    { kind: 'start' },
  ])
    combat = store.executeCombat({
      ...cmd(action),
      combatId: combat.id,
      expectedRevision: combat.revision,
    }).combat;
  const id = randomUUID();
  store.executeNpc({
    commandId: randomUUID(),
    token: w.token,
    campaignId: campaign.id,
    expectedNoteRevision: null,
    expectedRecordRevision: 0,
    expectedActorRevision: null,
    expectedPositionRevision: null,
    npc: {
      id,
      name: 'Borin',
      creatureId: null,
      readAloud: 'Ein ruhiger Wächter.',
      gmNotes: 'Kennt den Hintereingang.',
      record: {
        id,
        revision: 0,
        factionId: null,
        modifier: 0,
        lifecycle: 'active',
        appearance: '',
        behavior: '',
        history: '',
      },
      locationId: null,
      health: null,
    },
  });
  store.tutorial('skipped');
  store.close();
  const page = await native.launch();
  await page
    .locator(`.campaign-card[data-campaign-id="${campaign.id}"]`)
    .getByRole('button', { name: /Öffnen|Fortsetzen/ })
    .click();
  await page.waitForFunction(
    () =>
      document.body.classList.contains('has-workspace') && !document.querySelector('main').inert,
  );
  async function tab(id) {
    if (
      !(await page.locator(id).isVisible()) &&
      (await page.locator('#atlas-navigation').isVisible())
    )
      await page.locator('#atlas-navigation').click();
    if (
      !(await page.locator(id).isVisible()) &&
      (await page.locator('#workspace-nav-summary').isVisible())
    )
      await page.locator('#workspace-nav-summary').click();
    await page.locator(id).click();
    await page.waitForFunction(() => !document.querySelector('#workspace-navigation').inert);
  }
  async function compare(name) {
    native.mark(name);
    // No scrolling between the two sheets: geometry is compared in document space.
    let result;
    for (let attempt = 0; attempt < 5; attempt++) {
      result = await page.evaluate(async (baseline) => {
        const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((x) =>
          new URL(x.href).pathname.endsWith('/app.css'),
        );
        const old = new CSSStyleSheet();
        old.replaceSync(baseline);
        const sheet = link.sheet;
        const prior = [...sheet.cssRules].map((rule) => rule.cssText);
        function replace(rules) {
          while (sheet.cssRules.length) sheet.deleteRule(0);
          for (const rule of rules) sheet.insertRule(rule, sheet.cssRules.length);
        }
        const settle = () =>
          new Promise((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
          );
        const properties = [
          'display',
          'visibility',
          'position',
          'z-index',
          'width',
          'height',
          'min-width',
          'min-height',
          'max-width',
          'max-height',
          'overflow-x',
          'overflow-y',
          'padding-top',
          'padding-right',
          'padding-bottom',
          'padding-left',
          'margin-top',
          'margin-right',
          'margin-bottom',
          'margin-left',
          'font-size',
          'font-family',
          'font-weight',
          'line-height',
          'color',
          'background-color',
          'border-top-width',
          'border-right-width',
          'border-bottom-width',
          'border-left-width',
          'border-radius',
          'gap',
          'row-gap',
          'column-gap',
          'grid-template-columns',
          'grid-template-rows',
          'flex-direction',
          'flex-wrap',
          'align-items',
          'justify-content',
          'white-space',
          'text-align',
          'box-shadow',
          'outline-width',
          'outline-color',
          'transform',
          'content',
        ];
        const nodes = [...document.querySelectorAll('body, body *')].filter(
          (n) => n instanceof HTMLElement,
        );
        function snapshot() {
          return nodes.map((node) => {
            const style = getComputedStyle(node),
              rect = node.getBoundingClientRect();
            return {
              name: node.id ? '#' + node.id : node.tagName + '.' + node.className,
              visible: !!(rect.width && rect.height),
              values: Object.fromEntries(properties.map((p) => [p, style.getPropertyValue(p)])),
              box: [rect.x + scrollX, rect.y + scrollY, rect.width, rect.height],
            };
          });
        }
        let before, after;
        try {
          replace([...old.cssRules].map((rule) => rule.cssText));
          await settle();
          before = snapshot();
        } finally {
          replace(prior);
        }
        await settle();
        after = snapshot();
        const current = [...document.querySelectorAll('body, body *')].filter(
          (n) => n instanceof HTMLElement,
        );
        if (current.length !== nodes.length || current.some((node, i) => node !== nodes[i]))
          return { unstable: true };
        const differences = [];
        for (let i = 0; i < before.length; i++) {
          const a = before[i],
            b = after[i];
          // Hidden subtrees still compare display/visibility, but their unresolved
          // percentages and grid tracks are not meaningful layout evidence.
          const props = a.visible || b.visible ? properties : ['display', 'visibility'];
          const changed = props.filter((p) => a.values[p] !== b.values[p]);
          const moved =
            (a.visible || b.visible) && a.box.some((x, j) => Math.abs(x - b.box[j]) > 0.25);
          if (changed.length || moved)
            differences.push({
              node: a.name,
              styles: changed.map((p) => [p, a.values[p], b.values[p]]),
              ...(moved ? { before: a.box, after: b.box } : {}),
            });
        }
        return { nodes: nodes.length, visible: after.filter((x) => x.visible).length, differences };
      }, baseline);
      if (!result.unstable) break;
      await page.waitForTimeout(150);
    }
    assert(!result.unstable, name + ' DOM kept changing during comparison');
    comparisons.push({ name, ...result });
    await writeFile(output + '/comparisons.json', JSON.stringify(comparisons, null, 2));
    // Capture both sheets in the same real window; restore the shipped sheet
    // before continuing navigation or allowing any assertion to escape.
    await native.capture(page, name + '-after.png');
    await page.evaluate((css) => {
      const link = [...document.querySelectorAll('link[rel="stylesheet"]')].find((x) =>
        new URL(x.href).pathname.endsWith('/app.css'),
      );
      window.__styleComparison = {
        sheet: link.sheet,
        prior: [...link.sheet.cssRules].map((rule) => rule.cssText),
      };
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      while (link.sheet.cssRules.length) link.sheet.deleteRule(0);
      for (const rule of sheet.cssRules)
        link.sheet.insertRule(rule.cssText, link.sheet.cssRules.length);
    }, baseline);
    try {
      await native.capture(page, name + '-before.png');
    } finally {
      await page.evaluate(() => {
        const x = window.__styleComparison;
        while (x.sheet.cssRules.length) x.sheet.deleteRule(0);
        for (const rule of x.prior) x.sheet.insertRule(rule, x.sheet.cssRules.length);
        delete window.__styleComparison;
      });
    }
    assert.equal(
      result.differences.length,
      0,
      name + ' changed computed layout/styles: ' + JSON.stringify(result.differences.slice(0, 8)),
    );
  }
  for (const [width, height, zoom] of [
    [1280, 880, 1],
    [800, 720, 1],
    [1280, 880, 2],
  ]) {
    await native.app.evaluate(
      ({ BrowserWindow }, s) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('/index.html'),
        );
        w.setMinimumSize(320, 240);
        w.setContentSize(s.width, s.height);
        w.webContents.setZoomFactor(s.zoom);
      },
      { width, height, zoom },
    );
    const size = width + '-' + zoom;
    for (const [name, id, ready] of [
      ['catalog', '#catalog-tab', '#catalog'],
      ['npc', '#groups-tab', '#npc-list'],
      ['music', '#music-tab', '#music'],
      ['live', '#live-tab', '#running-notes'],
      ['atlas', '#atlas-tab', '#campaign-map'],
    ]) {
      await tab(id);
      if (name === 'live' && (await page.locator('#live-continue').isVisible()))
        await page.locator('#live-continue').click();
      await page.locator(ready).waitFor({ state: 'visible' });
      if (name === 'npc') {
        await page.locator('#npc-list button').first().click();
        await page.locator('#npc-name').waitFor({ state: 'visible' });
      }
      if (name === 'catalog')
        await page.waitForFunction(
          () => document.querySelectorAll('#catalog-table tbody tr').length > 0,
        );
      if (name === 'live')
        await page.waitForFunction(
          () => document.querySelector('#combat-panel').getAttribute('aria-busy') === 'false',
        );
      await compare(name + '-' + size);
      if (name === 'live') {
        await page.locator('#combat-add-open').click();
        await page.locator('#combat-add-dialog').waitFor({ state: 'visible' });
        await compare('combat-dialog-' + size);
        await page.locator('#combat-add-close').click();
        if ((await page.locator('#live-travel-toggle').getAttribute('aria-expanded')) !== 'true')
          await page.locator('#live-travel-toggle').click();
        await page.locator('#live-travel-map-open').click();
        await page.locator('#live-center-map').waitFor({ state: 'visible' });
        await compare('travel-' + size);
        await page.locator('#live-center-scene-tab').click();
      }
    }
  }
  await native.close();
  await native.finish({
    baselinePath,
    baselineHash: createHash('sha256').update(baseline).digest('hex'),
    comparisons,
  });
} catch (error) {
  await native.fail(error);
  throw error;
} finally {
  await native.dispose();
}
