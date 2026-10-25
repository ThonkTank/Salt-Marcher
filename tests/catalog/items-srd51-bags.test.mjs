import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  BAGS,
  bagsSourceRows,
  validateBagsSlice,
  validateBagsPdfXml,
} from '../../tools/items-srd51-bags.mjs';
import { normalizePdfText } from '../../tools/items-srd51-source-verify.mjs';

const xml = await readFile(
  new URL('../fixtures/items-srd51-bags-poppler-25.03.xml', import.meta.url),
  'utf8',
);
const receipt = JSON.parse(
  await readFile(
    new URL('../fixtures/items-srd51-bags-poppler-25.03-receipt.json', import.meta.url),
    'utf8',
  ),
);
const dataRoot = new URL('../../src/features/catalog/data/', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, dataRoot), 'utf8'));
const [transcript, inventory] = await Promise.all([
  readJson('items-srd51-transcript.json'),
  readJson('items-srd51-inventory.json'),
]);
// A narrow offline fixture does not contain all 239 headings. The full official
// PDF integration in items-srd51-source.test.mjs independently derives them.
const headings = Array.from({ length: 239 }, (_, index) => `Uncaptured heading ${index + 1}`);
headings.splice(12, 6, 'Arrow of Slaying', ...BAGS.map((item) => item.name), 'Bead of Force');
const checkXml = (value) => validateBagsPdfXml(value, headings, normalizePdfText);

test('Bags fixture is original hash-bound official three-page XML, not synthetic or a host claim', () => {
  assert.equal(
    receipt.sourcePdfSha256,
    '2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0',
  );
  assert.equal(receipt.sourcePdfBytes, 3158713);
  assert.equal(receipt.sourcePdfPages, 403);
  assert.equal(receipt.extractorVersion, '25.03.0');
  assert.equal(receipt.license, 'CC-BY-4.0');
  assert.deepEqual(receipt.physicalPages, [209, 210, 211]);
  assert.equal(createHash('sha256').update(xml).digest('hex'), receipt.xmlSha256);
  assert.equal(
    receipt.xmlSha256,
    '53d10bd6a4e56f6a28b1c9e33f8cfb63afe5ab4979e7ae8b546adb7de0b008bf',
  );
  assert.equal(Buffer.byteLength(xml), receipt.xmlBytes);
  assert.deepEqual(checkXml(xml), {
    records: 4,
    beansEffectRows: 12,
    tricksTables: 3,
    tricksCreatureRows: 24,
    derivedHeadingCount: 239,
    scope: 'complete-heading-bounded-stream-with-die-range-and-color-table-ownership',
  });
});

// Positive rows are checked in full by the central "items source package" test.
for (const item of BAGS) {
  test(`${item.name}: source record and occurrence damage fail closed`, () => {
    const faults = [
      (row) => row.description.splice(item.description.length - 1, 1),
      (row) => row.description.push({ text: 'Invented extra rule.', occurrenceId: row.id }),
      (row) => (row.id = 'srd51:magic-item:magic-items-a-z:999'),
      (row) => (row.source.pdfPages = [209]),
      (row) => (row.attunement = 'required'),
    ];
    // Full field matrix once per comparator; every item still tests record and occurrence rejection.
    for (const mutate of item === BAGS[0] ? faults : faults.slice(0, 1)) {
      const copy = structuredClone(transcript);
      const row = copy.records.find((row) => row.name === item.name);
      mutate(row);
      assert.throws(
        () => validateBagsSlice(copy, inventory),
        /complete header\/prose\/table ownership/,
      );
    }
    const copy = structuredClone(inventory);
    copy.occurrences.find((row) => row.sourceLabel === item.name).mergeIntoId =
      'srd51:equipment:adventuring-gear:1';
    assert.throws(() => validateBagsSlice(transcript, copy), /occurrence identity\/page\/merge/);
  });
}

test('Beans preserves twelve ordered source ranges including 00, exact odd/even and split-page egg outcome', () => {
  const row = bagsSourceRows()[0].record;
  assert.deepEqual(
    row.properties.map((row) => row.name),
    [
      '01',
      '02–10',
      '11–20',
      '21–30',
      '31–40',
      '41–50',
      '51–60',
      '61–70',
      '71–80',
      '81–90',
      '91–99',
      '00',
    ],
  );
  for (const mutate of [
    (row) => row.properties.pop(),
    (row) => (row.properties[11].name = '100'),
    (row) => (row.properties[9].description = 'A nest of 1d4 + 3 eggs springs up. Any creature'),
    (row) => (row.properties[0].description = row.properties[0].description.replace('odd', 'even')),
    (row) => row.properties.reverse(),
  ]) {
    const copy = structuredClone(transcript);
    mutate(copy.records.find((row) => row.id === 'srd51:magic-item:magic-items-a-z:14'));
    assert.throws(() => validateBagsSlice(copy, inventory), /table ownership/);
  }
});

test('Tricks retains all three color tables without flattening or invented variant records', () => {
  const row = bagsSourceRows()[3].record;
  assert.equal(row.properties.length, 24);
  assert.equal(row.properties[0].name, 'Gray Bag of Tricks: 1');
  assert.equal(row.properties[8].name, 'Rust Bag of Tricks: 1');
  assert.equal(row.properties[16].name, 'Tan Bag of Tricks: 1');
  const copy = structuredClone(transcript);
  const props = copy.records.find((row) => row.name === 'Bag of Tricks').properties;
  // Same multiset of creatures, wrong color/die ownership must still fail.
  [props[0].description, props[8].description] = [props[8].description, props[0].description];
  assert.throws(() => validateBagsSlice(copy, inventory), /table ownership/);
});

test('real Bags XML rejects changed range, partial split-page egg row, reordered color cells and extra body rules', () => {
  for (const [from, to] of [
    ['81–90', '81–91'],
    ['permanently', 'temporarily'],
    ['Weasel', 'Rat'],
    ['minimum', 'maximum'],
    ['friendly', 'hostile'],
  ]) {
    const changed = xml.replace(from, to);
    assert.notEqual(changed, xml, `fixture must contain ${from}`);
    assert.throws(() => checkXml(changed), /complete heading-bounded/);
  }
  const extra = xml.replace('<b>Bag of Holding', '<b>Invented rule. Bag of Holding');
  assert.notEqual(extra, xml);
  assert.throws(() => checkXml(extra), /heading bounds missing/);
  const swapped = xml
    .replace('Weasel', 'TEMP_SOURCE_CREATURE')
    .replace('Rat', 'Weasel')
    .replace('TEMP_SOURCE_CREATURE', 'Rat');
  assert.throws(() => checkXml(swapped), /complete heading-bounded/);
  const extraBody = xml.replace(
    /(<text\b[^>]*><b>Bag of Tricks)/,
    '<text top="9999">Invented extra rule.</text>$1',
  );
  assert.notEqual(extraBody, xml);
  assert.throws(() => checkXml(extraBody), /complete heading-bounded/);
});

test('Bags stream preserves body data with arbitrary high coordinates and rejects bad page/footer/heading', () => {
  assert.equal(checkXml(xml.replace(/top="\d+"/g, 'top="1156"')).records, 4);
  assert.throws(() => checkXml(xml.replace('number="210"', 'number="999"')), /footer page number/);
  assert.throws(() => checkXml(xml.replaceAll('System', 'WrongSystem')), /exactly one SRD footer/);
  const wrong = [...headings];
  [wrong[13], wrong[14]] = [wrong[14], wrong[13]];
  assert.throws(() => validateBagsPdfXml(xml, wrong, normalizePdfText), /boundary sequence/);
});
