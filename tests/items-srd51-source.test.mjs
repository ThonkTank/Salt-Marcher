import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ARMOR_ARROWS,
  armorArrowsSourceRows,
  validateArmorArrowsSlice,
  validateArmorArrowsPdfXml,
} from '../tools/items-srd51-armor-arrows.mjs';
import {
  extractApparatusLeverCellsFromPdfXml,
  normalizePdfText,
  extractMagicItemAzHeadingsFromPdfXml,
  validateBoundedAdventuringGearTableRows,
  validateBoundedArmorTableRows,
  validateBoundedMountsTableRows,
  validateBoundedTackTableRows,
  validateBoundedToolsTableRows,
  validateBoundedWaterborneTableRows,
  validateBoundedWeaponTableRows,
  validateJsonSchemas,
  validateMagicItemAzApparatusOfTheCrab,
  validateMagicItemAzArmorOfInvulnerability,
  validateMagicItemAzArmorPlusOneTwoThree,
  validateMagicItemAzAnimatedShield,
  validateMagicItemAzOpeningSlice,
  validatePotionHealingMerge,
  validateTranscriptData,
  verifyItemsSourcePackage,
} from '../tools/items-srd51-source-verify.mjs';

const dataRoot = new URL('../src/features/catalog/data/', import.meta.url);

const occurrence = Object.freeze({
  id: 'srd51:magic-item:magic-items-a-z:2',
  feed: 'magic-item',
  sectionId: 'magic-items-a-z',
  sourceKind: 'detail-heading',
  sourceTable: 'Magic Items A–Z',
  sourceLabel: 'Ammunition, +1, +2, or +3',
  firstPdfPage: 207,
  lastPdfPage: 207,
  firstPrintedPage: 207,
  lastPrintedPage: 207,
  ordinal: 2,
  variantId: null,
  mergeIntoId: null,
});

function transcript(rarity) {
  return {
    schemaVersion: 1,
    complete: true,
    source: {},
    records: [
      {
        id: occurrence.id,
        name: occurrence.sourceLabel,
        category: 'magic-item',
        magic: true,
        rarity,
        attunement: 'not-required',
        properties: [],
        description: [{ text: 'Beleg', occurrenceId: occurrence.id }],
        source: { pdfPages: [207], printedPages: [207], occurrenceIds: [occurrence.id] },
      },
    ],
  };
}

function inventory(...occurrences) {
  return {
    inventoryVersion: 1,
    complete: true,
    expectedPrimaryOccurrences: occurrences.length,
    capturedPrimaryOccurrences: occurrences.length,
    sections: [
      {
        id: 'magic-items-a-z',
        feed: 'magic-item',
        sourceKind: 'detail-heading',
        firstPdfPage: 207,
        lastPdfPage: 207,
        firstPrintedPage: 207,
        lastPrintedPage: 207,
        expectedOccurrences: occurrences.length,
        capturedOccurrences: occurrences.length,
        complete: true,
      },
    ],
    occurrences,
    crossReferences: [],
    helperDispositions: [],
  };
}

test('items source package is explicitly incomplete and fails closed by default', async () => {
  await assert.rejects(verifyItemsSourcePackage(), /S01 ist unvollständig/);
  const result = await verifyItemsSourcePackage({ allowIncomplete: true });
  assert.equal(result.complete, false);
  assert.equal(result.validation.occurrenceCount, 291);
  assert.equal(result.validation.recordCount, 290);
  assert.deepEqual(result.magicItemAzOpeningSlice, {
    capturedRecords: 5,
    physicalPdfPage: 207,
    fixedRarities: 4,
    variableRarityChoices: 3,
    attunementRequired: 3,
    attunementNotRequired: 2,
  });
  assert.deepEqual(result.magicItemAzAnimatedShield, {
    id: 'srd51:magic-item:magic-items-a-z:6',
    ordinal: 6,
    physicalPdfPage: 208,
    rarity: 'very-rare',
    attunement: 'required',
  });
  assert.deepEqual(result.magicItemAzApparatusOfTheCrab, {
    id: 'srd51:magic-item:magic-items-a-z:7',
    ordinal: 7,
    physicalPdfPage: 208,
    rarity: 'legendary',
    attunement: 'not-required',
    descriptionFacts: 11,
    leverRows: 10,
    leverCells: 20,
  });
  assert.deepEqual(result.magicItemAzArmorPlusOneTwoThree, {
    id: 'srd51:magic-item:magic-items-a-z:8',
    ordinal: 8,
    physicalPdfPage: 208,
    attunement: 'not-required',
    variableRarityChoices: 3,
    descriptionFacts: 1,
  });
  assert.deepEqual(result.magicItemAzArmorOfInvulnerability, {
    id: 'srd51:magic-item:magic-items-a-z:9',
    ordinal: 9,
    physicalPdfPage: 208,
    rarity: 'legendary',
    attunement: 'required',
    descriptionFacts: 1,
  });
  assert.equal(result.magicItemAzArmorArrows.records, 4);
  assert.equal(result.magicItemAzArmorArrows.resistanceTableRows, 10);
  assert.equal(result.magicItemAzBags.records, 4);
  assert.equal(result.magicItemAzBags.beansEffectRows, 12);
  assert.equal(result.magicItemAzBags.tricksCreatureRows, 24);
  assert.equal(result.magicItemAzBSection.records, 15);
  assert.equal(result.magicItemAzBSection.beltRarityChoices, 5);
  assert.equal(result.magicItemAzCSection.records, 15);
  assert.equal(result.magicItemAzCSection.crystalBallChoices, 4);
  assert.equal(result.magicItemAzCSection.cubeFaceRows, 6);
  assert.equal(result.magicItemAzDSection.records, 15);
  assert.equal(result.magicItemAzDSection.manyThingsCardRules, 22);
  assert.equal(result.magicItemAzDSection.embeddedAvatarStatblocks, 1);
  assert.equal(result.magicItemAzESection.records, 8);
  assert.equal(result.magicItemAzESection.efreetiEffectRows, 3);
  assert.equal(result.magicItemAzESection.elementalGemRows, 4);
  assert.deepEqual(result.potionHealingMerge, {
    canonicalId: 'srd51:equipment:adventuring-gear:76',
    detailId: 'srd51:magic-item:magic-items-a-z:142',
    mergedRecords: 1,
    rarityChoices: 4,
    healingRows: 4,
  });
  assert.ok(result.blockers.length >= 5);
});

for (const item of ARMOR_ARROWS) {
  test(`${item.name} preserves complete source facts and rejects identity/fact drift`, async () => {
    const inventory = JSON.parse(await readFile(new URL('items-srd51-inventory.json', dataRoot)));
    const transcript = JSON.parse(await readFile(new URL('items-srd51-transcript.json', dataRoot)));
    const id = `srd51:magic-item:magic-items-a-z:${item.ordinal}`;
    // Each row keeps independent occurrence/record probes; shared field variants run once.
    const occurrenceFaults = [
      (row) => row.ordinal++,
      (row) => row.lastPdfPage++,
      (row) => (row.mergeIntoId = 'srd51:magic-item:magic-items-a-z:9'),
      (row) => (row.sourceLabel += ' wrong'),
    ];
    for (const mutate of item === ARMOR_ARROWS[0]
      ? occurrenceFaults
      : occurrenceFaults.slice(0, 1)) {
      const damaged = structuredClone(inventory);
      mutate(damaged.occurrences.find((row) => row.id === id));
      assert.throws(() => validateArmorArrowsSlice(transcript, damaged), /occurrence identity/);
    }
    const recordFaults = [
      (row) => (row.description[0].text = row.description[0].text.slice(0, -15)),
      (row) => (row.sourceHeader.text += ' wrong'),
      (row) => (row.rarity.value = 'common'),
      (row) => (row.attunement = 'unspecified'),
      (row) => (row.description[0].occurrenceId = 'srd51:magic-item:magic-items-a-z:9'),
      (row) => (row.source.pdfPages = [207]),
      (row) => (row.cost = { sourceText: '1 gp', copperPieces: 100 }),
    ];
    for (const mutate of item === ARMOR_ARROWS[0] ? recordFaults : recordFaults.slice(0, 1)) {
      const damaged = structuredClone(transcript);
      mutate(damaged.records.find((row) => row.id === id));
      assert.throws(() => validateArmorArrowsSlice(damaged, inventory), /full header/);
    }
  });
}

test('Armor of Resistance retains all ten die-bound damage choices without inventing rarity variants', () => {
  const row = armorArrowsSourceRows()[0].record;
  assert.deepEqual(
    row.properties.map((p) => [p.name, p.description]),
    [
      ['1', 'Acid'],
      ['2', 'Cold'],
      ['3', 'Fire'],
      ['4', 'Force'],
      ['5', 'Lightning'],
      ['6', 'Necrotic'],
      ['7', 'Poison'],
      ['8', 'Psychic'],
      ['9', 'Radiant'],
      ['10', 'Thunder'],
    ],
  );
  const inventory = { occurrences: armorArrowsSourceRows().map((row) => row.occurrence) };
  for (const mutate of [(p) => p.reverse(), (p) => p.pop(), (p) => (p[0].description = 'Poison')]) {
    const records = armorArrowsSourceRows().map((row) => row.record);
    mutate(records[0].properties);
    assert.throws(() => validateArmorArrowsSlice({ records }, inventory), /full header/);
  }
  assert.deepEqual(row.rarity, { kind: 'fixed', value: 'rare' });
});

function armorArrowsXmlFixture() {
  const text = (value) => `<text top="100">${value.replaceAll('&', '&amp;')}</text>`;
  const first = ARMOR_ARROWS[0];
  const table =
    'd10 Damage Type d10 Damage Type ' +
    first.damageTypes
      .slice(0, 5)
      .map((type, index) => `${index + 1} ${type} ${index + 6} ${first.damageTypes[index + 5]}`)
      .join(' ');
  return `<page number="208">${[first.name, first.header, ...first.description].map(text).join('')}
    <text top="1125">System Reference Document 5.1 208</text></page>
    <page number="209"><text top="1125">System Reference Document 5.1 209</text>${text(table)}${ARMOR_ARROWS.slice(
      1,
    )
      .flatMap((item) => [item.name, item.header, ...item.description])
      .map(text)
      .join('')}
      ${text('Bag of Beans')}</page>`;
}

function armorArrowsHeadings() {
  const headings = Array.from({ length: 239 }, (_, index) => `Heading ${index + 1}`);
  headings.splice(
    8,
    6,
    'Armor of Invulnerability',
    ...ARMOR_ARROWS.map((row) => row.name),
    'Bag of Beans',
  );
  return headings;
}

test('heading-bounded PDF oracle rejects incomplete prose, wrong tables, pages and heading sequence', () => {
  const headings = armorArrowsHeadings();
  const xml = armorArrowsXmlFixture();
  assert.equal(validateArmorArrowsPdfXml(xml, headings, normalizePdfText).records, 4);
  // Retain the lack of whitespace at the italic/punctuation source boundary,
  // independent of extractor coordinates. Genuine source whitespace survives.
  const fragmented = xml
    .replace('<text top="100">An arrow', '<text top="100" left="0" width="30">An arrow')
    .replace(
      'blue dragon slaying. If',
      'blue dragon slaying</text><text top="100" left="30" width="20">. If',
    );
  assert.equal(validateArmorArrowsPdfXml(fragmented, headings, normalizePdfText).records, 4);
  assert.equal(
    validateArmorArrowsPdfXml(
      fragmented.replace('left="30"', 'left="50"'),
      headings,
      normalizePdfText,
    ).records,
    4,
  );
  assert.throws(
    () =>
      validateArmorArrowsPdfXml(fragmented.replace('>. If', '> . If'), headings, normalizePdfText),
    /complete heading-bounded/,
  );
  for (const damaged of [
    xml.replace('1 Acid 6 Necrotic', '1 Necrotic 6 Acid'),
    xml.replace('removing the armor fails to end the curse.', ''),
    xml.replace('number="209"', 'number="210"'),
    xml.replace('Bag of Beans', 'Wrong boundary'),
    xml.replace('1 Acid 6 Necrotic', '1 Acid'),
  ])
    assert.throws(() => validateArmorArrowsPdfXml(damaged, headings, normalizePdfText));
  const wrongHeadings = [...headings];
  [wrongHeadings[9], wrongHeadings[10]] = [wrongHeadings[10], wrongHeadings[9]];
  assert.throws(
    () => validateArmorArrowsPdfXml(xml, wrongHeadings, normalizePdfText),
    /boundary sequence/,
  );
  assert.throws(
    () => validateArmorArrowsPdfXml(xml, headings.slice(1), normalizePdfText),
    /heading count/,
  );
});

const realArmorArrowsXml = await readFile(
  new URL('./fixtures/items-srd51-armor-arrows-poppler-25.03.xml', import.meta.url),
  'utf8',
);

test('real hash-bound Poppler XML preserves complete Armor/Arrow source blocks', async () => {
  const xml = realArmorArrowsXml;
  const receipt = JSON.parse(
    await readFile(
      new URL('./fixtures/items-srd51-armor-arrows-poppler-25.03-receipt.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(createHash('sha256').update(xml).digest('hex'), receipt.fixtureSha256);
  assert.equal(
    receipt.pdfSha256,
    '2504d2a0abb0a4d491a939be4f17910a2dde0312570ab8d208080225ccf0a1f0',
  );
  assert.equal(receipt.pdfBytes, 3158713);
  assert.deepEqual(receipt.physicalPdfPages, [208, 209]);
  assert.equal(receipt.license, 'CC-BY-4.0');

  assert.equal(
    validateArmorArrowsPdfXml(realArmorArrowsXml, armorArrowsHeadings(), normalizePdfText).records,
    4,
  );
});

test('real XML body survives shifted/high coordinates instead of an absolute footer band', () => {
  const xml = realArmorArrowsXml;
  // These are derived adversaries of a real fixture, not claims that Poppler
  // 25.07.0 was run here. The original 25.03.0 bytes/hash remain unchanged.
  const shifted = xml.replace(/top="(\d+)"/g, (_, value) => `top="${Number(value) + 10000}"`);
  assert.equal(
    validateArmorArrowsPdfXml(shifted, armorArrowsHeadings(), normalizePdfText).records,
    4,
  );
  const reportedCoordinateShape = xml.replace(
    /<text\b([^>]*)>([\s\S]*?)<\/text>/g,
    (_, attrs, body) =>
      `<text${attrs.replace(/top="\d+"/, `top="${/<b>/.test(body) ? 1153 : 1156}"`)}>${body}</text>`,
  );
  assert.equal(
    validateArmorArrowsPdfXml(reportedCoordinateShape, armorArrowsHeadings(), normalizePdfText)
      .records,
    4,
  );
  // Extra content in that formerly discarded region must still fail closed.
  const extraFact = shifted.replace('Curse.', 'Unpublished invented fact. Curse.');
  assert.notEqual(extraFact, shifted);
  assert.throws(
    () => validateArmorArrowsPdfXml(extraFact, armorArrowsHeadings(), normalizePdfText),
    /complete heading-bounded/,
  );
});

test('content-bound footer detection rejects missing/duplicate/wrong footers and retains body numbers', () => {
  const xml = realArmorArrowsXml;
  const footer = /<text\b[^>]*>System[\s\S]*?<\/text>/;
  const matched = footer.exec(xml)?.[0];
  assert.ok(matched);
  assert.throws(
    () =>
      validateArmorArrowsPdfXml(xml.replace(matched, ''), armorArrowsHeadings(), normalizePdfText),
    /exactly one SRD footer/,
  );
  assert.throws(
    () =>
      validateArmorArrowsPdfXml(
        xml.replace(matched, matched + matched),
        armorArrowsHeadings(),
        normalizePdfText,
      ),
    /exactly one SRD footer/,
  );
  assert.throws(
    () =>
      validateArmorArrowsPdfXml(
        xml.replace('<b>208</b>', '<b>209</b>'),
        armorArrowsHeadings(),
        normalizePdfText,
      ),
    /footer page number/,
  );
  const extraBodyNumber = xml.replace(
    'Armor of Resistance </b></text>',
    'Armor of Resistance </b></text><text top="12000">208</text>',
  );
  assert.notEqual(extraBodyNumber, xml);
  assert.throws(
    () => validateArmorArrowsPdfXml(extraBodyNumber, armorArrowsHeadings(), normalizePdfText),
    /complete heading-bounded/,
  );
});

test(
  'official PDF integration checks the complete source package and Armor/Arrow blocks',
  {
    skip: process.env.SRD51_SOURCE_PDF
      ? false
      : 'Set SRD51_SOURCE_PDF to the hash-pinned official SRD 5.1 PDF; offline fixtures are not a full PDF run',
  },
  async () => {
    const result = await verifyItemsSourcePackage({
      allowIncomplete: true,
      pdfPath: process.env.SRD51_SOURCE_PDF,
    });
    assert.equal(result.pdf.magicItemAzArmorArrowsEvidence.records, 4);
    assert.equal(result.pdf.magicItemAzArmorArrowsEvidence.resistanceTableRows, 10);
    assert.equal(result.pdf.magicItemAzBagsEvidence.beansEffectRows, 12);
    assert.equal(result.pdf.magicItemAzBagsEvidence.tricksCreatureRows, 24);
    assert.equal(result.pdf.magicItemAzBSectionEvidence.records, 15);
    assert.equal(result.pdf.magicItemAzBSectionEvidence.beltTableRows, 5);
    assert.equal(result.pdf.magicItemAzCSectionEvidence.records, 15);
    assert.equal(result.pdf.magicItemAzCSectionEvidence.cubeChargeLossRows, 5);
    assert.equal(result.pdf.magicItemAzDSectionEvidence.records, 15);
    assert.equal(result.pdf.magicItemAzDSectionEvidence.dragonResistanceCells, 10);
    assert.equal(result.pdf.magicItemAzESectionEvidence.records, 8);
    assert.equal(result.pdf.magicItemAzESectionEvidence.elementalGemRows, 4);
    assert.equal(result.complete, false);
  },
);

test('normalization expands ligatures and proven wrap artifacts while preserving punctuation', () => {
  assert.equal(
    normalizePdfText('  Wondrous\u00a0item, inter\u00ad\nnational — hero’s \uFB01ne  '),
    'Wondrous item, international — hero’s fine',
  );
  assert.equal(normalizePdfText('Ladder (10-\u00ad\u2010foot)'), 'Ladder (10-foot)');
  assert.equal(
    normalizePdfText('item—\n an orb, wand-\u2011like item—\n designed'),
    'item—an orb, wand-like item—designed',
  );
  assert.equal(normalizePdfText('co\u00adoperate – −'), 'co\u00adoperate – −');
});

test('Magic Item A–Z ordinal extraction folds a wrapped heading into one occurrence', () => {
  const xml = `<pdf2xml><fontspec id="5" size="18"/><fontspec id="6" size="15"/>
    <text font="5"><b>Amulet of Health </b></text><text font="6"><i>Wondrous item, rare</i></text>
    <text font="5"><b>Amulet of Proof against Detection and </b></text>
    <text font="5"><b>Location </b></text><text font="6"><i>Wondrous item, uncommon</i></text>
    <text font="5"><b>Decorative Table Heading</b></text><text font="6">not an item header</text>
    <text font="5"><b>Amulet of the Planes </b></text><text font="6"><i>Wondrous item, very rare</i></text>
  </pdf2xml>`;
  assert.deepEqual(extractMagicItemAzHeadingsFromPdfXml(xml), [
    'Amulet of Health',
    'Amulet of Proof against Detection and Location',
    'Amulet of the Planes',
  ]);
});

test('Apparatus lever extraction preserves physical row and Up/Down cell ownership', () => {
  const xml = `<pdf2xml><page>
    <text top="1026" left="98" font="8">1</text>
    <text top="1026" left="133" font="8">Up one</text><text top="1026" left="287" font="8">Down one</text>
    <text top="108" left="540" font="8">continued up.</text><text top="108" left="693" font="8">continued down.</text>
    ${Array.from({ length: 9 }, (_, index) => {
      const lever = index + 2;
      const top = 174 + index * 40;
      return `<text top="${top}" left="505" font="8">${lever}</text>
        <text top="${top}" left="540" font="8">Up ${lever}.</text>
        <text top="${top}" left="693" font="8">Down ${lever}.</text>`;
    }).join('\n')}
  </page></pdf2xml>`;
  const rows = extractApparatusLeverCellsFromPdfXml(xml);
  assert.deepEqual(rows[0], {
    lever: 1,
    up: 'Up one continued up.',
    down: 'Down one continued down.',
  });
  assert.deepEqual(
    rows.slice(1).map((row) => row.lever),
    [2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.deepEqual(rows[9], { lever: 10, up: 'Up 10.', down: 'Down 10.' });
});

test('variable rarity golden preserves ordered, sourced +1/+2/+3 choices', () => {
  const rarity = {
    kind: 'varies',
    sourceText: 'uncommon (+1), rare (+2), or very rare (+3)',
    choices: ['uncommon', 'rare', 'very-rare'].map((value, index) => ({
      variantId: `${occurrence.id}#variant:${index + 1}`,
      label: `+${index + 1}`,
      value,
      occurrenceId: occurrence.id,
    })),
  };
  const result = validateTranscriptData(transcript(rarity), inventory(occurrence));
  assert.equal(result.recordCount, 1);
});

test('rarity varies golden may preserve source text without inventing a choice', () => {
  const result = validateTranscriptData(
    transcript({ kind: 'varies', sourceText: 'rarity varies', choices: [] }),
    inventory(occurrence),
  );
  assert.equal(result.complete, true);
});

test('variant identities and occurrence references fail closed', () => {
  const rarity = {
    kind: 'varies',
    sourceText: 'rarity varies',
    choices: [
      {
        variantId: `${occurrence.id}#variant:9`,
        label: 'Wrong',
        value: 'rare',
        occurrenceId: occurrence.id,
      },
    ],
  };
  assert.throws(
    () => validateTranscriptData(transcript(rarity), inventory(occurrence)),
    /ordinale Variant-ID/,
  );
  const bad = transcript({ kind: 'fixed', value: 'rare' });
  bad.records[0].source.occurrenceIds = ['srd51:magic-item:missing:1'];
  assert.throws(() => validateTranscriptData(bad, inventory(occurrence)), /unbekannte Occurrence/);
});

test('opening Magic Item literals retain names, headers, attunement and variant labels', async () => {
  const checkedTranscript = JSON.parse(
    await readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8'),
  );

  const ids = Array.from(
    { length: 5 },
    (_, index) => `srd51:magic-item:magic-items-a-z:${index + 1}`,
  );
  const records = ids.map((id) => checkedTranscript.records.find((record) => record.id === id));
  assert.deepEqual(
    records.map((record) => record.name),
    [
      'Adamantine Armor',
      'Ammunition, +1, +2, or +3',
      'Amulet of Health',
      'Amulet of Proof against Detection and Location',
      'Amulet of the Planes',
    ],
  );
  assert.deepEqual(
    records.map((record) => record.attunement),
    ['not-required', 'not-required', 'required', 'required', 'required'],
  );
  assert.deepEqual(
    records.map((record) => record.sourceHeader.text),
    [
      'Armor (medium or heavy, but not hide), uncommon',
      'Weapon (any ammunition), uncommon (+1), rare (+2), or very rare (+3)',
      'Wondrous item, rare (requires attunement)',
      'Wondrous item, uncommon (requires attunement)',
      'Wondrous item, very rare (requires attunement)',
    ],
  );
  assert.deepEqual(
    records.map((record) => record.sourceHeader.occurrenceId),
    ids,
  );
  assert.deepEqual(
    records[1].rarity.choices.map((choice) => [choice.label, choice.value]),
    [
      ['+1', 'uncommon'],
      ['+2', 'rare'],
      ['+3', 'very-rare'],
    ],
  );
  assert.match(
    records[4].description[0].text,
    /On a 61–100.*randomly determined plane of existence\.$/,
  );
});

test('opening Magic Items A–Z slice fails closed on identity, header facts and prose drift', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const wrongOrdinal = structuredClone(checkedInventory);
  wrongOrdinal.occurrences.find(
    (item) => item.id === 'srd51:magic-item:magic-items-a-z:1',
  ).ordinal = 2;
  assert.throws(
    () => validateMagicItemAzOpeningSlice(checkedTranscript, wrongOrdinal),
    /Occurrence 1/,
  );
  const wrongAttunement = structuredClone(checkedTranscript);
  wrongAttunement.records.find((record) => record.id.endsWith('a-z:3')).attunement = 'not-required';
  assert.throws(
    () => validateMagicItemAzOpeningSlice(wrongAttunement, checkedInventory),
    /Record 3/,
  );
  const wrongVariant = structuredClone(checkedTranscript);
  wrongVariant.records.find((record) => record.id.endsWith('a-z:2')).rarity.choices[1].value =
    'uncommon';
  assert.throws(
    () => validateMagicItemAzOpeningSlice(wrongVariant, checkedInventory),
    /Variante 2/,
  );
  const truncated = structuredClone(checkedTranscript);
  truncated.records.find((record) => record.id.endsWith('a-z:5')).description[0].text =
    'While wearing this amulet.';
  assert.throws(() => validateMagicItemAzOpeningSlice(truncated, checkedInventory), /Record 5/);
  const reducedHeader = structuredClone(checkedTranscript);
  reducedHeader.records.find((record) => record.id.endsWith('a-z:1')).sourceHeader.text =
    'Armor, uncommon';
  assert.throws(() => validateMagicItemAzOpeningSlice(reducedHeader, checkedInventory), /Record 1/);
  const wrongHeaderOccurrence = structuredClone(checkedTranscript);
  wrongHeaderOccurrence.records.find((record) =>
    record.id.endsWith('a-z:2'),
  ).sourceHeader.occurrenceId = 'srd51:magic-item:magic-items-a-z:1';
  assert.throws(
    () =>
      validateTranscriptData(wrongHeaderOccurrence, checkedInventory, { allowIncomplete: true }),
    /Textfakt außerhalb seiner Quellenliste/,
  );
});

test('Animated Shield fails closed on occurrence, header, rules and prose drift', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const wrongPage = structuredClone(checkedInventory);
  wrongPage.occurrences.find((item) => item.id.endsWith('a-z:6')).firstPdfPage = 207;
  assert.throws(
    () => validateMagicItemAzAnimatedShield(checkedTranscript, wrongPage),
    /Occurrence 6/,
  );
  for (const mutate of [
    (record) => {
      record.sourceHeader.text = 'Armor (shield), very rare';
    },
    (record) => {
      record.rarity.value = 'rare';
    },
    (record) => {
      record.attunement = 'not-required';
    },
    (record) => {
      record.description[0].text = 'The shield animates.';
    },
  ]) {
    const damaged = structuredClone(checkedTranscript);
    mutate(damaged.records.find((record) => record.id.endsWith('a-z:6')));
    assert.throws(
      () => validateMagicItemAzAnimatedShield(damaged, checkedInventory),
      /Animated-Shield-Record/,
    );
  }
});

test('Apparatus lever labels preserve alternating Up and Down ownership', async () => {
  const checkedTranscript = JSON.parse(
    await readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8'),
  );

  const record = checkedTranscript.records.find((item) => item.id.endsWith('a-z:7'));
  assert.deepEqual(
    record.properties.filter((_, index) => index % 2 === 0).map((property) => property.name),
    Array.from({ length: 10 }, (_, index) => `Lever ${index + 1} — Up`),
  );
  assert.deepEqual(
    record.properties.filter((_, index) => index % 2 === 1).map((property) => property.name),
    Array.from({ length: 10 }, (_, index) => `Lever ${index + 1} — Down`),
  );
});

test('Apparatus of the Crab fails closed on occurrence, header, prose and lever-table drift', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const wrongOrdinal = structuredClone(checkedInventory);
  wrongOrdinal.occurrences.find((item) => item.id.endsWith('a-z:7')).ordinal = 8;
  assert.throws(
    () => validateMagicItemAzApparatusOfTheCrab(checkedTranscript, wrongOrdinal),
    /Occurrence 7/,
  );
  for (const mutate of [
    (record) => {
      record.sourceHeader.text = 'Wondrous item';
    },
    (record) => {
      record.rarity.value = 'very-rare';
    },
    (record) => {
      record.attunement = 'required';
    },
    (record) => {
      record.description[4].text = 'Speed: 30 ft.';
    },
  ]) {
    const damaged = structuredClone(checkedTranscript);
    mutate(damaged.records.find((record) => record.id.endsWith('a-z:7')));
    assert.throws(
      () => validateMagicItemAzApparatusOfTheCrab(damaged, checkedInventory),
      /Apparatus-of-the-Crab-Record/,
    );
  }
  const missingCell = structuredClone(checkedTranscript);
  missingCell.records.find((record) => record.id.endsWith('a-z:7')).properties.pop();
  assert.throws(
    () => validateMagicItemAzApparatusOfTheCrab(missingCell, checkedInventory),
    /Levertabelle/,
  );
  const swappedCells = structuredClone(checkedTranscript);
  const properties = swappedCells.records.find((record) => record.id.endsWith('a-z:7')).properties;
  [properties[0], properties[1]] = [properties[1], properties[0]];
  assert.throws(
    () => validateMagicItemAzApparatusOfTheCrab(swappedCells, checkedInventory),
    /Levertabelle/,
  );
});

test('Armor +1/+2/+3 retains ordered source variant identities and rarities', async () => {
  const checkedTranscript = JSON.parse(
    await readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8'),
  );

  const record = checkedTranscript.records.find((item) => item.id.endsWith('a-z:8'));
  assert.deepEqual(
    record.rarity.choices.map((choice) => [choice.variantId, choice.label, choice.value]),
    [
      ['srd51:magic-item:magic-items-a-z:8#variant:1', '+1', 'rare'],
      ['srd51:magic-item:magic-items-a-z:8#variant:2', '+2', 'very-rare'],
      ['srd51:magic-item:magic-items-a-z:8#variant:3', '+3', 'legendary'],
    ],
  );
});

test('Armor +1/+2/+3 fails closed on occurrence, header, variants, attunement and prose drift', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const wrongPage = structuredClone(checkedInventory);
  wrongPage.occurrences.find((item) => item.id.endsWith('a-z:8')).firstPdfPage = 209;
  assert.throws(
    () => validateMagicItemAzArmorPlusOneTwoThree(checkedTranscript, wrongPage),
    /Occurrence 8/,
  );
  for (const [mutate, pattern] of [
    [
      (record) => {
        record.sourceHeader.text = 'Armor, rarity varies';
      },
      /Record/,
    ],
    [
      (record) => {
        record.attunement = 'required';
      },
      /Record/,
    ],
    [
      (record) => {
        record.description[0].text = 'You have a bonus to AC.';
      },
      /Record/,
    ],
    [
      (record) => {
        record.rarity.choices[1].value = 'rare';
      },
      /Variante 2/,
    ],
    [
      (record) => {
        [record.rarity.choices[0], record.rarity.choices[1]] = [
          record.rarity.choices[1],
          record.rarity.choices[0],
        ];
      },
      /Variante 1/,
    ],
  ]) {
    const damaged = structuredClone(checkedTranscript);
    mutate(damaged.records.find((record) => record.id.endsWith('a-z:8')));
    assert.throws(
      () => validateMagicItemAzArmorPlusOneTwoThree(damaged, checkedInventory),
      pattern,
    );
  }
});

test('Armor of Invulnerability fails closed on occurrence, header, rarity, attunement and prose drift', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const wrongOrdinal = structuredClone(checkedInventory);
  wrongOrdinal.occurrences.find((item) => item.id.endsWith('a-z:9')).ordinal = 10;
  assert.throws(
    () => validateMagicItemAzArmorOfInvulnerability(checkedTranscript, wrongOrdinal),
    /Occurrence 9/,
  );
  for (const [mutate, pattern] of [
    [
      (record) => {
        record.sourceHeader.text = 'Armor (plate), legendary';
      },
      /Record/,
    ],
    [
      (record) => {
        record.rarity.value = 'very-rare';
      },
      /Record/,
    ],
    [
      (record) => {
        record.attunement = 'not-required';
      },
      /Record/,
    ],
    [
      (record) => {
        record.description[0].text = 'You have resistance to nonmagical damage.';
      },
      /Record/,
    ],
  ]) {
    const damaged = structuredClone(checkedTranscript);
    mutate(damaged.records.find((record) => record.id.endsWith('a-z:9')));
    assert.throws(
      () => validateMagicItemAzArmorOfInvulnerability(damaged, checkedInventory),
      pattern,
    );
  }
});

test('Draft 2020-12 schema rejects an unknown equipment subcategory', async () => {
  const [schema, checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-schema-v1.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const damaged = structuredClone(checkedTranscript);
  damaged.records[0].subcategory = 'invented-category';
  assert.throws(
    () => validateJsonSchemas(schema, damaged, checkedInventory),
    /Transkript verletzt JSON Schema/,
  );
});

test('armor source goldens preserve cost, missing values and literal AC semantics', async () => {
  const checkedTranscript = JSON.parse(
    await readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8'),
  );
  const byName = new Map(checkedTranscript.records.map((record) => [record.name, record]));
  assert.deepEqual(byName.get('Padded Armor').cost, { sourceText: '5 gp', copperPieces: 500 });
  assert.equal(byName.get('Padded Armor').armor.stealthRuleText, 'Disadvantage');
  assert.equal(byName.get('Hide Armor').armor.armorClassText, '12 + Dex modifier (max 2)');
  assert.equal(byName.get('Chain Mail').armor.strengthRequirementText, 'Str 13');
  assert.equal(byName.get('Shield').armor.armorClassText, '+2');
  assert.equal('strengthRequirementText' in byName.get('Padded Armor').armor, false);
  assert.equal(
    checkedTranscript.records
      .filter((record) => record.id.includes(':armor:'))
      .every((record) => record.description.length === 1),
    true,
  );
  assert.equal(
    byName.get('Padded Armor').description[0].text,
    'Padded armor consists of quilted layers of cloth and batting.',
  );
  assert.match(
    byName.get('Studded Leather Armor').description[0].text,
    /close-set rivets or spikes/,
  );
  assert.match(byName.get('Ring Mail').description[0].text, /it's usually worn.*can’t afford/);
  assert.match(
    byName.get('Plate Armor').description[0].text,
    /Buckles and straps distribute the weight/,
  );
  assert.match(byName.get('Shield').description[0].text, /benefit from only one shield at a time/);
  assert.deepEqual(byName.get('Padded Armor').source.pdfPages, [63]);
  assert.equal(
    [
      'Leather Armor',
      'Studded Leather Armor',
      'Hide Armor',
      'Chain Shirt',
      'Scale Mail',
      'Breastplate',
      'Half Plate Armor',
      'Ring Mail',
      'Chain Mail',
      'Splint Armor',
      'Plate Armor',
      'Shield',
    ].every((name) => byName.get(name).source.pdfPages.join() === '63,64'),
    true,
  );
});

test('armor bounded matching keeps every structured cell on one physical PDF row', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const pageLines = {
    63: ['Padded 5 gp 11 + Dex modifier — Disadvantage 8 lb.'],
    64: [
      'Leather 10 gp 11 + Dex modifier — — 10 lb.',
      'Studded leather 45 gp 12 + Dex modifier — — 13 lb.',
      'Hide 10 gp 12 + Dex modifier (max 2) — — 12 lb.',
      'Chain shirt 50 gp 13 + Dex modifier (max 2) — — 20 lb.',
      'Scale mail 50 gp 14 + Dex modifier (max 2) — Disadvantage 45 lb.',
      'Breastplate 400 gp 14 + Dex modifier (max 2) — — 20 lb.',
      'Half plate 750 gp 15 + Dex modifier (max 2) — Disadvantage 40 lb.',
      'Ring mail 30 gp 14 — Disadvantage 40 lb.',
      'Chain mail 75 gp 16 Str 13 Disadvantage 55 lb.',
      'Splint 200 gp 17 Str 15 Disadvantage 60 lb.',
      'Plate 1,500 gp 18 Str 15 Disadvantage 65 lb.',
      'Shield 10 gp +2 — — 6 lb.',
    ],
  };
  assert.deepEqual(validateBoundedArmorTableRows(pageLines, checkedTranscript, checkedInventory), {
    checkedRows: 13,
    scope: 'exact-normalized-pdftotext-layout-row-with-source-missing-markers',
  });
  const wrongCell = structuredClone(checkedTranscript);
  wrongCell.records.find((record) => record.name === 'Chain Mail').armor.strengthRequirementText =
    'Str 15';
  assert.throws(
    () => validateBoundedArmorTableRows(pageLines, wrongCell, checkedInventory),
    /nicht exakt einmal in derselben physischen Tabellenzeile/,
  );
  const pageWideOnly = structuredClone(pageLines);
  pageWideOnly[64] = pageWideOnly[64]
    .filter((line) => !line.startsWith('Leather '))
    .concat(['Leather', '10 gp', '11 + Dex modifier', '—', '—', '10 lb.']);
  assert.throws(
    () => validateBoundedArmorTableRows(pageWideOnly, checkedTranscript, checkedInventory),
    /nicht exakt einmal in derselben physischen Tabellenzeile/,
  );
});

test('weapon source goldens preserve ordered properties, literal damage and missing values', async () => {
  const checkedTranscript = JSON.parse(
    await readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8'),
  );
  const byName = new Map(checkedTranscript.records.map((record) => [record.name, record]));
  assert.deepEqual(byName.get('Spear').damage, {
    diceText: '1d6',
    typeText: 'piercing',
    versatileDiceText: '1d8',
  });
  assert.deepEqual(
    byName.get('Spear').properties.map(({ name, description }) => ({ name, description })),
    [
      { name: 'Thrown', description: 'range 20/60' },
      { name: 'Versatile', description: '1d8' },
    ],
  );
  assert.equal(byName.get('Blowgun').damage.diceText, '1');
  assert.equal('weight' in byName.get('Sling'), false);
  assert.equal('damage' in byName.get('Net'), false);
  assert.deepEqual(
    byName.get('Net').properties.map(({ name, description }) => ({ name, description })),
    [
      { name: 'Special', description: undefined },
      { name: 'Thrown', description: 'range 5/15' },
    ],
  );
  assert.deepEqual(byName.get('Net').source.pdfPages, [65, 66]);
  assert.equal(
    checkedTranscript.records.some((record) =>
      record.properties.some((property) => property.name === 'Monk'),
    ),
    false,
  );
});

test('weapon bounded matching keeps every structured cell on one physical PDF row', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const pageLines = {
    66: [
      'Club 1 sp 1d4 bludgeoning 2 lb. Light',
      'Dagger 2 gp 1d4 piercing 1 lb. Finesse, light, thrown (range 20/60)',
      'Greatclub 2 sp 1d8 bludgeoning 10 lb. Two-handed',
      'Handaxe 5 gp 1d6 slashing 2 lb. Light, thrown (range 20/60)',
      'Javelin 5 sp 1d6 piercing 2 lb. Thrown (range 30/120)',
      'Light hammer 2 gp 1d4 bludgeoning 2 lb. Light, thrown (range 20/60)',
      'Mace 5 gp 1d6 bludgeoning 4 lb. —',
      'Quarterstaff 2 sp 1d6 bludgeoning 4 lb. Versatile (1d8)',
      'Sickle 1 gp 1d4 slashing 2 lb. Light',
      'Spear 1 gp 1d6 piercing 3 lb. Thrown (range 20/60), versatile (1d8)',
      'Crossbow, light 25 gp 1d8 piercing 5 lb. Ammunition (range 80/320), loading, two-handed',
      'Dart 5 cp 1d4 piercing 1/4 lb. Finesse, thrown (range 20/60)',
      'Shortbow 25 gp 1d6 piercing 2 lb. Ammunition (range 80/320), two-handed',
      'Sling 1 sp 1d4 bludgeoning — Ammunition (range 30/120)',
      'Battleaxe 10 gp 1d8 slashing 4 lb. Versatile (1d10)',
      'Flail 10 gp 1d8 bludgeoning 2 lb. —',
      'Glaive 20 gp 1d10 slashing 6 lb. Heavy, reach, two-handed',
      'Greataxe 30 gp 1d12 slashing 7 lb. Heavy, two-handed',
      'Greatsword 50 gp 2d6 slashing 6 lb. Heavy, two-handed',
      'Halberd 20 gp 1d10 slashing 6 lb. Heavy, reach, two-handed',
      'Lance 10 gp 1d12 piercing 6 lb. Reach, special',
      'Longsword 15 gp 1d8 slashing 3 lb. Versatile (1d10)',
      'Maul 10 gp 2d6 bludgeoning 10 lb. Heavy, two-handed',
      'Morningstar 15 gp 1d8 piercing 4 lb. —',
      'Pike 5 gp 1d10 piercing 18 lb. Heavy, reach, two-handed',
      'Rapier 25 gp 1d8 piercing 2 lb. Finesse',
      'Scimitar 25 gp 1d6 slashing 3 lb. Finesse, light',
      'Shortsword 10 gp 1d6 piercing 2 lb. Finesse, light',
      'Trident 5 gp 1d6 piercing 4 lb. Thrown (range 20/60), versatile (1d8)',
      'War pick 5 gp 1d8 piercing 2 lb. —',
      'Warhammer 15 gp 1d8 bludgeoning 2 lb. Versatile (1d10)',
      'Whip 2 gp 1d4 slashing 3 lb. Finesse, reach',
      'Blowgun 10 gp 1 piercing 1 lb. Ammunition (range 25/100), loading',
      'Crossbow, hand 75 gp 1d6 piercing 3 lb. Ammunition (range 30/120), light, loading',
      'Crossbow, heavy 50 gp 1d10 piercing 18 lb. Ammunition (range 100/400), heavy, loading, two-handed',
      'Longbow 50 gp 1d8 piercing 2 lb. Ammunition (range 150/600), heavy, two-handed',
      'Net 1 gp — 3 lb. Special, thrown (range 5/15)',
    ],
  };
  assert.deepEqual(validateBoundedWeaponTableRows(pageLines, checkedTranscript, checkedInventory), {
    checkedRows: 37,
    scope:
      'exact-normalized-pdftotext-layout-row-with-source-missing-markers-and-ordered-properties',
  });
  const wrongCell = structuredClone(checkedTranscript);
  wrongCell.records.find((record) => record.name === 'Longbow').damage.diceText = '1d10';
  assert.throws(
    () => validateBoundedWeaponTableRows(pageLines, wrongCell, checkedInventory),
    /nicht exakt einmal in derselben physischen Tabellenzeile/,
  );
  const pageWideOnly = structuredClone(pageLines);
  pageWideOnly[66] = pageWideOnly[66]
    .filter((line) => !line.startsWith('Net '))
    .concat(['Net', '1 gp', '—', '3 lb.', 'Special, thrown (range 5/15)']);
  assert.throws(
    () => validateBoundedWeaponTableRows(pageWideOnly, checkedTranscript, checkedInventory),
    /nicht exakt einmal in derselben physischen Tabellenzeile/,
  );
});

test('adventuring gear inventory preserves all 99 physical table rows without group headers', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const rows = checkedInventory.occurrences.filter((item) => item.sectionId === 'adventuring-gear');
  assert.deepEqual(
    rows.map((row) => row.sourceLabel),
    [
      'Abacus',
      'Acid (vial)',
      'Alchemist’s fire (flask)',
      'Arrows (20)',
      'Blowgun needles (50)',
      'Crossbow bolts (20)',
      'Sling bullets (20)',
      'Antitoxin (vial)',
      'Crystal',
      'Orb',
      'Rod',
      'Staff',
      'Wand',
      'Backpack',
      'Ball bearings (bag of 1,000)',
      'Barrel',
      'Basket',
      'Bedroll',
      'Bell',
      'Blanket',
      'Block and tackle',
      'Book',
      'Bottle, glass',
      'Bucket',
      'Caltrops (bag of 20)',
      'Candle',
      'Case, crossbow bolt',
      'Case, map or scroll',
      'Chain (10 feet)',
      'Chalk (1 piece)',
      'Chest',
      'Climber’s kit',
      'Clothes, common',
      'Clothes, costume',
      'Clothes, fine',
      'Clothes, traveler’s',
      'Component pouch',
      'Crowbar',
      'Sprig of mistletoe',
      'Totem',
      'Wooden staff',
      'Yew wand',
      'Fishing tackle',
      'Flask or tankard',
      'Grappling hook',
      'Hammer',
      'Hammer, sledge',
      'Healer’s kit',
      'Amulet',
      'Emblem',
      'Reliquary',
      'Holy water (flask)',
      'Hourglass',
      'Hunting trap',
      'Ink (1 ounce bottle)',
      'Ink pen',
      'Jug or pitcher',
      'Ladder (10-foot)',
      'Lamp',
      'Lantern, bullseye',
      'Lantern, hooded',
      'Lock',
      'Magnifying glass',
      'Manacles',
      'Mess kit',
      'Mirror, steel',
      'Oil (flask)',
      'Paper (one sheet)',
      'Parchment (one sheet)',
      'Perfume (vial)',
      'Pick, miner’s',
      'Piton',
      'Poison, basic (vial)',
      'Pole (10-foot)',
      'Pot, iron',
      'Potion of healing',
      'Pouch',
      'Quiver',
      'Ram, portable',
      'Rations (1 day)',
      'Robes',
      'Rope, hempen (50 feet)',
      'Rope, silk (50 feet)',
      'Sack',
      'Scale, merchant’s',
      'Sealing wax',
      'Shovel',
      'Signal whistle',
      'Signet ring',
      'Soap',
      'Spellbook',
      'Spikes, iron (10)',
      'Spyglass',
      'Tent, two-person',
      'Tinderbox',
      'Torch',
      'Vial',
      'Waterskin',
      'Whetstone',
    ],
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    Array.from({ length: 99 }, (_, index) => `srd51:equipment:adventuring-gear:${index + 1}`),
  );
  assert.equal(
    rows.every((row) => row.firstPdfPage === 69 && row.lastPdfPage === 69),
    true,
  );
  assert.equal(rows[75].mergeIntoId, null);
  const reordered = structuredClone(checkedInventory);
  [reordered.occurrences[50], reordered.occurrences[51]] = [
    reordered.occurrences[51],
    reordered.occurrences[50],
  ];
  assert.throws(
    () => validateTranscriptData(checkedTranscript, reordered, { allowIncomplete: true }),
    /lückenlose physische Reihenfolge/,
  );
});

test('adventuring gear transcript preserves all 99 rows, exact omissions and source categories', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const records = checkedTranscript.records.filter((record) =>
    record.id.includes(':adventuring-gear:'),
  );
  assert.equal(records.length, 99);
  assert.deepEqual(
    records.map((record) => record.id),
    checkedInventory.occurrences
      .filter((item) => item.sectionId === 'adventuring-gear')
      .map((item) => item.id),
  );
  assert.deepEqual(records.find((record) => record.name === 'Crossbow bolts (20)').weight, {
    sourceText: '1½ lb.',
    pounds: '1.5',
  });
  assert.equal('weight' in records.find((record) => record.name === 'Antitoxin (vial)'), false);
  assert.deepEqual(records.find((record) => record.name === 'Waterskin').weight, {
    sourceText: '5 lb. (full)',
  });
  assert.deepEqual(records.find((record) => record.name === 'Caltrops (bag of 20)').cost, {
    sourceText: '1 gp',
    copperPieces: 100,
  });
  assert.deepEqual(records.find((record) => record.name === 'Spikes, iron (10)').cost, {
    sourceText: '1 gp',
    copperPieces: 100,
  });
  assert.equal(records.find((record) => record.name === 'Climber’s kit').subcategory, 'kit');
  assert.equal(records.find((record) => record.name === 'Crystal').subcategory, 'arcane-focus');
  assert.equal(records.find((record) => record.name === 'Amulet').subcategory, 'holy-symbol');
});

test('adventuring gear bounded matching isolates complete cells inside two-column physical rows', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter(
    (item) => item.sectionId === 'adventuring-gear',
  );
  const records = new Map(checkedTranscript.records.map((record) => [record.id, record]));
  const segments = occurrences.map((item) => {
    const record = records.get(item.id);
    return `${item.sourceLabel} ${record.cost.sourceText} ${record.weight?.sourceText ?? '—'}`;
  });
  const columnBreak = Math.ceil(segments.length / 2);
  const pageLines = {
    69: Array.from({ length: columnBreak }, (_, index) =>
      [segments[index], segments[index + columnBreak]].filter(Boolean).join('     '),
    ),
  };
  assert.deepEqual(
    validateBoundedAdventuringGearTableRows(pageLines, checkedTranscript, checkedInventory),
    {
      checkedRows: 99,
      scope:
        'exact-normalized-pdftotext-layout-row-segment-for-two-column-table-with-source-missing-markers',
    },
  );

  const wrongCell = structuredClone(checkedTranscript);
  wrongCell.records.find((record) => record.name === 'Spyglass').cost.sourceText = '100 gp';
  assert.throws(
    () => validateBoundedAdventuringGearTableRows(pageLines, wrongCell, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );

  const pageWideOnly = structuredClone(pageLines);
  const waterskin = 'Waterskin 2 sp 5 lb. (full)';
  const waterskinLine = pageWideOnly[69].findIndex((line) => line.includes(waterskin));
  pageWideOnly[69][waterskinLine] = pageWideOnly[69][waterskinLine].replace(waterskin, 'Waterskin');
  pageWideOnly[69].push('2 sp', '5 lb. (full)');
  assert.throws(
    () =>
      validateBoundedAdventuringGearTableRows(pageWideOnly, checkedTranscript, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );

  const duplicateSegment = structuredClone(pageLines);
  duplicateSegment[69][0] += `     ${segments[0]}`;
  assert.throws(
    () =>
      validateBoundedAdventuringGearTableRows(
        duplicateSegment,
        checkedTranscript,
        checkedInventory,
      ),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );
});

test('Potion of healing retains canonical item identity and both source owners', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const potion = checkedTranscript.records.find((record) => record.name === 'Potion of healing');
  const occurrence = checkedInventory.occurrences.find((item) => item.id === potion.id);
  assert.equal(potion.id, 'srd51:equipment:adventuring-gear:76');
  assert.equal(potion.category, 'magic-item');
  assert.equal(potion.magic, true);
  assert.equal(potion.subcategory, 'potion');
  assert.match(potion.description[0].text, /magical red fluid/);
  assert.equal(occurrence.mergeIntoId, null);
  assert.equal(potion.attunement, 'not-required');
  assert.deepEqual(potion.source.occurrenceIds, [
    'srd51:equipment:adventuring-gear:76',
    'srd51:magic-item:magic-items-a-z:142',
  ]);
  assert.deepEqual(
    potion.rarity.choices.map((choice) => [choice.label, choice.value]),
    [
      ['Healing', 'common'],
      ['Greater healing', 'uncommon'],
      ['Superior healing', 'rare'],
      ['Supreme healing', 'very-rare'],
    ],
  );
});

test('Potion-of-Healing merge identity, ordering, source and variants fail closed', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const detailId = 'srd51:magic-item:magic-items-a-z:142';
  const potionId = 'srd51:equipment:adventuring-gear:76';

  const unknownTarget = structuredClone(checkedInventory);
  unknownTarget.occurrences.find((item) => item.id === detailId).mergeIntoId =
    'srd51:equipment:adventuring-gear:999';
  assert.throws(
    () => validateTranscriptData(checkedTranscript, unknownTarget, { allowIncomplete: true }),
    /unbekanntes Merge-Ziel/,
  );

  const laterTarget = structuredClone(checkedInventory);
  const detailIndex = laterTarget.occurrences.findIndex((item) => item.id === detailId);
  laterTarget.occurrences.unshift(laterTarget.occurrences.splice(detailIndex, 1)[0]);
  assert.throws(
    () => validateTranscriptData(checkedTranscript, laterTarget, { allowIncomplete: true }),
    /frühere physische Occurrence/,
  );

  const chainedTarget = structuredClone(checkedInventory);
  chainedTarget.occurrences.find((item) => item.id === potionId).mergeIntoId =
    'srd51:equipment:adventuring-gear:75';
  assert.throws(
    () => validateTranscriptData(checkedTranscript, chainedTarget, { allowIncomplete: true }),
    /keine Merge-Kette/,
  );

  const duplicate = structuredClone(checkedTranscript);
  const secondRecord = structuredClone(duplicate.records.find((record) => record.id === potionId));
  secondRecord.id = detailId;
  duplicate.records.push(secondRecord);
  assert.throws(
    () => validateTranscriptData(duplicate, checkedInventory, { allowIncomplete: true }),
    /keinen zweiten kanonischen Record/,
  );

  const missingSource = structuredClone(checkedTranscript);
  missingSource.records.find((record) => record.id === potionId).source.occurrenceIds = [potionId];
  assert.throws(
    () => validateTranscriptData(missingSource, checkedInventory, { allowIncomplete: true }),
    /Raritätsvariante außerhalb seiner Quellenliste|gemergte Occurrence/,
  );

  const wrongVariant = structuredClone(checkedTranscript);
  wrongVariant.records.find((record) => record.id === potionId).rarity.choices[2].variantId =
    `${detailId}#variant:9`;
  assert.throws(
    () => validateTranscriptData(wrongVariant, checkedInventory, { allowIncomplete: true }),
    /ordinale Variant-ID/,
  );

  const wrongHealingRow = structuredClone(checkedTranscript);
  wrongHealingRow.records.find((record) => record.id === potionId).description.at(-1).text =
    'Supreme healing Very rare 10d4 + 19';
  assert.throws(
    () => validatePotionHealingMerge(wrongHealingRow, checkedInventory),
    /Heilungszeilen/,
  );
});

test('equipment packs preserve physical order, exact costs and complete published contents', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter(
    (item) => item.sectionId === 'equipment-packs',
  );
  const records = checkedTranscript.records.filter(
    (record) => record.subcategory === 'equipment-pack',
  );
  assert.deepEqual(
    occurrences.map((item) => item.sourceLabel),
    [
      'Burglar’s Pack',
      'Diplomat’s Pack',
      'Dungeoneer’s Pack',
      'Entertainer’s Pack',
      'Explorer’s Pack',
      'Priest’s Pack',
      'Scholar’s Pack',
    ],
  );
  assert.deepEqual(
    records.map((record) => record.id),
    occurrences.map((item) => item.id),
  );
  assert.deepEqual(
    records.map((record) => record.cost.sourceText),
    ['16 gp', '39 gp', '12 gp', '40 gp', '10 gp', '19 gp', '40 gp'],
  );
  assert.equal(
    records.every((record) => record.source.pdfPages.join() === '70'),
    true,
  );
  assert.match(records[0].description[0].text, /10 feet of string/);
  assert.match(records[0].description[0].text, /5 days rations/);
  assert.match(
    records[5].description[0].text,
    /an alms box, 2 blocks of incense, a censer, vestments/,
  );
  assert.match(records[6].description[0].text, /a little bag of sand, and a small knife/);
});

test('pack-only helper dispositions are explicit and cannot invent primary identities', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const packOnly = checkedInventory.helperDispositions.filter(
    (item) => item.disposition === 'pack-prose-only',
  );
  assert.deepEqual(
    packOnly.map((item) => item.helperIndex),
    [
      'string-10-feet',
      'alms-box',
      'block-of-incense',
      'censer',
      'vestments',
      'little-bag-of-sand',
      'small-knife',
    ],
  );
  assert.equal(
    packOnly.every((item) => item.disposition === 'pack-prose-only' && item.canonicalId === null),
    true,
  );
  const invented = structuredClone(checkedInventory);
  invented.helperDispositions[0].canonicalId = 'srd51:equipment:equipment-packs:1';
  assert.throws(
    () => validateTranscriptData(checkedTranscript, invented, { allowIncomplete: true }),
    /keine kanonische Primär-ID erfinden/,
  );
  const unknownSource = structuredClone(checkedInventory);
  unknownSource.helperDispositions[0].sourceOccurrenceIds = ['srd51:equipment:equipment-packs:99'];
  assert.throws(
    () => validateTranscriptData(checkedTranscript, unknownSource, { allowIncomplete: true }),
    /unbekannte Occurrence/,
  );
});

test('tools preserve all 35 leaf rows, physical order, categories and optional weights', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter((item) => item.sectionId === 'tools');
  const records = checkedTranscript.records.filter((record) => record.id.includes(':tools:'));
  assert.deepEqual(
    occurrences.map((item) => item.id),
    Array.from({ length: 35 }, (_, index) => `srd51:equipment:tools:${index + 1}`),
  );
  assert.deepEqual(
    records.map((record) => record.id),
    occurrences.map((item) => item.id),
  );
  assert.deepEqual(
    records.reduce(
      (counts, record) => ({
        ...counts,
        [record.subcategory]: (counts[record.subcategory] ?? 0) + 1,
      }),
      {},
    ),
    {
      'artisans-tools': 17,
      kit: 4,
      'gaming-set': 2,
      'musical-instrument': 10,
      'other-tools': 2,
    },
  );
  const byName = new Map(records.map((record) => [record.name, record]));
  assert.deepEqual(byName.get('Alchemist’s supplies').cost, {
    sourceText: '50 gp',
    copperPieces: 5000,
  });
  assert.deepEqual(byName.get('Dice set').cost, { sourceText: '1 sp', copperPieces: 10 });
  assert.deepEqual(byName.get('Playing card set').cost, { sourceText: '5 sp', copperPieces: 50 });
  assert.equal('weight' in byName.get('Dice set'), false);
  assert.equal('weight' in byName.get('Playing card set'), false);
  assert.equal(records.filter((record) => record.weight !== undefined).length, 33);
  assert.equal(byName.has("Calligrapher's supplies"), true);
  assert.equal(byName.has('Calligrapher’s supplies'), false);
  assert.match(
    byName.get('Alchemist’s supplies').description[0].text,
    /Each type of artisan’s tools/,
  );
  assert.match(byName.get('Dice set').description[0].text, /Three-Dragon Ante/);
  assert.match(
    byName.get('Navigator’s tools').description[0].text,
    /navigator's tools.*ship's course/,
  );
  assert.match(byName.get('Thieves’ tools').description[0].text, /narrow-bladed scissors/);
});

test('tools bounded matching keeps every complete cell segment on one physical PDF row', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter((item) => item.sectionId === 'tools');
  const records = new Map(checkedTranscript.records.map((record) => [record.id, record]));
  const segments = occurrences.map((item) => {
    const record = records.get(item.id);
    return `${item.sourceLabel} ${record.cost.sourceText} ${record.weight?.sourceText ?? '—'}`;
  });
  const pageLines = {
    70: segments.map((segment, index) => `Unrelated left-column prose ${index}     ${segment}`),
  };
  assert.deepEqual(validateBoundedToolsTableRows(pageLines, checkedTranscript, checkedInventory), {
    checkedRows: 35,
    scope: 'exact-normalized-pdftotext-layout-row-segment-with-source-missing-markers',
  });

  const wrongCell = structuredClone(checkedTranscript);
  wrongCell.records.find((record) => record.name === 'Alchemist’s supplies').cost.sourceText =
    '5 gp';
  assert.throws(
    () => validateBoundedToolsTableRows(pageLines, wrongCell, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );

  const pageWideOnly = structuredClone(pageLines);
  const thievesTools = 'Thieves’ tools 25 gp 1 lb.';
  const thievesToolsLine = pageWideOnly[70].findIndex((line) => line.includes(thievesTools));
  pageWideOnly[70][thievesToolsLine] = pageWideOnly[70][thievesToolsLine].replace(
    thievesTools,
    'Thieves’ tools',
  );
  pageWideOnly[70].push('25 gp', '1 lb.');
  assert.throws(
    () => validateBoundedToolsTableRows(pageWideOnly, checkedTranscript, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );

  const duplicateSegment = structuredClone(pageLines);
  duplicateSegment[70][0] += `     ${segments[0]}`;
  assert.throws(
    () => validateBoundedToolsTableRows(duplicateSegment, checkedTranscript, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );
});

test('Tools Vehicles row remains a sourced cross-reference without a primary item identity', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  assert.deepEqual(checkedInventory.crossReferences, [
    {
      id: 'srd51:equipment:tools:cross-reference:1',
      feed: 'equipment',
      sectionId: 'tools',
      sourceKind: 'cross-reference',
      sourceTable: 'Tools',
      sourceLabel: 'Vehicles (land or water)',
      sourceText: '* See the “Mounts and Vehicles” section.',
      firstPdfPage: 70,
      lastPdfPage: 70,
      firstPrintedPage: 70,
      lastPrintedPage: 70,
      targetSectionIds: [
        'mounts-other-animals',
        'tack-harness-drawn-vehicles',
        'waterborne-vehicles',
      ],
    },
  ]);
  assert.equal(
    checkedInventory.occurrences.some((item) => item.sourceLabel === 'Vehicles (land or water)'),
    false,
  );
  assert.equal(
    checkedTranscript.records.some((record) => record.name === 'Vehicles (land or water)'),
    false,
  );
  const damaged = structuredClone(checkedInventory);
  damaged.crossReferences[0].targetSectionIds.push('missing-section');
  assert.throws(
    () => validateTranscriptData(checkedTranscript, damaged, { allowIncomplete: true }),
    /unbekannten Zielabschnitt missing-section/,
  );
});

test('mounts preserve eight physical rows and reconcile the Donkey or mule helper expansion', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter(
    (item) => item.sectionId === 'mounts-other-animals',
  );
  const records = checkedTranscript.records.filter(
    (record) => record.subcategory === 'mount-or-animal',
  );
  assert.deepEqual(
    occurrences.map((item) => item.sourceLabel),
    [
      'Camel',
      'Donkey or mule',
      'Elephant',
      'Horse, draft',
      'Horse, riding',
      'Mastiff',
      'Pony',
      'Warhorse',
    ],
  );
  assert.deepEqual(
    occurrences.map((item) => item.id),
    Array.from({ length: 8 }, (_, index) => `srd51:equipment:mounts-other-animals:${index + 1}`),
  );
  assert.deepEqual(
    occurrences.map((item) => [item.firstPdfPage, item.lastPdfPage]),
    [
      [71, 71],
      [71, 71],
      [71, 71],
      [72, 72],
      [72, 72],
      [72, 72],
      [72, 72],
      [72, 72],
    ],
  );
  assert.deepEqual(
    records.map((record) => record.id),
    occurrences.map((item) => item.id),
  );
  assert.deepEqual(
    records.map((record) => record.cost.sourceText),
    ['50 gp', '8 gp', '200 gp', '50 gp', '75 gp', '25 gp', '30 gp', '400 gp'],
  );
  assert.deepEqual(
    records.map((record) => record.speed),
    [
      { sourceText: '50 ft.', unit: 'ft/round', value: '50' },
      { sourceText: '40 ft.', unit: 'ft/round', value: '40' },
      { sourceText: '40 ft.', unit: 'ft/round', value: '40' },
      { sourceText: '40 ft.', unit: 'ft/round', value: '40' },
      { sourceText: '60 ft.', unit: 'ft/round', value: '60' },
      { sourceText: '40 ft.', unit: 'ft/round', value: '40' },
      { sourceText: '40 ft.', unit: 'ft/round', value: '40' },
      { sourceText: '60 ft.', unit: 'ft/round', value: '60' },
    ],
  );
  assert.deepEqual(
    records.map((record) => record.carryingCapacity),
    [
      { sourceText: '480 lb.', pounds: 480 },
      { sourceText: '420 lb.', pounds: 420 },
      { sourceText: '1,320 lb.', pounds: 1320 },
      { sourceText: '540 lb.', pounds: 540 },
      { sourceText: '480 lb.', pounds: 480 },
      { sourceText: '195 lb.', pounds: 195 },
      { sourceText: '225 lb.', pounds: 225 },
      { sourceText: '540 lb.', pounds: 540 },
    ],
  );
  assert.equal(
    records.every((record) => !('weight' in record)),
    true,
  );
  assert.equal(records.filter((record) => record.name === 'Donkey or mule').length, 1);
  const expansions = checkedInventory.helperDispositions.filter(
    (item) =>
      item.disposition === 'expanded-primary-occurrences' &&
      item.canonicalId === 'srd51:equipment:mounts-other-animals:2',
  );
  assert.deepEqual(
    expansions.map((item) => [item.helperIndex, item.helperName]),
    [
      ['donkey', 'Donkey'],
      ['mule', 'Mule'],
    ],
  );
  assert.equal(
    expansions.every(
      (item) =>
        item.sourceText === 'Donkey or mule' &&
        item.canonicalId === 'srd51:equipment:mounts-other-animals:2' &&
        item.sourceOccurrenceIds.join() === item.canonicalId,
    ),
    true,
  );
  assert.match(records[0].description[0].text, /base carrying capacity/);

  const missingCanonical = structuredClone(checkedInventory);
  missingCanonical.helperDispositions.find((item) => item.helperIndex === 'donkey').canonicalId =
    null;
  assert.throws(
    () => validateTranscriptData(checkedTranscript, missingCanonical, { allowIncomplete: true }),
    /kanonische Primär-ID/,
  );
  const mismatchedSpeed = structuredClone(checkedTranscript);
  mismatchedSpeed.records.find((record) => record.name === 'Camel').speed.value = '40';
  assert.throws(
    () => validateTranscriptData(mismatchedSpeed, checkedInventory, { allowIncomplete: true }),
    /speed stimmt nicht/,
  );
  const mismatchedCapacity = structuredClone(checkedTranscript);
  mismatchedCapacity.records.find((record) => record.name === 'Elephant').carryingCapacity.pounds =
    132;
  assert.throws(
    () => validateTranscriptData(mismatchedCapacity, checkedInventory, { allowIncomplete: true }),
    /carryingCapacity\.pounds stimmt nicht/,
  );
});

test('mounts bounded matching keeps all four cells together across split table pages', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter(
    (item) => item.sectionId === 'mounts-other-animals',
  );
  const records = new Map(checkedTranscript.records.map((record) => [record.id, record]));
  const segments = occurrences.map((item) => {
    const record = records.get(item.id);
    return `${item.sourceLabel} ${record.cost.sourceText} ${record.speed.sourceText} ${record.carryingCapacity.sourceText}`;
  });
  const pageLines = {
    71: segments
      .slice(0, 3)
      .map((segment, index) => `Unrelated left-column prose ${index}     ${segment}`),
    72: segments
      .slice(3)
      .map((segment, index) => `${segment}     Unrelated right-column trade goods ${index}`),
  };
  assert.deepEqual(validateBoundedMountsTableRows(pageLines, checkedTranscript, checkedInventory), {
    checkedRows: 8,
    scope: 'exact-normalized-pdftotext-layout-row-segment-across-split-table-pages',
  });

  const wrongCell = structuredClone(checkedTranscript);
  wrongCell.records.find((record) => record.name === 'Elephant').carryingCapacity.sourceText =
    '1,200 lb.';
  assert.throws(
    () => validateBoundedMountsTableRows(pageLines, wrongCell, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );

  const pageWideOnly = structuredClone(pageLines);
  const warhorse = 'Warhorse 400 gp 60 ft. 540 lb.';
  const warhorseLine = pageWideOnly[72].findIndex((line) => line.includes(warhorse));
  pageWideOnly[72][warhorseLine] = pageWideOnly[72][warhorseLine].replace(warhorse, 'Warhorse');
  pageWideOnly[72].push('400 gp', '60 ft.', '540 lb.');
  assert.throws(
    () => validateBoundedMountsTableRows(pageWideOnly, checkedTranscript, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );

  const duplicateSegment = structuredClone(pageLines);
  duplicateSegment[71][0] += `     ${segments[0]}`;
  assert.throws(
    () => validateBoundedMountsTableRows(duplicateSegment, checkedTranscript, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );
});

test('tack and drawn vehicles preserve formulas, missing weight and sourced Barding expansions', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter(
    (item) => item.sectionId === 'tack-harness-drawn-vehicles',
  );
  const records = checkedTranscript.records.filter((record) =>
    record.id.includes(':tack-harness-drawn-vehicles:'),
  );
  assert.deepEqual(
    occurrences.map((item) => item.sourceLabel),
    [
      'Barding',
      'Bit and bridle',
      'Carriage',
      'Cart',
      'Chariot',
      'Feed (per day)',
      'Exotic',
      'Military',
      'Pack',
      'Riding',
      'Saddlebags',
      'Sled',
      'Stabling (per day)',
      'Wagon',
    ],
  );
  assert.deepEqual(
    occurrences.map((item) => item.id),
    Array.from(
      { length: 14 },
      (_, index) => `srd51:equipment:tack-harness-drawn-vehicles:${index + 1}`,
    ),
  );
  assert.deepEqual(
    records.map((record) => record.id),
    occurrences.map((item) => item.id),
  );
  assert.deepEqual(
    records.map((record) => record.name),
    [
      'Barding',
      'Bit and bridle',
      'Carriage',
      'Cart',
      'Chariot',
      'Feed (per day)',
      'Saddle, Exotic',
      'Saddle, Military',
      'Saddle, Pack',
      'Saddle, Riding',
      'Saddlebags',
      'Sled',
      'Stabling (per day)',
      'Wagon',
    ],
  );
  assert.deepEqual(
    records.map((record) => record.cost.sourceText),
    [
      '×4',
      '2 gp',
      '100 gp',
      '15 gp',
      '250 gp',
      '5 cp',
      '60 gp',
      '20 gp',
      '5 gp',
      '10 gp',
      '4 gp',
      '20 gp',
      '5 sp',
      '35 gp',
    ],
  );
  assert.deepEqual(
    records.map((record) => record.weight.sourceText),
    [
      '×2',
      '1 lb.',
      '600 lb.',
      '200 lb.',
      '100 lb.',
      '10 lb.',
      '40 lb.',
      '30 lb.',
      '15 lb.',
      '25 lb.',
      '8 lb.',
      '300 lb.',
      '—',
      '400 lb.',
    ],
  );
  const byName = new Map(records.map((record) => [record.name, record]));
  assert.equal('copperPieces' in byName.get('Barding').cost, false);
  assert.equal('pounds' in byName.get('Barding').weight, false);
  assert.equal('pounds' in byName.get('Stabling (per day)').weight, false);
  assert.deepEqual(byName.get('Saddle, Exotic').weight, { sourceText: '40 lb.', pounds: '40' });
  assert.match(byName.get('Barding').description[0].text, /cost is four times.*weighs twice/);
  assert.match(byName.get('Saddle, Military').description[0].text, /advantage.*remain mounted/);
  assert.match(byName.get('Saddle, Exotic').description[0].text, /aquatic or flying mount/);
  assert.equal(
    ['Carriage', 'Cart', 'Chariot', 'Sled', 'Wagon'].every((name) =>
      byName
        .get(name)
        .description[0].text.startsWith('If you have proficiency with a certain kind of vehicle'),
    ),
    true,
  );

  const bardingId = 'srd51:equipment:tack-harness-drawn-vehicles:1';
  const barding = checkedInventory.helperDispositions.filter(
    (item) => item.disposition === 'expanded-primary-occurrences' && item.canonicalId === bardingId,
  );
  assert.deepEqual(
    barding.map((item) => item.helperIndex),
    [
      'barding-padded',
      'barding-leather',
      'barding-studded-leather',
      'barding-hide',
      'barding-chain-shirt',
      'barding-scale-mail',
      'barding-breastplate',
      'barding-half-plate',
      'barding-ring-mail',
      'barding-chain-mail',
      'barding-splint',
      'barding-plate',
    ],
  );
  assert.equal(
    barding.every(
      (item, index) =>
        item.sourceText === 'Barding' &&
        item.sourceOccurrenceIds[0] === bardingId &&
        item.sourceOccurrenceIds[1] === `srd51:equipment:armor:${index + 1}`,
    ),
    true,
  );

  const missingCanonicalSource = structuredClone(checkedInventory);
  missingCanonicalSource.helperDispositions.find(
    (item) => item.helperIndex === 'barding-padded',
  ).sourceOccurrenceIds = ['srd51:equipment:armor:1'];
  assert.throws(
    () =>
      validateTranscriptData(checkedTranscript, missingCanonicalSource, { allowIncomplete: true }),
    /kanonische Primär-ID belegen/,
  );
  const inventedFormula = structuredClone(checkedTranscript);
  inventedFormula.records.find((record) => record.name === 'Barding').cost.copperPieces = 400;
  assert.throws(
    () => validateTranscriptData(inventedFormula, checkedInventory, { allowIncomplete: true }),
    /cost ist nicht eindeutig umrechenbar/,
  );
});

test('tack bounded matching keeps formulas and source missing marker on one physical PDF row', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter(
    (item) => item.sectionId === 'tack-harness-drawn-vehicles',
  );
  const records = new Map(checkedTranscript.records.map((record) => [record.id, record]));
  const segments = occurrences.map((item) => {
    const record = records.get(item.id);
    return `${item.sourceLabel} ${record.cost.sourceText} ${record.weight.sourceText}`;
  });
  const pageLines = {
    72: segments.map(
      (segment, index) => `${segment}     Unrelated right-column trade goods ${index}`,
    ),
  };
  assert.deepEqual(validateBoundedTackTableRows(pageLines, checkedTranscript, checkedInventory), {
    checkedRows: 14,
    scope: 'exact-normalized-pdftotext-layout-row-segment-with-formula-and-source-missing-marker',
  });

  const wrongCell = structuredClone(checkedTranscript);
  wrongCell.records.find((record) => record.name === 'Saddle, Exotic').weight.sourceText = '50 lb.';
  assert.throws(
    () => validateBoundedTackTableRows(pageLines, wrongCell, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );

  const pageWideOnly = structuredClone(pageLines);
  const wagon = 'Wagon 35 gp 400 lb.';
  const wagonLine = pageWideOnly[72].findIndex((line) => line.includes(wagon));
  pageWideOnly[72][wagonLine] = pageWideOnly[72][wagonLine].replace(wagon, 'Wagon');
  pageWideOnly[72].push('35 gp', '400 lb.');
  assert.throws(
    () => validateBoundedTackTableRows(pageWideOnly, checkedTranscript, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );

  const duplicateSegment = structuredClone(pageLines);
  duplicateSegment[72][0] += `     ${segments[0]}`;
  assert.throws(
    () => validateBoundedTackTableRows(duplicateSegment, checkedTranscript, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );
});

test('waterborne vehicles preserve physical order, fractional mph and Rowed Vessels facts', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter(
    (item) => item.sectionId === 'waterborne-vehicles',
  );
  const records = checkedTranscript.records.filter(
    (record) => record.subcategory === 'waterborne-vehicle',
  );
  assert.deepEqual(
    occurrences.map((item) => item.sourceLabel),
    ['Galley', 'Keelboat', 'Longship', 'Rowboat', 'Sailing ship', 'Warship'],
  );
  assert.deepEqual(
    occurrences.map((item) => item.id),
    Array.from({ length: 6 }, (_, index) => `srd51:equipment:waterborne-vehicles:${index + 1}`),
  );
  assert.deepEqual(
    records.map((record) => record.id),
    occurrences.map((item) => item.id),
  );
  assert.deepEqual(
    records.map((record) => record.cost.sourceText),
    ['30,000 gp', '3,000 gp', '10,000 gp', '50 gp', '10,000 gp', '25,000 gp'],
  );
  assert.deepEqual(
    records.map((record) => record.speed),
    [
      { sourceText: '4 mph', unit: 'mph', value: '4' },
      { sourceText: '1 mph', unit: 'mph', value: '1' },
      { sourceText: '3 mph', unit: 'mph', value: '3' },
      { sourceText: '1½ mph', unit: 'mph', value: '1.5' },
      { sourceText: '2 mph', unit: 'mph', value: '2' },
      { sourceText: '2½ mph', unit: 'mph', value: '2.5' },
    ],
  );
  const byName = new Map(records.map((record) => [record.name, record]));
  assert.deepEqual(byName.get('Rowboat').weight, { sourceText: '100 pounds', pounds: '100' });
  assert.equal(records.filter((record) => record.weight !== undefined).length, 1);
  assert.equal(
    records.every((record) =>
      record.description[0].text.startsWith(
        'If you have proficiency with a certain kind of vehicle',
      ),
    ),
    true,
  );
  assert.deepEqual(
    records.filter((record) => record.description.length === 2).map((record) => record.name),
    ['Keelboat', 'Rowboat'],
  );
  assert.match(
    byName.get('Keelboat').description[1].text,
    /can’t be rowed.*rowboat weighs 100 pounds/,
  );
  assert.equal(
    records.every((record) => record.source.pdfPages.join() === '71,72'),
    true,
  );

  const mismatchedSpeed = structuredClone(checkedTranscript);
  mismatchedSpeed.records.find((record) => record.name === 'Warship').speed.value = '2';
  assert.throws(
    () => validateTranscriptData(mismatchedSpeed, checkedInventory, { allowIncomplete: true }),
    /speed stimmt nicht/,
  );
  const mismatchedWeight = structuredClone(checkedTranscript);
  mismatchedWeight.records.find((record) => record.name === 'Rowboat').weight.pounds = '10';
  assert.throws(
    () => validateTranscriptData(mismatchedWeight, checkedInventory, { allowIncomplete: true }),
    /weight\.pounds stimmt nicht/,
  );
});

test('waterborne bounded matching keeps fractional source speeds on one physical PDF row', async () => {
  const [checkedInventory, checkedTranscript] = await Promise.all([
    readFile(new URL('items-srd51-inventory.json', dataRoot), 'utf8').then(JSON.parse),
    readFile(new URL('items-srd51-transcript.json', dataRoot), 'utf8').then(JSON.parse),
  ]);
  const occurrences = checkedInventory.occurrences.filter(
    (item) => item.sectionId === 'waterborne-vehicles',
  );
  const records = new Map(checkedTranscript.records.map((record) => [record.id, record]));
  const segments = occurrences.map((item) => {
    const record = records.get(item.id);
    return `${item.sourceLabel} ${record.cost.sourceText} ${record.speed.sourceText}`;
  });
  const pageLines = {
    72: segments.map((segment, index) => `${segment}     Unrelated right-column expenses ${index}`),
  };
  assert.deepEqual(
    validateBoundedWaterborneTableRows(pageLines, checkedTranscript, checkedInventory),
    {
      checkedRows: 6,
      scope: 'exact-normalized-pdftotext-layout-row-segment-with-fractional-source-speeds',
    },
  );

  const wrongCell = structuredClone(checkedTranscript);
  wrongCell.records.find((record) => record.name === 'Warship').speed.sourceText = '2 mph';
  assert.throws(
    () => validateBoundedWaterborneTableRows(pageLines, wrongCell, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );

  const pageWideOnly = structuredClone(pageLines);
  const rowboat = 'Rowboat 50 gp 1½ mph';
  const rowboatLine = pageWideOnly[72].findIndex((line) => line.includes(rowboat));
  pageWideOnly[72][rowboatLine] = pageWideOnly[72][rowboatLine].replace(rowboat, 'Rowboat');
  pageWideOnly[72].push('50 gp', '1½ mph');
  assert.throws(
    () => validateBoundedWaterborneTableRows(pageWideOnly, checkedTranscript, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );

  const duplicateSegment = structuredClone(pageLines);
  duplicateSegment[72][0] += `     ${segments[0]}`;
  assert.throws(
    () => validateBoundedWaterborneTableRows(duplicateSegment, checkedTranscript, checkedInventory),
    /nicht exakt einmal als zusammenhängendes Segment derselben physischen Tabellenzeile/,
  );
});
