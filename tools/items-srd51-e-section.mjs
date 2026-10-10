import assert from "node:assert/strict";
import { extractSrdBodyNodes } from "./items-srd51-armor-arrows.mjs";

// Offline goldens for the full SRD5.1 E-section, physical/printed pages220–221.
// Whole heading blocks, not product data or a partial runtime provider.
export const E_SECTION = [
  { ordinal: 63, name: "Efficient Quiver", pages: [220], header: "Wondrous item, uncommon", rarity: "uncommon",
    parts: ["Each of the quiver’s three compartments connects to an extradimensional space that allows the quiver to hold numerous items while never weighing more than 2 pounds. The shortest compartment can hold up to sixty arrows, bolts, or similar objects. The midsize compartment holds up to eighteen javelins or similar objects. The longest compartment holds up to six long objects, such as bows, quarterstaffs, or spears.",
      "You can draw any item the quiver contains as if doing so from a regular quiver or scabbard."] },
  { ordinal: 64, name: "Efreeti Bottle", pages: [220], header: "Wondrous item, very rare", rarity: "very-rare",
    parts: ["This painted brass bottle weighs 1 pound. When you use an action to remove the stopper, a cloud of thick smoke flows out of the bottle. At the end of your turn, the smoke disappears with a flash of harmless fire, and an efreeti appears in an unoccupied space within 30 feet of you.",
      "The first time the bottle is opened, the GM rolls to determine what happens.",
      { header: "d100 Effect", rows: [
        ["01–10", "The efreeti attacks you. After fighting for 5 rounds, the efreeti disappears, and the bottle loses its magic."],
        ["11–90", "The efreeti serves you for 1 hour, doing as you command. Then the efreeti returns to the bottle, and a new stopper contains it. The stopper can’t be removed for 24 hours. The next two times the bottle is opened, the same effect occurs. If the bottle is opened a fourth time, the efreeti escapes and disappears, and the bottle loses its magic."],
        ["91–00", "The efreeti can cast the wish spell three times for you. It disappears when it grants the final wish or after 1 hour, and the bottle loses its magic."],
      ] }] },
  { ordinal: 65, name: "Elemental Gem", pages: [220], header: "Wondrous item, uncommon", rarity: "uncommon",
    parts: ["This gem contains a mote of elemental energy. When you use an action to break the gem, an elemental is summoned as if you had cast the conjure elemental spell, and the gem’s magic is lost. The type of gem determines the elemental summoned by the spell.",
      { header: "Gem Summoned Elemental", rows: [["Blue sapphire", "Air elemental"], ["Yellow diamond", "Earth elemental"], ["Red corundum", "Fire elemental"], ["Emerald", "Water elemental"]] }] },
  { ordinal: 66, name: "Elven Chain", pages: [220], header: "Armor (chain shirt), rare", subcategory: "armor", rarity: "rare",
    parts: ["You gain a +1 bonus to AC while you wear this armor. You are considered proficient with this armor even if you lack proficiency with medium armor."] },
  { ordinal: 67, name: "Eversmoking Bottle", pages: [220], header: "Wondrous item, uncommon", rarity: "uncommon",
    parts: ["Smoke leaks from the lead-stoppered mouth of this brass bottle, which weighs 1 pound. When you use an action to remove the stopper, a cloud of thick smoke pours out in a 60-foot radius from the bottle. The cloud’s area is heavily obscured. Each minute the bottle remains open and within the cloud, the radius increases by 10 feet until it reaches its maximum radius of 120 feet.",
      "The cloud persists as long as the bottle is open. Closing the bottle requires you to speak its command word as an action. Once the bottle is closed, the cloud disperses after 10 minutes. A moderate wind (11 to 20 miles per hour) can also disperse the smoke after 1 minute, and a strong wind (21 or more miles per hour) can do so after 1 round."] },
  { ordinal: 68, name: "Eyes of Charming", pages: [220, 221], header: "Wondrous item, uncommon (requires attunement)", rarity: "uncommon", attunement: true,
    parts: ["These crystal lenses fit over the eyes. They have 3 charges. While wearing them, you can expend 1 charge as an action to cast the charm person spell (save DC 13) on a humanoid within 30 feet of you, provided that you and the target can see each other. The lenses regain all expended charges daily at dawn."] },
  { ordinal: 69, name: "Eyes of Minute Seeing", pages: [221], header: "Wondrous item, uncommon", rarity: "uncommon",
    parts: ["These crystal lenses fit over the eyes. While wearing them, you can see much better than normal out to a range of 1 foot. You have advantage on Intelligence (Investigation) checks that rely on sight while searching an area or studying an object within that range."] },
  { ordinal: 70, name: "Eyes of the Eagle", pages: [221], header: "Wondrous item, uncommon (requires attunement)", rarity: "uncommon", attunement: true,
    parts: ["These crystal lenses fit over the eyes. While wearing them, you have advantage on Wisdom (Perception) checks that rely on sight. In conditions of clear visibility, you can make out details of even extremely distant creatures and objects as small as 2 feet across."] },
];

const tableLines = table => [table.header, ...table.rows.map(row => row.join(" "))];
export function eSectionSourceRows() {
  return E_SECTION.map(item => {
    const id = `srd51:magic-item:magic-items-a-z:${item.ordinal}`;
    return { occurrence: { id, feed: "magic-item", sectionId: "magic-items-a-z", sourceKind: "detail-heading",
      sourceTable: "Magic Items A–Z", sourceLabel: item.name, firstPdfPage: item.pages[0], lastPdfPage: item.pages.at(-1),
      firstPrintedPage: item.pages[0], lastPrintedPage: item.pages.at(-1), ordinal: item.ordinal, variantId: null, mergeIntoId: null },
      record: { id, name: item.name, category: "magic-item", subcategory: item.subcategory ?? "wondrous-item", magic: true,
        rarity: { kind: "fixed", value: item.rarity }, attunement: item.attunement ? "required" : "not-required",
        sourceHeader: { text: item.header, occurrenceId: id },
        properties: item.parts.filter(part => typeof part !== "string").flatMap(table => table.rows.map(([name, description]) => ({
          name: `${table.header}: ${name}`, description, occurrenceId: id,
        }))),
        description: item.parts.flatMap(part => typeof part === "string" ? [part] : tableLines(part)).map(text => ({ text, occurrenceId: id })),
        source: { document: "SRD 5.1", pdfUrl: "https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf",
          pdfPages: [...item.pages], printedPages: [...item.pages], occurrenceIds: [id] } } };
  });
}

export function validateESectionSlice(transcript, inventory) {
  for (const expected of eSectionSourceRows()) {
    assert.deepEqual(inventory.occurrences.find(row => row.id === expected.occurrence.id), expected.occurrence,
      `${expected.record.name}: occurrence identity/page/merge drift`);
    assert.deepEqual(transcript.records.find(row => row.id === expected.record.id), expected.record,
      `${expected.record.name}: complete header/prose/table drift`);
  }
  return { ordinals: E_SECTION.map(item => item.ordinal), records: 8, pages: [220, 221], efreetiEffectRows: 3, elementalGemRows: 4 };
}

export function validateESectionPdfXml(xml, headings, normalize) {
  assert.equal(headings.length, 239, "A–Z total heading count");
  assert.deepEqual(headings.slice(61, 71), ["Dwarven Thrower", ...E_SECTION.map(item => item.name), "Feather Token"],
    "complete E-section boundary sequence");
  const nodes = extractSrdBodyNodes(xml, normalize);
  for (const [index, item] of E_SECTION.entries()) {
    const starts = nodes.flatMap((node, index) => node.text === item.name ? [index] : []);
    assert.equal(starts.length, 1, `${item.name}: exactly one heading required`);
    const start = starts[0], next = E_SECTION[index + 1]?.name ?? "Feather Token";
    const end = nodes.findIndex((node, index) => index > start && node.text === next);
    assert.ok(end > start, `${item.name}: heading bounds missing`);
    const block = nodes.slice(start, end);
    assert.deepEqual([...new Set(block.map(node => node.page))], item.pages, `${item.name}: physical page span`);
    assert.equal(normalize(block.map(node => node.join + node.text).join("")),
      normalize([item.name, item.header, ...item.parts.flatMap(part => typeof part === "string" ? [part] : tableLines(part))].join(" ")),
      `${item.name}: complete heading-bounded PDF text/table mismatch`);
  }
  return { records: 8, efreetiEffectRows: 3, elementalGemRows: 4, derivedHeadingCount: 239,
    scope: "complete-heading-stream-with-owned-roll-gem-tables-conditional-rules-and-page-continuation" };
}
