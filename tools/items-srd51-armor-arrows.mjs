import assert from "node:assert/strict";

// Official SRD 5.1, physical/printed pages 208–209. These goldens are source
// review inputs, not product data or an alternative runtime provider.
export const ARMOR_ARROWS = [
  {
    ordinal: 10, name: "Armor of Resistance", pages: [208, 209],
    header: "Armor (light, medium, or heavy), rare (requires attunement)",
    subcategory: "armor", rarity: "rare", attunement: "required",
    description: ["You have resistance to one type of damage while you wear this armor. The GM chooses the type or determines it randomly from the options below."],
    damageTypes: ["Acid", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Poison", "Psychic", "Radiant", "Thunder"],
  },
  {
    ordinal: 11, name: "Armor of Vulnerability", pages: [209],
    header: "Armor (plate), rare (requires attunement)",
    subcategory: "armor", rarity: "rare", attunement: "required",
    description: [
      "While wearing this armor, you have resistance to one of the following damage types: bludgeoning, piercing, or slashing. The GM chooses the type or determines it randomly.",
      "Curse. This armor is cursed, a fact that is revealed only when an identify spell is cast on the armor or you attune to it. Attuning to the armor curses you until you are targeted by the remove curse spell or similar magic; removing the armor fails to end the curse. While cursed, you have vulnerability to two of the three damage types associated with the armor (not the one to which it grants resistance).",
    ],
  },
  {
    ordinal: 12, name: "Arrow-Catching Shield", pages: [209],
    header: "Armor (shield), rare (requires attunement)",
    subcategory: "armor", rarity: "rare", attunement: "required",
    description: ["You gain a +2 bonus to AC against ranged attacks while you wield this shield. This bonus is in addition to the shield’s normal bonus to AC. In addition, whenever an attacker makes a ranged attack against a target within 5 feet of you, you can use your reaction to become the target of the attack instead."],
  },
  {
    ordinal: 13, name: "Arrow of Slaying", pages: [209],
    header: "Weapon (arrow), very rare", subcategory: "ammunition",
    rarity: "very-rare", attunement: "not-required",
    description: [
      "An arrow of slaying is a magic weapon meant to slay a particular kind of creature. Some are more focused than others; for example, there are both arrows of dragon slaying and arrows of blue dragon slaying. If a creature belonging to the type, race, or group associated with an arrow of slaying takes damage from the arrow, the creature must make a DC 17 Constitution saving throw, taking an extra 6d10 piercing damage on a failed save, or half as much extra damage on a successful one.",
      "Once an arrow of slaying deals its extra damage to a creature, it becomes a nonmagical arrow.",
      "Other types of magic ammunition of this kind exist, such as bolts of slaying meant for a crossbow, though arrows are most common.",
    ],
  },
];

export function armorArrowsSourceRows() {
  return ARMOR_ARROWS.map(item => {
    const id = `srd51:magic-item:magic-items-a-z:${item.ordinal}`;
    const occurrence = { id, feed: "magic-item", sectionId: "magic-items-a-z",
      sourceKind: "detail-heading", sourceTable: "Magic Items A–Z", sourceLabel: item.name,
      firstPdfPage: item.pages[0], lastPdfPage: item.pages.at(-1),
      firstPrintedPage: item.pages[0], lastPrintedPage: item.pages.at(-1),
      ordinal: item.ordinal, variantId: null, mergeIntoId: null };
    const record = { id, name: item.name, category: "magic-item", subcategory: item.subcategory,
      magic: true, rarity: { kind: "fixed", value: item.rarity }, attunement: item.attunement,
      sourceHeader: { text: item.header, occurrenceId: id },
      properties: (item.damageTypes ?? []).map((type, index) => ({
        name: String(index + 1), description: type, occurrenceId: id,
      })),
      description: [...item.description, ...(item.damageTypes ? ["d10 Damage Type"] : [])]
        .map(text => ({ text, occurrenceId: id })),
      source: { document: "SRD 5.1",
        pdfUrl: "https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf",
        pdfPages: [...item.pages], printedPages: [...item.pages], occurrenceIds: [id] } };
    return { occurrence, record };
  });
}

export function validateArmorArrowsSlice(transcript, inventory) {
  for (const expected of armorArrowsSourceRows()) {
    assert.deepEqual(inventory.occurrences.find(row => row.id === expected.occurrence.id),
      expected.occurrence, `${expected.record.name}: occurrence identity/page/merge drift`);
    assert.deepEqual(transcript.records.find(row => row.id === expected.record.id),
      expected.record, `${expected.record.name}: full header/prose/table/rarity/attunement drift`);
  }
  return { ordinals: [10, 11, 12, 13], records: 4, pages: [208, 209], resistanceTableRows: 10 };
}

// XML preserves the physical reading stream. Compare the entire interval
// between item headings, not a bag of substrings that could miss prose or
// borrow a table cell from a neighbouring item. Page footers are excluded.
export function validateArmorArrowsPdfXml(xml, headings, normalize) {
  assert.equal(headings.length, 239, "A–Z total heading count");
  assert.deepEqual(headings.slice(8, 14), ["Armor of Invulnerability",
    ...ARMOR_ARROWS.map(item => item.name), "Bag of Beans"], "A–Z boundary sequence");
  const nodes = [];
  for (const pageMatch of xml.matchAll(/<page\b[^>]*number="(\d+)"[^>]*>([\s\S]*?)<\/page>/g)) {
    const page = Number(pageMatch[1]);
    for (const match of pageMatch[2].matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
      const top = Number(/\btop="(\d+)"/.exec(match[1])?.[1]);
      if (!(top < 1100)) continue;
      const text = normalize(match[2].replace(/<[^>]+>/g, "").replaceAll("&amp;", "&")
        .replaceAll("&quot;", '"').replaceAll("&apos;", "'")
        .replaceAll("&lt;", "<").replaceAll("&gt;", ">"));
      const left = Number(/\bleft="(\d+)"/.exec(match[1])?.[1]);
      const width = Number(/\bwidth="(\d+)"/.exec(match[1])?.[1]);
      const previous = nodes.at(-1);
      // Poppler splits italic slaying names from the immediately adjacent
      // punctuation run. Do not introduce a space at a proven same-line,
      // physically touching run boundary; do not strip punctuation globally.
      const touchesPunctuation = /^[.,;:!?)]/.test(text) && previous?.page === page
        && previous.top === top && Math.abs(left - previous.left - previous.width) <= 2;
      if (text) nodes.push({ page, top, left, width, text, join: touchesPunctuation ? "" : " " });
    }
  }
  for (const [index, item] of ARMOR_ARROWS.entries()) {
    const start = nodes.findIndex(node => node.text === item.name);
    const nextName = ARMOR_ARROWS[index + 1]?.name ?? "Bag of Beans";
    const end = nodes.findIndex((node, offset) => offset > start && node.text === nextName);
    assert.ok(start >= 0 && end > start, `${item.name}: heading bounds missing`);
    const block = nodes.slice(start, end);
    assert.deepEqual([...new Set(block.map(node => node.page))], item.pages,
      `${item.name}: physical page span`);
    let table = "";
    if (item.damageTypes) {
      // The source has two side-by-side d10 columns. Preserve column ownership
      // in the PDF oracle; transcript rows are ordered by the die result.
      table = "d10 Damage Type d10 Damage Type " + item.damageTypes.slice(0, 5)
        .map((type, row) => `${row + 1} ${type} ${row + 6} ${item.damageTypes[row + 5]}`).join(" ");
    }
    assert.equal(normalize(block.map(node => node.join + node.text).join("")),
      normalize([item.name, item.header, ...item.description, table].join(" ")),
      `${item.name}: complete heading-bounded PDF text/table mismatch`);
  }
  return { records: 4, resistanceTableRows: 10, derivedHeadingCount: 239,
    scope: "exact-complete-heading-bounded-xml-stream-and-two-column-d10-table" };
}
