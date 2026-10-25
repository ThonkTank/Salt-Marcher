import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  D_SECTION,
  dSectionSourceRows,
  validateDSectionSlice,
  validateDSectionPdfXml,
} from '../tools/items-srd51-d-section.mjs';
import { normalizePdfText } from '../tools/items-srd51-source-verify.mjs';

const xml = await readFile(
  new URL('./fixtures/items-srd51-d-section-poppler-25.03.xml', import.meta.url),
  'utf8',
);
const receipt = JSON.parse(
  await readFile(
    new URL('./fixtures/items-srd51-d-section-poppler-25.03-receipt.json', import.meta.url),
    'utf8',
  ),
);
const root = new URL('../src/features/catalog/data/', import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const [inventory, transcript] = await Promise.all([
  readJson('items-srd51-inventory.json'),
  readJson('items-srd51-transcript.json'),
]);
// Six-page snapshot does not prove the full 239-heading sequence. The opt-in
// official-PDF source integration independently derives that complete stream.
const headings = Array.from({ length: 239 }, (_, i) => `Uncaptured heading ${i + 1}`);
headings.splice(46, 17, 'Cubic Gate', ...D_SECTION.map((item) => item.name), 'Efficient Quiver');
const checkXml = (value) => validateDSectionPdfXml(value, headings, normalizePdfText);
const rows = dSectionSourceRows();
const rowNamed = (name) => rows.find((row) => row.record.name === name).record;
const mutateRecord = (name, mutate) => {
  const copy = structuredClone(transcript);
  mutate(copy.records.find((row) => row.name === name));
  assert.throws(
    () => validateDSectionSlice(copy, inventory),
    /complete header\/prose\/table\/statblock/,
  );
};

test('D-section: original six-page XML identity/license and full heading oracle', () => {
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
    'e98d58f51a63730f5be255a237c4e61da4776ca3e29e3300cc767d09a8f9f924',
  );
  assert.equal(createHash('sha256').update(xml).digest('hex'), receipt.xmlSha256);
  assert.equal(Buffer.byteLength(xml), receipt.xmlBytes);
  assert.deepEqual(receipt.physicalPages, [215, 216, 217, 218, 219, 220]);
  assert.equal(checkXml(xml).records, 15);
});

// Positive rows are checked in full by the central "items source package" test.
for (const item of D_SECTION) {
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
    for (const mutate of item === D_SECTION[0] ? faults : faults.slice(0, 1)) {
      mutateRecord(item.name, mutate);
    }
    if (item === D_SECTION[0] && rowNamed(item.name).description.length > 1)
      mutateRecord(item.name, (row) => row.description.reverse());
    const copy = structuredClone(inventory);
    copy.occurrences.find((row) => row.sourceLabel === item.name).mergeIntoId =
      'srd51:magic-item:magic-items-a-z:47';
    assert.throws(
      () => validateDSectionSlice(transcript, copy),
      /occurrence identity\/page\/merge/,
    );
  });
}

test('Both Decks retain owned suit/card mappings, duplicate illusions, jokers and 13-vs-22 footnote', () => {
  const illusions = rowNamed('Deck of Illusions'),
    many = rowNamed('Deck of Many Things');
  assert.equal(illusions.properties.length, 33); // Jokers(2) is one physical row.
  assert.equal(many.properties.length, 22);
  assert.equal(illusions.properties.at(-1).description, 'You (the deck’s owner)');
  assert.equal(illusions.properties.filter((row) => row.description === 'Goblin').length, 2);
  assert.equal(illusions.properties.filter((row) => row.description === 'Kobold').length, 2);
  assert.equal(many.properties.filter((row) => row.description.endsWith('*')).length, 9);
  assert.ok(
    many.description.some((row) => row.text === '*Found only in a deck with twenty-two cards'),
  );
  for (const name of [illusions.name, many.name]) {
    for (const mutate of [
      (row) => row.properties.reverse(),
      (row) => row.properties.pop(),
      (row) =>
        ([row.properties[0].description, row.properties[1].description] = [
          row.properties[1].description,
          row.properties[0].description,
        ]),
    ])
      mutateRecord(name, mutate);
  }
  mutateRecord(
    many.name,
    (row) => (row.description = row.description.filter((p) => !p.text.startsWith('*Found'))),
  );
});

test('Many Things preserves all22 complete card rules and embedded statblock as one item occurrence', () => {
  const row = rowNamed('Deck of Many Things');
  const cards = [
    'Balance',
    'Comet',
    'Donjon',
    'Euryale',
    'The Fates',
    'Flames',
    'Fool',
    'Gem',
    'Idiot',
    'Jester',
    'Key',
    'Knight',
    'Moon',
    'Rogue',
    'Ruin',
    'Skull',
    'Star',
    'Sun',
    'Talons',
    'Throne',
    'Vizier',
    'The Void',
  ];
  for (const name of cards) {
    assert.equal(row.description.filter((p) => p.text.startsWith(`${name}.`)).length, 1);
    mutateRecord(
      row.name,
      (r) => (r.description = r.description.filter((p) => !p.text.startsWith(`${name}.`))),
    );
  }
  assert.ok(
    row.description.some((p) => p.text === 'Hit Points half the hit point maximum of its summoner'),
  );
  assert.ok(row.description.some((p) => p.text === 'Challenge — (0 XP)'));
  assert.match(
    row.description.find((p) => p.text.startsWith('Reaping Scythe.')).text,
    /7 \(1d8 \+ 3\).*4 \(1d8\)/,
  );
  assert.equal(
    inventory.occurrences.some((p) => p.sourceLabel === 'Avatar of Death'),
    false,
  );
  assert.equal(
    transcript.records.some((p) => p.name === 'Avatar of Death'),
    false,
  );
  mutateRecord(
    row.name,
    (r) => (r.description = r.description.filter((p) => p.text !== 'Avatar of Death')),
  );
  mutateRecord(
    row.name,
    (r) =>
      (r.description.find((p) => p.text.startsWith('Challenge')).text = 'Challenge 1 (200 XP)'),
  );
});

test('Dragon table keeps ten type/resistance cells and five physical paired rows without rarity variants', () => {
  const row = rowNamed('Dragon Scale Mail');
  assert.deepEqual(
    row.properties.map((p) => p.description),
    ['Acid', 'Lightning', 'Fire', 'Lightning', 'Acid', 'Fire', 'Poison', 'Fire', 'Cold', 'Cold'],
  );
  assert.ok(row.description.some((p) => p.text === 'Black Acid Gold Fire'));
  assert.equal(row.rarity.kind, 'fixed');
  mutateRecord(
    row.name,
    (r) =>
      ([r.properties[0].description, r.properties[6].description] = [
        r.properties[6].description,
        r.properties[0].description,
      ]),
  );
  mutateRecord(
    row.name,
    (r) =>
      (r.description.find((p) => p.text === 'Black Acid Gold Fire').text = 'Black Fire Gold Acid'),
  );
});

test('Conditional attunement and Dancing Sword page continuation stay exact', () => {
  const row = rowNamed('Dwarven Thrower');
  assert.equal(row.attunement, 'required');
  assert.equal(
    row.sourceHeader.text,
    'Weapon (warhammer), very rare (requires attunement by a dwarf)',
  );
  mutateRecord(
    row.name,
    (r) => (r.sourceHeader.text = 'Weapon (warhammer), very rare (requires attunement)'),
  );
  assert.deepEqual(rowNamed('Dancing Sword').source.pdfPages, [215, 216]);
});

test('Real XML rejects changed table ownership, card rules, avatar numbers, clauses and source punctuation', () => {
  const start = xml.indexOf('<b>Dagger of Venom'),
    end = xml.indexOf('<b>Efficient Quiver');
  assert.ok(start > 0 && end > start);
  for (const [from, to] of [
    ['poisoned', 'invisible'],
    ['fourth', 'third'],
    ['•', ''],
    ['succubus', 'incubus'],
    ['Vizier', 'Sun'],
    ['−2', '2'],
    ['incapacitated', 'invisible'],
    ['1d10', '1d6'],
    ['unconscious', 'conscious'],
    ['dwarf', 'elf'],
    ['Acid', 'Cold'],
  ]) {
    const segment = xml.slice(start, end);
    const changed = segment.replace(new RegExp(`(>[^<]*)${from}([^<]*<)`, 'i'), `$1${to}$2`);
    assert.notEqual(changed, segment, `fixture contains ${from}`);
    assert.throws(
      () => checkXml(xml.slice(0, start) + changed + xml.slice(end)),
      /complete heading-bounded/,
      `reject changed ${from}`,
    );
  }
  const extra = xml.replace(
    /(<text\b[^>]*><b>Defender)/,
    '<text top="9999">Invented extra rule.</text>$1',
  );
  assert.notEqual(extra, xml);
  assert.throws(() => checkXml(extra), /complete heading-bounded/);
});

test('D-section footer/coordinate/heading gates never truncate low body or accept missing continuation', () => {
  assert.equal(checkXml(xml.replace(/top="\d+"/g, 'top="1156"')).records, 15);
  assert.throws(() => checkXml(xml.replace('number="217"', 'number="999"')), /footer page number/);
  assert.throws(() => checkXml(xml.replaceAll('System', 'WrongSystem')), /exactly one SRD footer/);
  const wrong = [...headings];
  [wrong[51], wrong[52]] = [wrong[52], wrong[51]];
  assert.throws(() => validateDSectionPdfXml(xml, wrong, normalizePdfText), /boundary sequence/);
  const duplicate = xml.replace(/(<text\b[^>]*><b>Deck of Many Things[^<]*<\/b><\/text>)/, '$1$1');
  assert.notEqual(duplicate, xml);
  assert.throws(() => checkXml(duplicate), /exactly one heading/);
  const missingPage = xml.replace(/<page number="217"[\s\S]*?<\/page>/, '');
  assert.notEqual(missingPage, xml);
  assert.throws(() => checkXml(missingPage), /physical page span/);
});

test('Real XML rejects resistance-cell swaps even with an unchanged damage-type multiset', () => {
  const start = xml.indexOf('<b>Dragon Scale Mail'),
    end = xml.indexOf('<b>Dragon Slayer');
  assert.ok(start > 0 && end > start);
  const segment = xml.slice(start, end);
  const swapped = segment
    .replace('Acid', '__ACID_CELL__')
    .replace('Fire', 'Acid')
    .replace('__ACID_CELL__', 'Fire');
  assert.notEqual(swapped, segment);
  assert.deepEqual(
    swapped.match(/Acid|Fire|Lightning|Poison|Cold/g).sort(),
    segment.match(/Acid|Fire|Lightning|Poison|Cold/g).sort(),
  );
  assert.throws(
    () => checkXml(xml.slice(0, start) + swapped + xml.slice(end)),
    /complete heading-bounded/,
  );
});
