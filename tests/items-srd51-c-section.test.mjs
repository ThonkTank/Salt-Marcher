import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  C_SECTION,
  cSectionSourceRows,
  validateCSectionSlice,
  validateCSectionPdfXml,
} from '../tools/items-srd51-c-section.mjs';
import { normalizePdfText } from '../tools/items-srd51-source-verify.mjs';

const xml = await readFile(
  new URL('./fixtures/items-srd51-c-section-poppler-25.03.xml', import.meta.url),
  'utf8',
);
const receipt = JSON.parse(
  await readFile(
    new URL('./fixtures/items-srd51-c-section-poppler-25.03-receipt.json', import.meta.url),
    'utf8',
  ),
);
const dataRoot = new URL('../src/features/catalog/data/', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, dataRoot), 'utf8'));
const [inventory, transcript] = await Promise.all([
  readJson('items-srd51-inventory.json'),
  readJson('items-srd51-transcript.json'),
]);
// Narrow fixture: full 239-heading sequence must independently be derived by
// the separate opt-in official PDF integration, not claimed from three pages.
const headings = Array.from({ length: 239 }, (_, i) => `Uncaptured heading ${i + 1}`);
headings.splice(
  31,
  17,
  'Broom of Flying',
  ...C_SECTION.map((item) => item.name),
  'Dagger of Venom',
);
const checkXml = (value) => validateCSectionPdfXml(value, headings, normalizePdfText);

test('C-section: original full three-page XML hash/license/footer and complete heading oracle', () => {
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
    '8934d79d1b7c9abaabb9376eb58a026d6843ed6b0cec3a7660bd16ec23cc9aaa',
  );
  assert.equal(createHash('sha256').update(xml).digest('hex'), receipt.xmlSha256);
  assert.equal(Buffer.byteLength(xml), receipt.xmlBytes);
  assert.deepEqual(receipt.physicalPages, [213, 214, 215]);
  assert.equal(checkXml(xml).records, 15);
});

// Positive rows are checked in full by the central "items source package" test.
for (const item of C_SECTION) {
  test(`${item.name}: source record and occurrence damage fail closed`, () => {
    const faults = [
      (row) => row.description.pop(),
      (row) => row.description.push({ text: 'Invented extra rule.', occurrenceId: row.id }),
      (row) => (row.source.pdfPages = [999]),
      (row) => (row.attunement = 'unspecified'),
      (row) => (row.sourceHeader.text = 'Wondrous item, common'),
    ];
    // Full field matrix once per comparator; every item still tests record and occurrence rejection.
    for (const mutate of item === C_SECTION[0] ? faults : faults.slice(0, 1)) {
      const copy = structuredClone(transcript);
      mutate(copy.records.find((row) => row.name === item.name));
      assert.throws(
        () => validateCSectionSlice(copy, inventory),
        /complete header\/prose\/table\/choice/,
      );
    }
    const copy = structuredClone(inventory);
    copy.occurrences.find((row) => row.sourceLabel === item.name).mergeIntoId =
      'srd51:magic-item:magic-items-a-z:32';
    assert.throws(
      () => validateCSectionSlice(transcript, copy),
      /occurrence identity\/page\/merge/,
    );
  });
}

test('Crystal Ball: typical very-rare and three source-ordered legendary variants belong to one occurrence', () => {
  const id = 'srd51:magic-item:magic-items-a-z:45';
  const row = cSectionSourceRows().find((row) => row.record.id === id).record;
  assert.deepEqual(row.rarity, {
    kind: 'varies',
    sourceText: 'very rare or legendary',
    choices: [
      ['typical crystal ball', 'very-rare'],
      ['Crystal Ball of Mind Reading', 'legendary'],
      ['Crystal Ball of Telepathy', 'legendary'],
      ['Crystal Ball of True Seeing', 'legendary'],
    ].map(([label, value], i) => ({
      variantId: `${id}#variant:${i + 1}`,
      label,
      value,
      occurrenceId: id,
    })),
  });
  assert.deepEqual(row.source.pdfPages, [214, 215]);
  assert.equal(row.description.length, 5);
  assert.match(row.description[3].text, /ends if scrying ends.*next dawn/);
  for (const mutate of [
    (row) => row.rarity.choices.reverse(),
    (row) => (row.rarity.choices[0].value = 'legendary'),
    (row) => (row.rarity.choices[1].variantId = `${id}#variant:4`),
    (row) => (row.rarity = { kind: 'fixed', value: 'very-rare' }),
    (row) => (row.description[4].text = 'Only 30 feet of truesight.'),
  ]) {
    const copy = structuredClone(transcript);
    mutate(copy.records.find((row) => row.id === id));
    assert.throws(() => validateCSectionSlice(copy, inventory), /table\/choice/);
  }
});

test('Candle, Carpet and Cube preserve roll/size/capacity/speed/face/charge-loss ownership and table positions', () => {
  const rows = cSectionSourceRows().map((row) => row.record);
  const candle = rows[0],
    carpet = rows[2],
    cube = rows[13];
  assert.equal(candle.properties.length, 9);
  assert.deepEqual(
    candle.properties.map((p) => p.name),
    ['1–2', '3–4', '5–7', '8–9', '10–11', '12–13', '14–15', '16–17', '18–20'].map(
      (roll) => `d20 Alignment: ${roll}`,
    ),
  );
  assert.deepEqual(
    carpet.properties.map((p) => p.description),
    [
      '3 ft. × 5 ft. 200 lb. 80 feet',
      '4 ft. × 6 ft. 400 lb. 60 feet',
      '5 ft. × 7 ft. 600 lb. 40 feet',
      '6 ft. × 9 ft. 800 lb. 30 feet',
    ],
  );
  assert.equal(cube.properties.length, 11);
  assert.equal(cube.properties[5].description, '0 The barrier deactivates.');
  assert.deepEqual(
    cube.properties.slice(6).map((p) => p.description),
    ['1d12', '1d10', '1d6', '1d20', '1d4'],
  );
  for (const name of [candle.name, carpet.name, cube.name]) {
    for (const mutate of [
      (row) => row.properties.reverse(),
      (row) =>
        ([row.properties[0].description, row.properties[1].description] = [
          row.properties[1].description,
          row.properties[0].description,
        ]),
      (row) => row.description.reverse(),
    ]) {
      const copy = structuredClone(transcript);
      mutate(copy.records.find((row) => row.name === name));
      assert.throws(() => validateCSectionSlice(copy, inventory), /table\/choice/);
    }
  }
});

test('real XML rejects changed die ranges, capacity, variant truth, clauses, bullets and charge loss', () => {
  const start = xml.indexOf('<b>Candle of Invocation');
  assert.ok(start > 0);
  for (const [from, to] of [
    ['21–55', '21–56'],
    ['200', '400'],
    ['legendary', 'rare'],
    ['incapacitated', 'invisible'],
    ['ten', 'nine'],
    ['1d12', '1d6'],
    ['•', ''],
    ['concentrate', 'focus'],
  ]) {
    // Full pages also contain the preceding Broom's 200-pound clause. Only
    // mutate the claimed C interval, not intentionally out-of-scope text.
    const changed =
      xml.slice(0, start) +
      xml.slice(start).replace(new RegExp(`(>[^<]*)${from}([^<]*<)`), `$1${to}$2`);
    assert.notEqual(changed, xml, `fixture contains ${from}`);
    assert.throws(() => checkXml(changed), /complete heading-bounded/, `reject changed ${from}`);
  }
  const extra = xml.replace(
    /(<text\b[^>]*><b>Cubic Gate)/,
    '<text top="9999">Invented extra rule.</text>$1',
  );
  assert.notEqual(extra, xml);
  assert.throws(() => checkXml(extra), /complete heading-bounded/);
});

test('C-section retains real whitespace/punctuation and exact footer/page policy independent of coordinates', () => {
  assert.equal(checkXml(xml.replace(/top="\d+"/g, 'top="1156"')).records, 15);
  assert.throws(() => checkXml(xml.replace('number="214"', 'number="999"')), /footer page number/);
  assert.throws(() => checkXml(xml.replaceAll('System', 'WrongSystem')), /exactly one SRD footer/);
  const wrong = [...headings];
  [wrong[44], wrong[45]] = [wrong[45], wrong[44]];
  assert.throws(() => validateCSectionPdfXml(xml, wrong, normalizePdfText), /boundary sequence/);
  const duplicate = xml.replace(/(<text\b[^>]*><b>Crystal Ball[^<]*<\/b><\/text>)/, '$1$1');
  assert.notEqual(duplicate, xml);
  assert.throws(() => checkXml(duplicate), /exactly one heading/);
});
