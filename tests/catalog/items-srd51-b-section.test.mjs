import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  B_SECTION,
  bSectionSourceRows,
  validateBSectionSlice,
  validateBSectionPdfXml,
} from '../../tools/items-srd51-b-section.mjs';
import { normalizePdfText } from '../../tools/items-srd51-source-verify.mjs';

const fixture = new URL('../fixtures/items-srd51-b-section-poppler-25.03.xml', import.meta.url);
const xml = await readFile(fixture, 'utf8');
const receipt = JSON.parse(
  await readFile(
    new URL('../fixtures/items-srd51-b-section-poppler-25.03-receipt.json', import.meta.url),
    'utf8',
  ),
);
const dataRoot = new URL('../../src/features/catalog/data/', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, dataRoot), 'utf8'));
const [inventory, transcript] = await Promise.all([
  readJson('items-srd51-inventory.json'),
  readJson('items-srd51-transcript.json'),
]);
// This three-page fixture cannot independently establish the full 239-heading
// count. The opt-in full official PDF test derives that sequence separately.
const headings = Array.from({ length: 239 }, (_, index) => `Uncaptured heading ${index + 1}`);
headings.splice(
  16,
  17,
  'Bag of Tricks',
  ...B_SECTION.map((item) => item.name),
  'Candle of Invocation',
);
const checkXml = (value) => validateBSectionPdfXml(value, headings, normalizePdfText);

test('remaining B-section: complete original three-page XML hash, attribution and heading-block oracle', () => {
  assert.equal(
    receipt.sourcePdfSha256,
    '2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0',
  );
  assert.equal(receipt.sourcePdfBytes, 3158713);
  assert.equal(receipt.sourcePdfPages, 403);
  assert.equal(receipt.license, 'CC-BY-4.0');
  assert.equal(receipt.extractorVersion, '25.03.0');
  assert.deepEqual(receipt.physicalPages, [211, 212, 213]);
  assert.equal(createHash('sha256').update(xml).digest('hex'), receipt.xmlSha256);
  assert.equal(Buffer.byteLength(xml), receipt.xmlBytes);
  assert.equal(checkXml(xml).records, 15);
  assert.equal(inventory.expectedPrimaryOccurrences, 459);
  assert.equal(inventory.capturedPrimaryOccurrences, inventory.occurrences.length);
  assert.equal(inventory.complete, false);
  assert.equal(transcript.complete, false);
});

// Positive rows are checked in full by the central "items source package" test.
for (const item of B_SECTION) {
  test(`${item.name}: source record and occurrence damage fail closed`, () => {
    const faults = [
      (row) => row.description.pop(),
      (row) => row.description.push({ text: 'Invented extra rule.', occurrenceId: row.id }),
      (row) => (row.source.pdfPages = [999]),
      (row) => (row.attunement = 'unspecified'),
      (row) => (row.cost = { sourceText: '1 gp', copperPieces: 100 }),
    ];
    // Full field matrix once per comparator; every item still tests record and occurrence rejection.
    for (const mutate of item === B_SECTION[0] ? faults : faults.slice(0, 1)) {
      const copy = structuredClone(transcript);
      mutate(copy.records.find((row) => row.name === item.name));
      assert.throws(
        () => validateBSectionSlice(copy, inventory),
        /complete header\/prose\/table\/choice/,
      );
    }
    const copy = structuredClone(inventory);
    copy.occurrences.find((row) => row.sourceLabel === item.name).mergeIntoId =
      'srd51:magic-item:magic-items-a-z:14';
    assert.throws(
      () => validateBSectionSlice(transcript, copy),
      /occurrence identity\/page\/merge/,
    );
  });
}

test('Giant Strength: five table-owned rarity choices, six prose varieties and combined Stone/frost row', () => {
  const row = bSectionSourceRows().find(
    (row) => row.record.name === 'Belt of Giant Strength',
  ).record;
  const id = 'srd51:magic-item:magic-items-a-z:20';
  assert.deepEqual(row.rarity, {
    kind: 'varies',
    sourceText: 'rarity varies',
    choices: [
      ['Hill giant', 'rare'],
      ['Stone/frost giant', 'very-rare'],
      ['Fire giant', 'very-rare'],
      ['Cloud giant', 'legendary'],
      ['Storm giant', 'legendary'],
    ].map(([label, value], index) => ({
      variantId: `${id}#variant:${index + 1}`,
      label,
      value,
      occurrenceId: id,
    })),
  });
  assert.deepEqual(
    row.properties.map((p) => [p.name, p.description]),
    [
      ['Hill giant', '21 Rare'],
      ['Stone/frost giant', '23 Very rare'],
      ['Fire giant', '25 Very rare'],
      ['Cloud giant', '27 Legendary'],
      ['Storm giant', '29 Legendary'],
    ],
  );
  assert.match(
    row.description[1].text,
    /Six varieties.*look different, but they have the same effect/,
  );
  for (const mutate of [
    (row) => row.rarity.choices.reverse(),
    (row) => (row.rarity.choices[1].label = 'Stone giant'),
    (row) => (row.rarity.choices[1].value = 'rare'),
    (row) => (row.rarity.choices[1].variantId = `${id}#variant:6`),
    (row) => (row.properties[1].description = '25 Very rare'),
    (row) => (row.rarity = { kind: 'fixed', value: 'rare' }),
  ]) {
    const copy = structuredClone(transcript);
    mutate(copy.records.find((row) => row.id === id));
    assert.throws(() => validateBSectionSlice(copy, inventory), /table\/choice/);
  }
});

test('real XML rejects table reassignment, missing cross-page curse, lost bullets, signs and recharge', () => {
  for (const [from, to] of [
    ['Stone/frost', 'Stone'],
    ['23', '25'],
    ['berserk', 'calm'],
    ['disadvantage', 'advantage'],
    ['−100', '100'],
    ['long', 'short'],
    ['200', '400'],
    ['Dwarvish', 'Elvish'],
    ['•', ''],
  ]) {
    // Change text only, never a coordinate that could share the same number.
    const changed = xml.replace(new RegExp(`(>[^<]*)${from}([^<]*<)`), `$1${to}$2`);
    assert.notEqual(changed, xml, `fixture contains ${from}`);
    assert.throws(() => checkXml(changed), /complete heading-bounded/);
  }
  const extra = xml.replace(
    /(<text\b[^>]*><b>Boots of Elvenkind)/,
    '<text top="9999">Invented extra rule.</text>$1',
  );
  assert.notEqual(extra, xml);
  assert.throws(() => checkXml(extra), /complete heading-bounded/);
});

test('B-section exact footer/page policy and headings remain independent of high coordinates', () => {
  assert.equal(checkXml(xml.replace(/top="\d+"/g, 'top="1156"')).records, 15);
  assert.throws(() => checkXml(xml.replace('number="212"', 'number="999"')), /footer page number/);
  assert.throws(() => checkXml(xml.replaceAll('System', 'WrongSystem')), /exactly one SRD footer/);
  const wrong = [...headings];
  [wrong[18], wrong[19]] = [wrong[19], wrong[18]];
  assert.throws(() => validateBSectionPdfXml(xml, wrong, normalizePdfText), /boundary sequence/);
  const duplicate = xml.replace(/(<text\b[^>]*><b>Bead of Force[^<]*<\/b><\/text>)/, '$1$1');
  assert.notEqual(duplicate, xml);
  assert.throws(() => checkXml(duplicate), /exactly one heading/);
});
