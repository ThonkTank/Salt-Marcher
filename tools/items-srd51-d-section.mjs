import assert from "node:assert/strict";
import { extractSrdBodyNodes } from "./items-srd51-armor-arrows.mjs";

// SRD5.1 physical/printed pages215–220. Offline, full heading-block goldens;
// not a product artifact. Tables and embedded statblock retain source order.
export const D_SECTION = [
  { ordinal: 48, name: "Dagger of Venom", pages: [215], subcategory: "weapon", header: "Weapon (dagger), rare", rarity: "rare",
    parts: ["You gain a +1 bonus to attack and damage rolls made with this magic weapon.",
      "You can use an action to cause thick, black poison to coat the blade. The poison remains for 1 minute or until an attack using this weapon hits a creature. That creature must succeed on a DC 15 Constitution saving throw or take 2d10 poison damage and become poisoned for 1 minute. The dagger can’t be used this way again until the next dawn."] },
  { ordinal: 49, name: "Dancing Sword", pages: [215, 216], subcategory: "weapon", header: "Weapon (any sword), very rare (requires attunement)", rarity: "very-rare", attunement: true,
    parts: ["You can use a bonus action to toss this magic sword into the air and speak the command word. When you do so, the sword begins to hover, flies up to 30 feet, and attacks one creature of your choice within 5 feet of it. The sword uses your attack roll and ability score modifier to damage rolls.",
      "While the sword hovers, you can use a bonus action to cause it to fly up to 30 feet to another spot within 30 feet of you. As part of the same bonus action, you can cause the sword to attack one creature within 5 feet of it.",
      "After the hovering sword attacks for the fourth time, it flies up to 30 feet and tries to return to your hand. If you have no hand free, it falls to the ground at your feet. If the sword has no unobstructed path to you, it moves as close to you as it can and then falls to the ground. It also ceases to hover if you grasp it or move more than 30 feet away from it."] },
  { ordinal: 50, name: "Decanter of Endless Water", pages: [216], header: "Wondrous item, uncommon", rarity: "uncommon",
    parts: ["This stoppered flask sloshes when shaken, as if it contains water. The decanter weighs 2 pounds.",
      "You can use an action to remove the stopper and speak one of three command words, whereupon an amount of fresh water or salt water (your choice) pours out of the flask. The water stops pouring out at the start of your next turn. Choose from the following options:",
      "• “Stream” produces 1 gallon of water.", "• “Fountain” produces 5 gallons of water.",
      "• “Geyser” produces 30 gallons of water that gushes forth in a geyser 30 feet long and 1 foot wide. As a bonus action while holding the decanter, you can aim the geyser at a creature you can see within 30 feet of you. The target must succeed on a DC 13 Strength saving throw or take 1d4 bludgeoning damage and fall prone. Instead of a creature, you can target an object that isn’t being worn or carried and that weighs no more than 200 pounds. The object is either knocked over or pushed up to 15 feet away from you."] },
  { ordinal: 51, name: "Deck of Illusions", pages: [216], header: "Wondrous item, uncommon", rarity: "uncommon",
    parts: ["This box contains a set of parchment cards. A full deck has 34 cards. A deck found as treasure is usually missing 1d20 − 1 cards.",
      "The magic of the deck functions only if cards are drawn at random (you can use an altered deck of playing cards to simulate the deck). You can use an action to draw a card at random from the deck and throw it to the ground at a point within 30 feet of you.",
      "An illusion of one or more creatures forms over the thrown card and remains until dispelled. An illusory creature appears real, of the appropriate size, and behaves as if it were a real creature except that it can do no harm. While you are within 120 feet of the illusory creature and can see it, you can use an action to move it magically anywhere within 30 feet of its card. Any physical interaction with the illusory creature reveals it to be an illusion, because objects pass through it. Someone who uses an action to visually inspect the creature identifies it as illusory with a successful DC 15 Intelligence (Investigation) check. The creature then appears translucent.",
      "The illusion lasts until its card is moved or the illusion is dispelled. When the illusion ends, the image on its card disappears, and that card can’t be used again.",
      { header: "Playing Card Illusion", rows: [
        ["Ace of hearts", "Red dragon"], ["King of hearts", "Knight and four guards"], ["Queen of hearts", "Succubus or incubus"], ["Jack of hearts", "Druid"], ["Ten of hearts", "Cloud giant"], ["Nine of hearts", "Ettin"], ["Eight of hearts", "Bugbear"], ["Two of hearts", "Goblin"],
        ["Ace of diamonds", "Beholder"], ["King of diamonds", "Archmage and mage apprentice"], ["Queen of diamonds", "Night hag"], ["Jack of diamonds", "Assassin"], ["Ten of diamonds", "Fire giant"], ["Nine of diamonds", "Ogre mage"], ["Eight of diamonds", "Gnoll"], ["Two of diamonds", "Kobold"],
        ["Ace of spades", "Lich"], ["King of spades", "Priest and two acolytes"], ["Queen of spades", "Medusa"], ["Jack of spades", "Veteran"], ["Ten of spades", "Frost giant"], ["Nine of spades", "Troll"], ["Eight of spades", "Hobgoblin"], ["Two of spades", "Goblin"],
        ["Ace of clubs", "Iron golem"], ["King of clubs", "Bandit captain and three bandits"], ["Queen of clubs", "Erinyes"], ["Jack of clubs", "Berserker"], ["Ten of clubs", "Hill giant"], ["Nine of clubs", "Ogre"], ["Eight of clubs", "Orc"], ["Two of clubs", "Kobold"], ["Jokers (2)", "You (the deck’s owner)"],
      ] }] },
  { ordinal: 52, name: "Deck of Many Things", pages: [216, 217, 218], header: "Wondrous item, legendary", rarity: "legendary",
    parts: ["Usually found in a box or pouch, this deck contains a number of cards made of ivory or vellum. Most (75 percent) of these decks have only thirteen cards, but the rest have twenty-two.",
      "Before you draw a card, you must declare how many cards you intend to draw and then draw them randomly (you can use an altered deck of playing cards to simulate the deck). Any cards drawn in excess of this number have no effect. Otherwise, as soon as you draw a card from the deck, its magic takes effect. You must draw each card no more than 1 hour after the previous draw. If you fail to draw the chosen number, the remaining number of cards fly from the deck on their own and take effect all at once.",
      "Once a card is drawn, it fades from existence. Unless the card is the Fool or the Jester, the card reappears in the deck, making it possible to draw the same card twice.",
      { header: "Playing Card Card", rows: [
        ["Ace of diamonds", "Vizier*"], ["King of diamonds", "Sun"], ["Queen of diamonds", "Moon"], ["Jack of diamonds", "Star"], ["Two of diamonds", "Comet*"],
        ["Ace of hearts", "The Fates*"], ["King of hearts", "Throne"], ["Queen of hearts", "Key"], ["Jack of hearts", "Knight"], ["Two of hearts", "Gem*"],
        ["Ace of clubs", "Talons*"], ["King of clubs", "The Void"], ["Queen of clubs", "Flames"], ["Jack of clubs", "Skull"], ["Two of clubs", "Idiot*"],
        ["Ace of spades", "Donjon*"], ["King of spades", "Ruin"], ["Queen of spades", "Euryale"], ["Jack of spades", "Rogue"], ["Two of spades", "Balance*"], ["Joker (with TM)", "Fool*"], ["Joker (without TM)", "Jester"],
      ] },
      "*Found only in a deck with twenty-two cards",
      "Balance. Your mind suffers a wrenching alteration, causing your alignment to change. Lawful becomes chaotic, good becomes evil, and vice versa. If you are true neutral or unaligned, this card has no effect on you.",
      "Comet. If you single-handedly defeat the next hostile monster or group of monsters you encounter, you gain experience points enough to gain one level. Otherwise, this card has no effect.",
      "Donjon. You disappear and become entombed in a state of suspended animation in an extradimensional sphere. Everything you were wearing and carrying stays behind in the space you occupied when you disappeared. You remain imprisoned until you are found and removed from the sphere. You can’t be located by any divination magic, but a wish spell can reveal the location of your prison. You draw no more cards.",
      "Euryale. The card’s medusa-like visage curses you. You take a −2 penalty on saving throws while cursed in this way. Only a god or the magic of The Fates card can end this curse.",
      "The Fates. Reality’s fabric unravels and spins anew, allowing you to avoid or erase one event as if it never happened. You can use the card’s magic as soon as you draw the card or at any other time before you die.",
      "Flames. A powerful devil becomes your enemy. The devil seeks your ruin and plagues your life, savoring your suffering before attempting to slay you. This enmity lasts until either you or the devil dies.",
      "Fool. You lose 10,000 XP, discard this card, and draw from the deck again, counting both draws as one of your declared draws. If losing that much XP would cause you to lose a level, you instead lose an amount that leaves you with just enough XP to keep your level.",
      "Gem. Twenty-five pieces of jewelry worth 2,000 gp each or fifty gems worth 1,000 gp each appear at your feet.",
      "Idiot. Permanently reduce your Intelligence by 1d4 + 1 (to a minimum score of 1). You can draw one additional card beyond your declared draws.",
      "Jester. You gain 10,000 XP, or you can draw two additional cards beyond your declared draws.",
      "Key. A rare or rarer magic weapon with which you are proficient appears in your hands. The GM chooses the weapon.",
      "Knight. You gain the service of a 4th-level fighter who appears in a space you choose within 30 feet of you. The fighter is of the same race as you and serves you loyally until death, believing the fates have drawn him or her to you. You control this character.",
      "Moon. You are granted the ability to cast the wish spell 1d3 times.",
      "Rogue. A nonplayer character of the GM’s choice becomes hostile toward you. The identity of your new enemy isn’t known until the NPC or someone else reveals it. Nothing less than a wish spell or divine intervention can end the NPC’s hostility toward you.",
      "Ruin. All forms of wealth that you carry or own, other than magic items, are lost to you. Portable property vanishes. Businesses, buildings, and land you own are lost in a way that alters reality the least. Any documentation that proves you should own something lost to this card also disappears.",
      "Skull. You summon an avatar of death—a ghostly humanoid skeleton clad in a tattered black robe and carrying a spectral scythe. It appears in a space of the GM’s choice within 10 feet of you and attacks you, warning all others that you must win the battle alone. The avatar fights until you die or it drops to 0 hit points, whereupon it disappears. If anyone tries to help you, the helper summons its own avatar of death. A creature slain by an avatar of death can’t be restored to life.",
      // Embedded source statblock is part of this item, not an invented item
      // occurrence or a mutation of the independently owned Monster corpus.
      "Avatar of Death", "Medium undead, neutral evil", "Armor Class 20", "Hit Points half the hit point maximum of its summoner", "Speed 60 ft., fly 60 ft. (hover)",
      "STR DEX CON INT WIS CHA 16 (+3) 16 (+3) 16 (+3) 16 (+3) 16 (+3) 16 (+3)",
      "Damage Immunities necrotic, poison", "Condition Immunities charmed, frightened, paralyzed, petrified, poisoned, unconscious",
      "Senses darkvision 60 ft., truesight 60 ft., passive Perception 13", "Languages all languages known to its summoner", "Challenge — (0 XP)",
      "Incorporeal Movement. The avatar can move through other creatures and objects as if they were difficult terrain. It takes 5 (1d10) force damage if it ends its turn inside an object.",
      "Turning Immunity. The avatar is immune to features that turn undead.", "Actions",
      "Reaping Scythe. The avatar sweeps its spectral scythe through a creature within 5 feet of it, dealing 7 (1d8 + 3) slashing damage plus 4 (1d8) necrotic damage.",
      "Star. Increase one of your ability scores by 2. The score can exceed 20 but can’t exceed 24.",
      "Sun. You gain 50,000 XP, and a wondrous item (which the GM determines randomly) appears in your hands.",
      "Talons. Every magic item you wear or carry disintegrates. Artifacts in your possession aren’t destroyed but do vanish.",
      "Throne. You gain proficiency in the Persuasion skill, and you double your proficiency bonus on checks made with that skill. In addition, you gain rightful ownership of a small keep somewhere in the world. However, the keep is currently in the hands of monsters, which you must clear out before you can claim the keep as yours.",
      "Vizier. At any time you choose within one year of drawing this card, you can ask a question in meditation and mentally receive a truthful answer to that question. Besides information, the answer helps you solve a puzzling problem or other dilemma. In other words, the knowledge comes with wisdom on how to apply it.",
      "The Void. This black card spells disaster. Your soul is drawn from your body and contained in an object in a place of the GM’s choice. One or more powerful beings guard the place. While your soul is trapped in this way, your body is incapacitated. A wish spell can’t restore your soul, but the spell reveals the location of the object that holds it. You draw no more cards."] },
  { ordinal: 53, name: "Defender", pages: [218], subcategory: "weapon", header: "Weapon (any sword), legendary (requires attunement)", rarity: "legendary", attunement: true,
    parts: ["You gain a +3 bonus to attack and damage rolls made with this magic weapon.",
      "The first time you attack with the sword on each of your turns, you can transfer some or all of the sword’s bonus to your Armor Class, instead of using the bonus on any attacks that turn. For example, you could reduce the bonus to your attack and damage rolls to +1 and gain a +2 bonus to AC. The adjusted bonuses remain in effect until the start of your next turn, although you must hold the sword to gain a bonus to AC from it."] },
  { ordinal: 54, name: "Demon Armor", pages: [218], subcategory: "armor", header: "Armor (plate), very rare (requires attunement)", rarity: "very-rare", attunement: true,
    parts: ["While wearing this armor, you gain a +1 bonus to AC, and you can understand and speak Abyssal. In addition, the armor’s clawed gauntlets turn unarmed strikes with your hands into magic weapons that deal slashing damage, with a +1 bonus to attack rolls and damage rolls and a damage die of 1d8.",
      "Curse. Once you don this cursed armor, you can’t doff it unless you are targeted by the remove curse spell or similar magic. While wearing the armor, you have disadvantage on attack rolls against demons and on saving throws against their spells and special abilities."] },
  { ordinal: 55, name: "Dimensional Shackles", pages: [219], header: "Wondrous item, rare", rarity: "rare",
    parts: ["You can use an action to place these shackles on an incapacitated creature. The shackles adjust to fit a creature of Small to Large size. In addition to serving as mundane manacles, the shackles prevent a creature bound by them from using any method of extradimensional movement, including teleportation or travel to a different plane of existence. They don’t prevent the creature from passing through an interdimensional portal.",
      "You and any creature you designate when you use the shackles can use an action to remove them. Once every 30 days, the bound creature can make a DC 30 Strength (Athletics) check. On a success, the creature breaks free and destroys the shackles."] },
  { ordinal: 56, name: "Dragon Scale Mail", pages: [219], subcategory: "armor", header: "Armor (scale mail), very rare (requires attunement)", rarity: "very-rare", attunement: true,
    parts: ["Dragon scale mail is made of the scales of one kind of dragon. Sometimes dragons collect their cast-off scales and gift them to humanoids. Other times, hunters carefully skin and preserve the hide of a dead dragon. In either case, dragon scale mail is highly valued.",
      "While wearing this armor, you gain a +1 bonus to AC, you have advantage on saving throws against the Frightful Presence and breath weapons of dragons, and you have resistance to one damage type that is determined by the kind of dragon that provided the scales (see the table).",
      "Additionally, you can focus your senses as an action to magically discern the distance and direction to the closest dragon within 30 miles of you that is of the same type as the armor. This special action can’t be used again until the next dawn.",
      { header: "Dragon Resistance Dragon Resistance", rows: [["Black", "Acid"], ["Blue", "Lightning"], ["Brass", "Fire"], ["Bronze", "Lightning"], ["Copper", "Acid"], ["Gold", "Fire"], ["Green", "Poison"], ["Red", "Fire"], ["Silver", "Cold"], ["White", "Cold"]],
        // Five physical paired rows; ten owned logical cells. Never sort or
        // flatten away the left/right pairing in the PDF comparison.
        pdfRows: [["Black", "Acid", "Gold", "Fire"], ["Blue", "Lightning", "Green", "Poison"], ["Brass", "Fire", "Red", "Fire"], ["Bronze", "Lightning", "Silver", "Cold"], ["Copper", "Acid", "White", "Cold"]] }] },
  { ordinal: 57, name: "Dragon Slayer", pages: [219], subcategory: "weapon", header: "Weapon (any sword), rare", rarity: "rare",
    parts: ["You gain a +1 bonus to attack and damage rolls made with this magic weapon.",
      "When you hit a dragon with this weapon, the dragon takes an extra 3d6 damage of the weapon’s type. For the purpose of this weapon, “dragon” refers to any creature with the dragon type, including dragon turtles and wyverns."] },
  { ordinal: 58, name: "Dust of Disappearance", pages: [219], header: "Wondrous item, uncommon", rarity: "uncommon",
    parts: ["Found in a small packet, this powder resembles very fine sand. There is enough of it for one use. When you use an action to throw the dust into the air, you and each creature and object within 10 feet of you become invisible for 2d4 minutes. The duration is the same for all subjects, and the dust is consumed when its magic takes effect. If a creature affected by the dust attacks or casts a spell, the invisibility ends for that creature."] },
  { ordinal: 59, name: "Dust of Dryness", pages: [219], header: "Wondrous item, uncommon", rarity: "uncommon",
    parts: ["This small packet contains 1d6 + 4 pinches of dust. You can use an action to sprinkle a pinch of it over water. The dust turns a cube of water 15 feet on a side into one marble-sized pellet, which floats or rests near where the dust was sprinkled. The pellet’s weight is negligible.",
      "Someone can use an action to smash the pellet against a hard surface, causing the pellet to shatter and release the water the dust absorbed. Doing so ends that pellet’s magic.",
      "An elemental composed mostly of water that is exposed to a pinch of the dust must make a DC 13 Constitution saving throw, taking 10d6 necrotic damage on a failed save, or half as much damage on a successful one."] },
  { ordinal: 60, name: "Dust of Sneezing and Choking", pages: [219], header: "Wondrous item, uncommon", rarity: "uncommon",
    parts: ["Found in a small container, this powder resembles very fine sand. It appears to be dust of disappearance, and an identify spell reveals it to be such. There is enough of it for one use.",
      "When you use an action to throw a handful of the dust into the air, you and each creature that needs to breathe within 30 feet of you must succeed on a DC 15 Constitution saving throw or become unable to breathe, while sneezing uncontrollably. A creature affected in this way is incapacitated and suffocating. As long as it is conscious, a creature can repeat the saving throw at the end of each of its turns, ending the effect on it on a success. The lesser restoration spell can also end the effect on a creature."] },
  { ordinal: 61, name: "Dwarven Plate", pages: [220], subcategory: "armor", header: "Armor (plate), very rare", rarity: "very-rare",
    parts: ["While wearing this armor, you gain a +2 bonus to AC. In addition, if an effect moves you against your will along the ground, you can use your reaction to reduce the distance you are moved by up to 10 feet."] },
  { ordinal: 62, name: "Dwarven Thrower", pages: [220], subcategory: "weapon", header: "Weapon (warhammer), very rare (requires attunement by a dwarf)", rarity: "very-rare", attunement: true,
    parts: ["You gain a +3 bonus to attack and damage rolls made with this magic weapon. It has the thrown property with a normal range of 20 feet and a long range of 60 feet. When you hit with a ranged attack using this weapon, it deals an extra 1d8 damage or, if the target is a giant, 2d8 damage. Immediately after the attack, the weapon flies back to your hand."] },
];

const tableLines = table => [table.header, ...(table.pdfRows ?? table.rows).map(row => row.join(" "))];
export function dSectionSourceRows() {
  return D_SECTION.map(item => {
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

export function validateDSectionSlice(transcript, inventory) {
  for (const expected of dSectionSourceRows()) {
    assert.deepEqual(inventory.occurrences.find(row => row.id === expected.occurrence.id), expected.occurrence,
      `${expected.record.name}: occurrence identity/page/merge drift`);
    assert.deepEqual(transcript.records.find(row => row.id === expected.record.id), expected.record,
      `${expected.record.name}: complete header/prose/table/statblock drift`);
  }
  return { ordinals: D_SECTION.map(item => item.ordinal), records: 15, pages: [215, 216, 217, 218, 219, 220],
    illusionTableRows: 33, manyThingsTableRows: 22, manyThingsCardRules: 22, embeddedAvatarStatblocks: 1, dragonResistanceCells: 10 };
}

export function validateDSectionPdfXml(xml, headings, normalize) {
  assert.equal(headings.length, 239, "A–Z total heading count");
  assert.deepEqual(headings.slice(46, 63), ["Cubic Gate", ...D_SECTION.map(item => item.name), "Efficient Quiver"],
    "complete D-section boundary sequence");
  const nodes = extractSrdBodyNodes(xml, normalize);
  for (const [index, item] of D_SECTION.entries()) {
    const starts = nodes.flatMap((node, index) => node.text === item.name ? [index] : []);
    assert.equal(starts.length, 1, `${item.name}: exactly one heading required`);
    const start = starts[0], next = D_SECTION[index + 1]?.name ?? "Efficient Quiver";
    const end = nodes.findIndex((node, index) => index > start && node.text === next);
    assert.ok(end > start, `${item.name}: heading bounds missing`);
    const block = nodes.slice(start, end);
    assert.deepEqual([...new Set(block.map(node => node.page))], item.pages, `${item.name}: physical page span`);
    assert.equal(normalize(block.map(node => node.join + node.text).join("")),
      normalize([item.name, item.header, ...item.parts.flatMap(part => typeof part === "string" ? [part] : tableLines(part))].join(" ")),
      `${item.name}: complete heading-bounded PDF text/table/statblock mismatch`);
  }
  return { records: 15, illusionTableRows: 33, manyThingsTableRows: 22, manyThingsCardRules: 22,
    embeddedAvatarStatblocks: 1, dragonResistanceCells: 10, derivedHeadingCount: 239,
    scope: "complete-heading-stream-with-owned-tables-all-card-rules-embedded-statblock-and-page-continuations" };
}
