import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  E_SECTION,
  eSectionSourceRows,
  validateESectionSlice,
  validateESectionPdfXml,
} from '../tools/items-srd51-e-section.mjs';
import { normalizePdfText } from '../tools/items-srd51-source-verify.mjs';

const xml = await readFile(
  new URL('./fixtures/items-srd51-e-section-poppler-25.03.xml', import.meta.url),
  'utf8',
);
const receipt = JSON.parse(
  await readFile(
    new URL('./fixtures/items-srd51-e-section-poppler-25.03-receipt.json', import.meta.url),
    'utf8',
  ),
);
const root = new URL('../src/features/catalog/data/', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const [inventory, transcript] = await Promise.all([
  readJson('items-srd51-inventory.json'),
  readJson('items-srd51-transcript.json'),
]);
// Two-page snapshot does not prove the full 239-heading sequence. The opt-in
// official-PDF source integration independently derives that complete stream.
const headings = Array.from({ length: 239 }, (_, i) => `Uncaptured heading ${i + 1}`);
headings.splice(61, 10, 'Dwarven Thrower', ...E_SECTION.map((item) => item.name), 'Feather Token');
const checkXml = (value) => validateESectionPdfXml(value, headings, normalizePdfText);
const rows = eSectionSourceRows();
const rowNamed = (name) => rows.find((row) => row.record.name === name).record;
const mutateRecord = (name, mutate) => {
  const copy = structuredClone(transcript);
  mutate(copy.records.find((row) => row.name === name));
  assert.throws(() => validateESectionSlice(copy, inventory), /complete header\/prose\/table/);
};

test('E-section: original two-page XML identity/license and full heading oracle', () => {
  assert.equal(
    receipt.sourcePdfSha256,
    '2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0',
  );
  assert.equal(receipt.sourcePdfBytes, 3158713);
  assert.equal(receipt.sourcePdfPages, 403);
  assert.equal(receipt.extractorVersion, '25.03.0');
  assert.equal(receipt.license, 'CC-BY-4.0');
  assert.equal(
    receipt.xmlSha256,
    'a2213f5b16d9f1fd64bb96ef06ee9c0070e21fd6d400764971bc3641d4f14780',
  );
  assert.equal(createHash('sha256').update(xml).digest('hex'), receipt.xmlSha256);
  assert.equal(Buffer.byteLength(xml), receipt.xmlBytes);
  assert.deepEqual(receipt.physicalPages, [220, 221]);
  assert.equal(checkXml(xml).records, 8);
});

// Positive rows are checked in full by the central "items source package" test.
for (const item of E_SECTION) {
  test(`${item.name}: source record and occurrence damage fail closed`, () => {
    const faults = [
      (row) => row.description.pop(),
      (row) => row.description.push({ text: 'Invented extra rule.', occurrenceId: row.id }),
      (row) => (row.source.pdfPages = [999]),
      (row) => (row.attunement = 'unspecified'),
      (row) => (row.sourceHeader.text = 'Wondrous item, common'),
      (row) => (row.rarity.value = 'artifact'),
    ];
    // Full field matrix once per comparator; every item still tests record and occurrence rejection.
    for (const mutate of item === E_SECTION[0] ? faults : faults.slice(0, 1)) {
      mutateRecord(item.name, mutate);
    }
    if (item === E_SECTION[0] && rowNamed(item.name).description.length > 1)
      mutateRecord(item.name, (row) => row.description.reverse());
    const copy = structuredClone(inventory);
    copy.occurrences.find((row) => row.sourceLabel === item.name).mergeIntoId =
      'srd51:magic-item:magic-items-a-z:62';
    assert.throws(
      () => validateESectionSlice(transcript, copy),
      /occurrence identity\/page\/merge/,
    );
  });
}

test('Efreeti retains all d100 ranges, 00, fourth opening and limited wishes without rarity variants', () => {
  const row = rowNamed('Efreeti Bottle');
  assert.deepEqual(
    row.properties.map((p) => p.name),
    ['d100 Effect: 01–10', 'd100 Effect: 11–90', 'd100 Effect: 91–00'],
  );
  assert.match(row.properties[1].description, /24 hours.*next two times.*fourth time/);
  assert.match(row.properties[2].description, /three times.*final wish or after 1 hour/);
  assert.deepEqual(row.rarity, { kind: 'fixed', value: 'very-rare' });
  for (const mutate of [
    (r) => r.properties.reverse(),
    (r) => r.properties.pop(),
    (r) =>
      ([r.properties[0].description, r.properties[1].description] = [
        r.properties[1].description,
        r.properties[0].description,
      ]),
    (r) =>
      (r.description.find((p) => p.text.startsWith('91–00')).text = '91–100 Unlimited wishes.'),
  ])
    mutateRecord(row.name, mutate);
});

test('Elemental Gem retains four owned mappings without invented item variants', () => {
  const row = rowNamed('Elemental Gem');
  assert.deepEqual(
    row.properties.map((p) => [p.name, p.description]),
    [
      ['Blue sapphire', 'Air elemental'],
      ['Yellow diamond', 'Earth elemental'],
      ['Red corundum', 'Fire elemental'],
      ['Emerald', 'Water elemental'],
    ].map(([gem, effect]) => [`Gem Summoned Elemental: ${gem}`, effect]),
  );
  assert.equal(row.rarity.kind, 'fixed');
  assert.equal(inventory.occurrences.filter((p) => p.sourceLabel === 'Elemental Gem').length, 1);
  mutateRecord(
    row.name,
    (r) =>
      ([r.properties[0].description, r.properties[1].description] = [
        r.properties[1].description,
        r.properties[0].description,
      ]),
  );
  mutateRecord(row.name, (r) => r.description.reverse());
});

test('Eyes continue across pages with mutual sight, humanoid target, recharge and distinct attunement', () => {
  const row = rowNamed('Eyes of Charming');
  assert.deepEqual(row.source.pdfPages, [220, 221]);
  assert.equal(row.attunement, 'required');
  assert.match(
    row.description[0].text,
    /humanoid.*you and the target can see each other.*daily at dawn/,
  );
  assert.equal(rowNamed('Eyes of Minute Seeing').attunement, 'not-required');
  assert.equal(rowNamed('Eyes of the Eagle').attunement, 'required');
  mutateRecord(row.name, (r) => (r.source.pdfPages = [220]));
});

test('Real XML rejects changed ranges, smoke boundaries, capacities and sight/recharge rules', () => {
  const start = xml.indexOf('<b>Efficient Quiver'),
    end = xml.indexOf('<b>Feather Token');
  assert.ok(start > 0 && end > start);
  for (const [from, to] of [
    ['sixty', 'six'],
    ['91–00', '91–99'],
    ['fourth', 'third'],
    ['24', '48'],
    ['120', '240'],
    ['21', '22'],
    ['humanoid', 'creature'],
    ['dawn', 'dusk'],
    ['other', 'strangers'],
  ]) {
    const segment = xml.slice(start, end);
    const changed = segment.replace(new RegExp(`(>[^<]*)${from}([^<]*<)`), `$1${to}$2`);
    assert.notEqual(changed, segment, `fixture contains ${from}`);
    assert.throws(
      () => checkXml(xml.slice(0, start) + changed + xml.slice(end)),
      /complete heading-bounded/,
      `reject changed ${from}`,
    );
  }
  const extra = xml.replace(
    /(<text\b[^>]*><b>Elven Chain)/,
    '<text top="9999">Invented extra rule.</text>$1',
  );
  assert.notEqual(extra, xml);
  assert.throws(() => checkXml(extra), /complete heading-bounded/);
});

test('Real XML rejects gem ownership swaps despite an unchanged elemental multiset', () => {
  const start = xml.indexOf('<b>Elemental Gem'),
    end = xml.indexOf('<b>Elven Chain');
  assert.ok(start > 0 && end > start);
  const segment = xml.slice(start, end);
  const swapped = segment
    .replace('Air', '__AIR_CELL__')
    .replace('Earth', 'Air')
    .replace('__AIR_CELL__', 'Earth');
  assert.notEqual(swapped, segment);
  assert.deepEqual(
    swapped.match(/Air|Earth|Fire|Water/g).sort(),
    segment.match(/Air|Earth|Fire|Water/g).sort(),
  );
  assert.throws(
    () => checkXml(xml.slice(0, start) + swapped + xml.slice(end)),
    /complete heading-bounded/,
  );
});

test('E-section coordinate/footer/heading gates retain all source text and reject lost page', () => {
  assert.equal(checkXml(xml.replace(/top="\d+"/g, 'top="1156"')).records, 8);
  assert.throws(() => checkXml(xml.replace('number="221"', 'number="999"')), /footer page number/);
  assert.throws(() => checkXml(xml.replaceAll('System', 'WrongSystem')), /exactly one SRD footer/);
  const wrong = [...headings];
  [wrong[63], wrong[64]] = [wrong[64], wrong[63]];
  assert.throws(() => validateESectionPdfXml(xml, wrong, normalizePdfText), /boundary sequence/);
  const duplicate = xml.replace(/(<text\b[^>]*><b>Elemental Gem[^<]*<\/b><\/text>)/, '$1$1');
  assert.notEqual(duplicate, xml);
  assert.throws(() => checkXml(duplicate), /exactly one heading/);
  const missingPage = xml.replace(/<page number="221"[\s\S]*?<\/page>/, '');
  assert.notEqual(missingPage, xml);
  assert.throws(() => checkXml(missingPage), /heading bounds|physical page span/);
});
