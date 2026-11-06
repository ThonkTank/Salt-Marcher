import assert from "node:assert/strict";
import { extractSrdBodyNodes } from "./items-srd51-armor-arrows.mjs";

// Official SRD 5.1, physical/printed pages 211–213. Offline source
// goldens only: no product artifact, runtime provider or implicit merges.
export const B_SECTION = [
  { ordinal: 18, name: "Bead of Force", pages: [211], header: "Wondrous item, rare",
    description: [
      "This small black sphere measures 3/4 of an inch in diameter and weighs an ounce. Typically, 1d4 + 4 beads of force are found together.",
      "You can use an action to throw the bead up to 60 feet. The bead explodes on impact and is destroyed. Each creature within a 10-foot radius of where the bead landed must succeed on a DC 15 Dexterity saving throw or take 5d4 force damage. A sphere of transparent force then encloses the area for 1 minute. Any creature that failed the save and is completely within the area is trapped inside this sphere. Creatures that succeeded on the save, or are partially within the area, are pushed away from the center of the sphere until they are no longer inside it. Only breathable air can pass through the sphere’s wall. No attack or other effect can.",
      "An enclosed creature can use its action to push against the sphere’s wall, moving the sphere up to half the creature’s walking speed. The sphere can be picked up, and its magic causes it to weigh only 1 pound, regardless of the weight of creatures inside.",
    ] },
  { ordinal: 19, name: "Belt of Dwarvenkind", pages: [211], header: "Wondrous item, rare (requires attunement)",
    description: [
      "While wearing this belt, you gain the following benefits:",
      "• Your Constitution score increases by 2, to a maximum of 20.",
      "• You have advantage on Charisma (Persuasion) checks made to interact with dwarves.",
      "In addition, while attuned to the belt, you have a 50 percent chance each day at dawn of growing a full beard if you’re capable of growing one, or a visibly thicker beard if you already have one.",
      "If you aren’t a dwarf, you gain the following additional benefits while wearing the belt:",
      "• You have advantage on saving throws against poison, and you have resistance against poison damage.",
      "• You have darkvision out to a range of 60 feet.",
      "• You can speak, read, and write Dwarvish.",
    ] },
  { ordinal: 20, name: "Belt of Giant Strength", pages: [211], header: "Wondrous item, rarity varies (requires attunement)",
    description: [
      "While wearing this belt, your Strength score changes to a score granted by the belt. If your Strength is already equal to or greater than the belt’s score, the item has no effect on you.",
      "Six varieties of this belt exist, corresponding with and having rarity according to the six kinds of true giants. The belt of stone giant strength and the belt of frost giant strength look different, but they have the same effect.",
    ],
    // Five physical rows, not six fabricated headings/occurrences. The
    // combined Stone/frost row stays combined; prose retains six varieties.
    table: [["Hill giant", "21", "Rare"], ["Stone/frost giant", "23", "Very rare"],
      ["Fire giant", "25", "Very rare"], ["Cloud giant", "27", "Legendary"],
      ["Storm giant", "29", "Legendary"]] },
  { ordinal: 21, name: "Berserker Axe", pages: [211, 212], header: "Weapon (any axe), rare (requires attunement)",
    description: [
      "You gain a +1 bonus to attack and damage rolls made with this magic weapon. In addition, while you are attuned to this weapon, your hit point maximum increases by 1 for each level you have attained.",
      "Curse. This axe is cursed, and becoming attuned to it extends the curse to you. As long as you remain cursed, you are unwilling to part with the axe, keeping it within reach at all times. You also have disadvantage on attack rolls with weapons other than this one, unless no foe is within 60 feet of you that you can see or hear.",
      "Whenever a hostile creature damages you while the axe is in your possession, you must succeed on a DC 15 Wisdom saving throw or go berserk. While berserk, you must use your action each round to attack the creature nearest to you with the axe. If you can make extra attacks as part of the Attack action, you use those extra attacks, moving to attack the next nearest creature after you fell your current target. If you have multiple possible targets, you attack one at random. You are berserk until you start your turn with no creatures within 60 feet of you that you can see or hear.",
    ] },
  { ordinal: 22, name: "Boots of Elvenkind", pages: [212], header: "Wondrous item, uncommon",
    description: ["While you wear these boots, your steps make no sound, regardless of the surface you are moving across. You also have advantage on Dexterity (Stealth) checks that rely on moving silently."] },
  { ordinal: 23, name: "Boots of Levitation", pages: [212], header: "Wondrous item, rare (requires attunement)",
    description: ["While you wear these boots, you can use an action to cast the levitate spell on yourself at will."] },
  { ordinal: 24, name: "Boots of Speed", pages: [212], header: "Wondrous item, rare (requires attunement)",
    description: [
      "While you wear these boots, you can use a bonus action and click the boots’ heels together. If you do, the boots double your walking speed, and any creature that makes an opportunity attack against you has disadvantage on the attack roll. If you click your heels together again, you end the effect.",
      "When the boots’ property has been used for a total of 10 minutes, the magic ceases to function until you finish a long rest.",
    ] },
  { ordinal: 25, name: "Boots of Striding and Springing", pages: [212], header: "Wondrous item, uncommon (requires attunement)",
    description: ["While you wear these boots, your walking speed becomes 30 feet, unless your walking speed is higher, and your speed isn’t reduced if you are encumbered or wearing heavy armor. In addition, you can jump three times the normal distance, though you can’t jump farther than your remaining movement would allow."] },
  { ordinal: 26, name: "Boots of the Winterlands", pages: [212], header: "Wondrous item, uncommon (requires attunement)",
    description: [
      "These furred boots are snug and feel quite warm. While you wear them, you gain the following benefits:",
      "• You have resistance to cold damage.",
      "• You ignore difficult terrain created by ice or snow.",
      "• You can tolerate temperatures as low as −50 degrees Fahrenheit without any additional protection. If you wear heavy clothes, you can tolerate temperatures as low as −100 degrees Fahrenheit.",
    ] },
  { ordinal: 27, name: "Bowl of Commanding Water Elementals", pages: [212], header: "Wondrous item, rare",
    description: [
      "While this bowl is filled with water, you can use an action to speak the bowl’s command word and summon a water elemental, as if you had cast the conjure elemental spell. The bowl can’t be used this way again until the next dawn.",
      "The bowl is about 1 foot in diameter and half as deep. It weighs 3 pounds and holds about 3 gallons.",
    ] },
  { ordinal: 28, name: "Bracers of Archery", pages: [212], header: "Wondrous item, uncommon (requires attunement)",
    description: ["While wearing these bracers, you have proficiency with the longbow and shortbow, and you gain a +2 bonus to damage rolls on ranged attacks made with such weapons."] },
  { ordinal: 29, name: "Bracers of Defense", pages: [212], header: "Wondrous item, rare (requires attunement)",
    description: ["While wearing these bracers, you gain a +2 bonus to AC if you are wearing no armor and using no shield."] },
  { ordinal: 30, name: "Brazier of Commanding Fire Elementals", pages: [212], header: "Wondrous item, rare",
    description: [
      "While a fire burns in this brass brazier, you can use an action to speak the brazier’s command word and summon a fire elemental, as if you had cast the conjure elemental spell. The brazier can’t be used this way again until the next dawn.",
      "The brazier weighs 5 pounds.",
    ] },
  { ordinal: 31, name: "Brooch of Shielding", pages: [212], header: "Wondrous item, uncommon (requires attunement)",
    description: ["While wearing this brooch, you have resistance to force damage, and you have immunity to damage from the magic missile spell."] },
  { ordinal: 32, name: "Broom of Flying", pages: [213], header: "Wondrous item, uncommon",
    description: [
      "This wooden broom, which weighs 3 pounds, functions like a mundane broom until you stand astride it and speak its command word. It then hovers beneath you and can be ridden in the air. It has a flying speed of 50 feet. It can carry up to 400 pounds, but its flying speed becomes 30 feet while carrying over 200 pounds. The broom stops hovering when you land.",
      "You can send the broom to travel alone to a destination within 1 mile of you if you speak the command word, name the location, and are familiar with that place. The broom comes back to you when you speak another command word, provided that the broom is still within 1 mile of you.",
    ] },
];

export function bSectionSourceRows() {
  return B_SECTION.map(item => {
    const id = `srd51:magic-item:magic-items-a-z:${item.ordinal}`;
    const occurrence = { id, feed: "magic-item", sectionId: "magic-items-a-z",
      sourceKind: "detail-heading", sourceTable: "Magic Items A–Z", sourceLabel: item.name,
      firstPdfPage: item.pages[0], lastPdfPage: item.pages.at(-1),
      firstPrintedPage: item.pages[0], lastPrintedPage: item.pages.at(-1),
      ordinal: item.ordinal, variantId: null, mergeIntoId: null };
    const rarity = item.table ? { kind: "varies", sourceText: "rarity varies",
      choices: item.table.map(([label, , value], index) => ({
        variantId: `${id}#variant:${index + 1}`, label,
        value: value.toLowerCase().replace(" ", "-"), occurrenceId: id,
      })) } : { kind: "fixed", value: item.header.includes(", uncommon") ? "uncommon" : "rare" };
    const record = { id, name: item.name, category: "magic-item",
      subcategory: item.ordinal === 21 ? "weapon" : "wondrous-item", magic: true, rarity,
      attunement: item.header.includes("requires attunement") ? "required" : "not-required",
      sourceHeader: { text: item.header, occurrenceId: id },
      properties: (item.table ?? []).map(([name, strength, rarity]) => ({
        name, description: `${strength} ${rarity}`, occurrenceId: id,
      })),
      description: [...item.description, ...(item.table ? ["Type Strength Rarity"] : [])]
        .map(text => ({ text, occurrenceId: id })),
      source: { document: "SRD 5.1", pdfUrl: "https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf",
        pdfPages: [...item.pages], printedPages: [...item.pages], occurrenceIds: [id] } };
    return { occurrence, record };
  });
}

export function validateBSectionSlice(transcript, inventory) {
  for (const expected of bSectionSourceRows()) {
    assert.deepEqual(inventory.occurrences.find(row => row.id === expected.occurrence.id),
      expected.occurrence, `${expected.record.name}: occurrence identity/page/merge drift`);
    assert.deepEqual(transcript.records.find(row => row.id === expected.record.id),
      expected.record, `${expected.record.name}: complete header/prose/table/choice drift`);
  }
  return { ordinals: B_SECTION.map(item => item.ordinal), records: 15, pages: [211, 212, 213],
    beltTableRows: 5, beltRarityChoices: 5, beltProseVarieties: 6 };
}

export function validateBSectionPdfXml(xml, headings, normalize) {
  assert.equal(headings.length, 239, "A–Z total heading count");
  assert.deepEqual(headings.slice(16, 33), ["Bag of Tricks", ...B_SECTION.map(item => item.name),
    "Candle of Invocation"], "remaining B-section boundary sequence");
  const nodes = extractSrdBodyNodes(xml, normalize);
  for (const [index, item] of B_SECTION.entries()) {
    const starts = nodes.flatMap((node, index) => node.text === item.name ? [index] : []);
    assert.equal(starts.length, 1, `${item.name}: exactly one heading required`);
    const start = starts[0];
    const nextName = B_SECTION[index + 1]?.name ?? "Candle of Invocation";
    const end = nodes.findIndex((node, offset) => offset > start && node.text === nextName);
    assert.ok(end > start, `${item.name}: heading bounds missing`);
    const block = nodes.slice(start, end);
    assert.deepEqual([...new Set(block.map(node => node.page))], item.pages,
      `${item.name}: physical page span`);
    const table = item.table ? ["Type Strength Rarity", ...item.table.map(row => row.join(" "))] : [];
    assert.equal(normalize(block.map(node => node.join + node.text).join("")),
      normalize([item.name, item.header, ...item.description, ...table].join(" ")),
      `${item.name}: complete heading-bounded PDF text/table mismatch`);
  }
  return { records: 15, beltTableRows: 5, beltProseVarieties: 6, derivedHeadingCount: 239,
    scope: "complete-heading-bounded-stream-with-combined-variant-row-and-cross-page-curse" };
}
