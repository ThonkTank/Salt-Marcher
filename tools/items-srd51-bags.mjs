import assert from "node:assert/strict";
import { extractSrdBodyNodes } from "./items-srd51-armor-arrows.mjs";

// Complete official SRD-5.1 source section, physical/printed pages 209–211.
// Offline review goldens only; never imported by the product bundle/provider.
export const BAGS = [
  {
    ordinal: 14, name: "Bag of Beans", pages: [209, 210], rarity: "rare",
    description: [
      "Inside this heavy cloth bag are 3d4 dry beans. The bag weighs 1/2 pound plus 1/4 pound for each bean it contains.",
      "If you dump the bag’s contents out on the ground, they explode in a 10-foot radius, extending from the beans. Each creature in the area, including you, must make a DC 15 Dexterity saving throw, taking 5d4 fire damage on a failed save, or half as much damage on a successful one. The fire ignites flammable objects in the area that aren’t being worn or carried.",
      "If you remove a bean from the bag, plant it in dirt or sand, and then water it, the bean produces an effect 1 minute later from the ground where it was planted. The GM can choose an effect from the following table, determine it randomly, or create an effect.",
    ],
    tables: [{ header: "d100 Effect", rows: [
      ["01", "5d4 toadstools sprout. If a creature eats a toadstool, roll any die. On an odd roll, the eater must succeed on a DC 15 Constitution saving throw or take 5d6 poison damage and become poisoned for 1 hour. On an even roll, the eater gains 5d6 temporary hit points for 1 hour."],
      ["02–10", "A geyser erupts and spouts water, beer, berry juice, tea, vinegar, wine, or oil (GM’s choice) 30 feet into the air for 1d12 rounds."],
      ["11–20", "A treant sprouts. There’s a 50 percent chance that the treant is chaotic evil and attacks."],
      ["21–30", "An animate, immobile stone statue in your likeness rises. It makes verbal threats against you. If you leave it and others come near, it describes you as the most heinous of villains and directs the newcomers to find and attack you. If you are on the same plane of existence as the statue, it knows where you are. The statue becomes inanimate after 24 hours."],
      ["31–40", "A campfire with blue flames springs forth and burns for 24 hours (or until it is extinguished)."],
      ["41–50", "1d6 + 6 shriekers sprout"],
      ["51–60", "1d4 + 8 bright pink toads crawl forth. Whenever a toad is touched, it transforms into a Large or smaller monster of the GM’s choice. The monster remains for 1 minute, then disappears in a puff of bright pink smoke."],
      ["61–70", "A hungry bulette burrows up and attacks."],
      ["71–80", "A fruit tree grows. It has 1d10 + 20 fruit, 1d8 of which act as randomly determined magic potions, while one acts as an ingested poison of the GM’s choice. The tree vanishes after 1 hour. Picked fruit remains, retaining any magic for 30 days."],
      ["81–90", "A nest of 1d4 + 3 eggs springs up. Any creature that eats an egg must make a DC 20 Constitution saving throw. On a successful save, a creature permanently increases its lowest ability score by 1, randomly choosing among equally low scores. On a failed save, the creature takes 10d6 force damage from an internal magical explosion."],
      ["91–99", "A pyramid with a 60-foot-square base bursts upward. Inside is a sarcophagus containing a mummy lord. The pyramid is treated as the mummy lord’s lair, and its sarcophagus contains treasure of the GM’s choice."],
      ["00", "A giant beanstalk sprouts, growing to a height of the GM’s choice. The top leads where the GM chooses, such as to a great view, a cloud giant’s castle, or a different plane of existence."],
    ] }],
  },
  {
    ordinal: 15, name: "Bag of Devouring", pages: [210], rarity: "very-rare",
    description: [
      "This bag superficially resembles a bag of holding but is a feeding orifice for a gigantic extradimensional creature. Turning the bag inside out closes the orifice.",
      "The extradimensional creature attached to the bag can sense whatever is placed inside the bag. Animal or vegetable matter placed wholly in the bag is devoured and lost forever. When part of a living creature is placed in the bag, as happens when someone reaches inside it, there is a 50 percent chance that the creature is pulled inside the bag. A creature inside the bag can use its action to try to escape with a successful DC 15 Strength check. Another creature can use its action to reach into the bag to pull a creature out, doing so with a successful DC 20 Strength check (provided it isn’t pulled inside the bag first). Any creature that starts its turn inside the bag is devoured, its body destroyed.",
      "Inanimate objects can be stored in the bag, which can hold a cubic foot of such material. However, once each day, the bag swallows any objects inside it and spits them out into another plane of existence. The GM determines the time and plane.",
      "If the bag is pierced or torn, it is destroyed, and anything contained within it is transported to a random location on the Astral Plane.",
    ],
  },
  {
    ordinal: 16, name: "Bag of Holding", pages: [210], rarity: "uncommon",
    description: [
      "This bag has an interior space considerably larger than its outside dimensions, roughly 2 feet in diameter at the mouth and 4 feet deep. The bag can hold up to 500 pounds, not exceeding a volume of 64 cubic feet. The bag weighs 15 pounds, regardless of its contents. Retrieving an item from the bag requires an action.",
      "If the bag is overloaded, pierced, or torn, it ruptures and is destroyed, and its contents are scattered in the Astral Plane. If the bag is turned inside out, its contents spill forth, unharmed, but the bag must be put right before it can be used again.",
      "Breathing creatures inside the bag can survive up to a number of minutes equal to 10 divided by the number of creatures (minimum 1 minute), after which time they begin to suffocate.",
      "Placing a bag of holding inside an extradimensional space created by a handy haversack, portable hole, or similar item instantly destroys both items and opens a gate to the Astral Plane. The gate originates where the one item was placed inside the other. Any creature within 10 feet of the gate is sucked through it to a random location on the Astral Plane. The gate then closes. The gate is one-way only and can’t be reopened.",
    ],
  },
  {
    ordinal: 17, name: "Bag of Tricks", pages: [210, 211], rarity: "uncommon",
    description: [
      "This ordinary bag, made from gray, rust, or tan cloth, appears empty. Reaching inside the bag, however, reveals the presence of a small, fuzzy object. The bag weighs 1/2 pound.",
      "You can use an action to pull the fuzzy object from the bag and throw it up to 20 feet. When the object lands, it transforms into a creature you determine by rolling a d8 and consulting the table that corresponds to the bag’s color. The creature vanishes at the next dawn or when it is reduced to 0 hit points.",
      "The creature is friendly to you and your companions, and it acts on your turn. You can use a bonus action to command how the creature moves and what action it takes on its next turn, or to give it general orders, such as to attack your enemies. In the absence of such orders, the creature acts in a fashion appropriate to its nature.",
      "Once three fuzzy objects have been pulled from the bag, the bag can’t be used again until the next dawn.",
    ],
    tables: [
      { label: "Gray Bag of Tricks", header: "d8 Creature", rows: ["Weasel", "Giant rat", "Badger", "Boar", "Panther", "Giant badger", "Dire wolf", "Giant elk"].map((creature, index) => [String(index + 1), creature]) },
      { label: "Rust Bag of Tricks", header: "d8 Creature", rows: ["Rat", "Owl", "Mastiff", "Goat", "Giant goat", "Giant boar", "Lion", "Brown bear"].map((creature, index) => [String(index + 1), creature]) },
      { label: "Tan Bag of Tricks", header: "d8 Creature", rows: ["Jackal", "Ape", "Baboon", "Axe beak", "Black bear", "Giant weasel", "Giant hyena", "Tiger"].map((creature, index) => [String(index + 1), creature]) },
    ],
  },
];

export function bagsSourceRows() {
  return BAGS.map(item => {
    const id = `srd51:magic-item:magic-items-a-z:${item.ordinal}`;
    return {
      occurrence: { id, feed: "magic-item", sectionId: "magic-items-a-z", sourceKind: "detail-heading",
        sourceTable: "Magic Items A–Z", sourceLabel: item.name,
        firstPdfPage: item.pages[0], lastPdfPage: item.pages.at(-1),
        firstPrintedPage: item.pages[0], lastPrintedPage: item.pages.at(-1),
        ordinal: item.ordinal, variantId: null, mergeIntoId: null },
      record: { id, name: item.name, category: "magic-item", subcategory: "wondrous-item", magic: true,
        rarity: { kind: "fixed", value: item.rarity }, attunement: "not-required",
        sourceHeader: { text: `Wondrous item, ${item.rarity.replace("-", " ")}`, occurrenceId: id },
        properties: (item.tables ?? []).flatMap(table => table.rows.map(([roll, effect]) => ({
          name: table.label ? `${table.label}: ${roll}` : roll, description: effect, occurrenceId: id,
        }))),
        description: [...item.description, ...(item.tables ?? []).flatMap(table =>
          [table.label, table.header].filter(Boolean))].map(text => ({ text, occurrenceId: id })),
        source: { document: "SRD 5.1", pdfUrl: "https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf",
          pdfPages: [...item.pages], printedPages: [...item.pages], occurrenceIds: [id] } },
    };
  });
}

export function validateBagsSlice(transcript, inventory) {
  for (const expected of bagsSourceRows()) {
    assert.deepEqual(inventory.occurrences.find(row => row.id === expected.occurrence.id),
      expected.occurrence, `${expected.record.name}: occurrence identity/page/merge drift`);
    assert.deepEqual(transcript.records.find(row => row.id === expected.record.id),
      expected.record, `${expected.record.name}: complete header/prose/table ownership drift`);
  }
  return { ordinals: [14, 15, 16, 17], records: 4, pages: [209, 210, 211],
    beansEffectRows: 12, tricksTables: 3, tricksCreatureRows: 24 };
}

export function validateBagsPdfXml(xml, headings, normalize) {
  assert.equal(headings.length, 239, "A–Z total heading count");
  assert.deepEqual(headings.slice(12, 18), ["Arrow of Slaying", ...BAGS.map(item => item.name), "Bead of Force"],
    "Bags A–Z boundary sequence");
  const nodes = extractSrdBodyNodes(xml, normalize);
  for (const [index, item] of BAGS.entries()) {
    const start = nodes.findIndex(node => node.text === item.name);
    const nextName = BAGS[index + 1]?.name ?? "Bead of Force";
    const end = nodes.findIndex((node, offset) => offset > start && node.text === nextName);
    assert.ok(start >= 0 && end > start, `${item.name}: heading bounds missing`);
    const block = nodes.slice(start, end);
    assert.deepEqual([...new Set(block.map(node => node.page))], item.pages, `${item.name}: physical page span`);
    const tables = (item.tables ?? []).flatMap(table => [table.label, table.header,
      ...table.rows.map(row => row.join(" "))].filter(Boolean));
    assert.equal(normalize(block.map(node => node.join + node.text).join("")),
      normalize([item.name, `Wondrous item, ${item.rarity.replace("-", " ")}`,
        ...item.description, ...tables].join(" ")),
      `${item.name}: complete heading-bounded PDF text/table mismatch`);
  }
  return { records: 4, beansEffectRows: 12, tricksTables: 3, tricksCreatureRows: 24,
    derivedHeadingCount: 239, scope: "complete-heading-bounded-stream-with-die-range-and-color-table-ownership" };
}
