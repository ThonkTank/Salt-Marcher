  "AGENTS.md": `# Ziele
- Sammelte Kreaturen-Presets (Statblocks) für Parser- und Exporttests.
- Stellt realistische Daten jenseits der Golden-Tests bereit.

# Aktueller Stand
- Unterordner gliedern nach Typ (Animals, Monsters).
- Frontmatter + Markdown bilden die aktuelle Struktur.

# ToDo
- [P2] Legendäre/Lair-Komponenten ergänzen.
- [P3] Verweise zu Referenzquellen hinzufügen.

# Standards
- Parser-Konventionen befolgen (z. B. \`attributes\`, \`actions\`).
- Änderungen mit \`tests/library/statblock-to-markdown.test.ts\` gegenprüfen.
`,
  "Animals/AGENTS.md": `# Ziele
- Enthält Tier-Presets für Tiere/Begleiter als Parser-Input.
- Unterstützt Funktionen wie Wildshape- oder Companion-Listen.

# Aktueller Stand
- Markdown-Statblocks mit Frontmatter.
- Keine Automatisierung; manuell gepflegt.

# ToDo
- [P3] Weitere Biome repräsentieren (Aquatic, Arctic).
- [P3] Kennzeichnen, welche Presets bereits exportiert wurden.

# Standards
- Schema-Konventionen respektieren (\`speed\`, \`senses\`, etc.).
- Änderungen nach Tests (\`library\`) validieren.
`,
  "Animals/allosaurus.md": `---
  "Animals/ankylosaurus.md": `---
  "Animals/ape.md": `---
  "Animals/archelon.md": `---
  "Animals/baboon.md": `---
  "Animals/badger.md": `---
  "Animals/bat.md": `---
  "Animals/black-bear.md": `---
  "Animals/blood-hawk.md": `---
  "Animals/boar.md": `---
  "Animals/brown-bear.md": `---
  "Animals/camel.md": `---
  "Animals/cat.md": `---
  "Animals/constrictor-snake.md": `---
  "Animals/crab.md": `---
  "Animals/crocodile.md": `---
  "Animals/deer.md": `---
  "Animals/dire-wolf.md": `---
  "Animals/draft-horse.md": `---
  "Animals/eagle.md": `---
  "Animals/elephant.md": `---
  "Animals/elk.md": `---
  "Animals/flying-snake.md": `---
  "Animals/frog.md": `---
  "Animals/giant-ape.md": `---
  "Animals/giant-badger.md": `---
  "Animals/giant-bat.md": `---
  "Animals/giant-boar.md": `---
  "Animals/giant-centipede.md": `---
  "Animals/giant-constrictor-snake.md": `---
  "Animals/giant-crab.md": `---
  "Animals/giant-crocodile.md": `---
  "Animals/giant-eagle.md": `---
  "Animals/giant-elk.md": `---
  "Animals/giant-fire-beetle.md": `---
  "Animals/giant-frog.md": `---
  "Animals/giant-goat.md": `---
  "Animals/giant-hyena.md": `---
  "Animals/giant-lizard.md": `---
  "Animals/giant-octopus.md": `---
  "Animals/giant-owl.md": `---
  "Animals/giant-rat.md": `---
  "Animals/giant-scorpion.md": `---
  "Animals/giant-seahorse.md": `---
  "Animals/giant-shark.md": `---
  "Animals/giant-spider.md": `---
  "Animals/giant-toad.md": `---
  "Animals/giant-venomous-snake.md": `---
  "Animals/giant-vulture.md": `---
  "Animals/giant-wasp.md": `---
  "Animals/giant-weasel.md": `---
  "Animals/giant-wolf-spider.md": `---
  "Animals/goat.md": `---
  "Animals/hawk.md": `---
  "Animals/hippopotamus.md": `---
  "Animals/hunter-shark.md": `---
  "Animals/hyena.md": `---
  "Animals/jackal.md": `---
  "Animals/killer-whale.md": `---
  "Animals/lion.md": `---
  "Animals/lizard.md": `---
  "Animals/mammoth.md": `---
  "Animals/mastiff.md": `---
  "Animals/mule.md": `---
  "Animals/owl.md": `---
  "Animals/panther.md": `---
  "Animals/piranha.md": `---
  "Animals/plesiosaurus.md": `---
  "Animals/polar-bear.md": `---
  "Animals/pony.md": `---
  "Animals/pteranodon.md": `---
  "Animals/rat.md": `---
  "Animals/raven.md": `---
  "Animals/reef-shark.md": `---
  "Animals/rhinoceros.md": `---
  "Animals/riding-horse.md": `---
  "Animals/saber-toothed-tiger.md": `---
  "Animals/scorpion.md": `---
  "Animals/seahorse.md": `---
  "Animals/spider.md": `---
  "Animals/swarm-of-bats.md": `---
  "Animals/swarm-of-insects.md": `---
  "Animals/swarm-of-piranhas.md": `---
  "Animals/swarm-of-rats.md": `---
  "Animals/swarm-of-ravens.md": `---
  "Animals/swarm-of-venomous-snakes.md": `---
  "Animals/tiger.md": `---
  "Animals/triceratops.md": `---
  "Animals/tyrannosaurus-rex.md": `---
  "Animals/venomous-snake.md": `---
  "Animals/vulture.md": `---
  "Animals/warhorse.md": `---
  "Animals/weasel.md": `---
  "Animals/wolf.md": `---
  "Monsters/aboleth.md": `---
  "Monsters/adult-black-dragon.md": `---
  "Monsters/adult-blue-dragon.md": `---
  "Monsters/adult-brass-dragon.md": `---
  "Monsters/adult-bronze-dragon.md": `---
  "Monsters/adult-copper-dragon.md": `---
  "Monsters/adult-gold-dragon.md": `---
  "Monsters/adult-green-dragon.md": `---
  "Monsters/adult-red-dragon.md": `---
  "Monsters/adult-silver-dragon.md": `---
  "Monsters/adult-white-dragon.md": `---
  "Monsters/AGENTS.md": `# Ziele
- Enthält Monster-Presets als Input für Parser und Library-Creator.
- Sicherstellt, dass verschiedene CR-Stufen und Traits abgedeckt sind.

# Aktueller Stand
- Markdown-Statblocks mit Frontmatter bilden die Basis.
- Daten stammen aus Regelwerken oder Homebrew.

# ToDo
- [P3] Legendary/Lair Actions in Preset-Schema integrieren.
- [P3] Quellenangaben pro Monster ergänzen.

# Standards
- Frontmatter-Schlüssel den Parser-Vorgaben anpassen.
- Änderungen mit Golden-Tests vergleichen (\`tests/golden/library/creatures\`).
`,
  "Monsters/air-elemental.md": `---
  "Monsters/ancient-black-dragon.md": `---
  "Monsters/ancient-blue-dragon.md": `---
  "Monsters/ancient-brass-dragon.md": `---
  "Monsters/ancient-bronze-dragon.md": `---
  "Monsters/ancient-copper-dragon.md": `---
  "Monsters/ancient-gold-dragon.md": `---
  "Monsters/ancient-green-dragon.md": `---
  "Monsters/ancient-red-dragon.md": `---
  "Monsters/ancient-silver-dragon.md": `---
  "Monsters/ancient-white-dragon.md": `---
  "Monsters/animated-armor.md": `---
  "Monsters/animated-flying-sword.md": `---
  "Monsters/animated-rug-of-smothering.md": `---
  "Monsters/ankheg.md": `---
  "Monsters/archmage.md": `---
  "Monsters/assassin.md": `---
  "Monsters/awakened-shrub.md": `---
  "Monsters/awakened-tree.md": `---
  "Monsters/axe-beak.md": `---
  "Monsters/azer-sentinel.md": `---
  "Monsters/balor.md": `---
  "Monsters/bandit-captain.md": `---
  "Monsters/bandit.md": `---
  "Monsters/barbed-devil.md": `---
  "Monsters/basilisk.md": `---
  "Monsters/bearded-devil.md": `---
  "Monsters/behir.md": `---
  "Monsters/berserker.md": `---
  "Monsters/black-dragon-wyrmling.md": `---
  "Monsters/black-pudding.md": `---
  "Monsters/blink-dog.md": `---
  "Monsters/blue-dragon-wyrmling.md": `---
  "Monsters/bone-devil.md": `---
  "Monsters/brass-dragon-wyrmling.md": `---
  "Monsters/bronze-dragon-wyrmling.md": `---
  "Monsters/bugbear-stalker.md": `---
  "Monsters/bugbear-warrior.md": `---
  "Monsters/bulette.md": `---
  "Monsters/centaur-trooper.md": `---
  "Monsters/chain-devil.md": `---
  "Monsters/chimera.md": `---
  "Monsters/chuul.md": `---
  "Monsters/clay-golem.md": `---
  "Monsters/cloaker.md": `---
  "Monsters/cloud-giant.md": `---
  "Monsters/cockatrice.md": `---
  "Monsters/commoner.md": `---
  "Monsters/copper-dragon-wyrmling.md": `---
  "Monsters/couatl.md": `---
  "Monsters/cultist-fanatic.md": `---
  "Monsters/cultist.md": `---
  "Monsters/darkmantle.md": `---
  "Monsters/death-dog.md": `---
  "Monsters/deva.md": `---
  "Monsters/djinni.md": `---
  "Monsters/doppelganger.md": `---
  "Monsters/dragon-turtle.md": `---
  "Monsters/dretch.md": `---
  "Monsters/drider.md": `---
  "Monsters/druid.md": `---
  "Monsters/dryad.md": `---
  "Monsters/dust-mephit.md": `---
  "Monsters/earth-elemental.md": `---
  "Monsters/efreeti.md": `---
  "Monsters/erinyes.md": `---
  "Monsters/ettercap.md": `---
  "Monsters/ettin.md": `---
  "Monsters/fire-elemental.md": `---
  "Monsters/fire-giant.md": `---
  "Monsters/flesh-golem.md": `---
  "Monsters/frost-giant.md": `---
  "Monsters/gargoyle.md": `---
  "Monsters/gelatinous-cube.md": `---
  "Monsters/ghast.md": `---
  "Monsters/ghost.md": `---
  "Monsters/ghoul.md": `---
  "Monsters/gibbering-mouther.md": `---
  "Monsters/glabrezu.md": `---
  "Monsters/gladiator.md": `---
  "Monsters/gnoll-warrior.md": `---
  "Monsters/goblin-boss.md": `---
  "Monsters/goblin-minion.md": `---
  "Monsters/goblin-warrior.md": `---
  "Monsters/gold-dragon-wyrmling.md": `---
  "Monsters/gorgon.md": `---
  "Monsters/gray-ooze.md": `---
  "Monsters/green-dragon-wyrmling.md": `---
  "Monsters/green-hag.md": `---
  "Monsters/grick.md": `---
  "Monsters/griffon.md": `---
  "Monsters/grimlock.md": `---
  "Monsters/guard-captain.md": `---
  "Monsters/guard.md": `---
  "Monsters/guardian-naga.md": `---
  "Monsters/half-dragon.md": `---
  "Monsters/harpy.md": `---
  "Monsters/hell-hound.md": `---
  "Monsters/hezrou.md": `---
  "Monsters/hill-giant.md": `---
  "Monsters/hippogriff.md": `---
  "Monsters/hobgoblin-captain.md": `---
  "Monsters/hobgoblin-warrior.md": `---
  "Monsters/homunculus.md": `---
  "Monsters/horned-devil.md": `---
  "Monsters/hydra.md": `---
  "Monsters/ice-devil.md": `---
  "Monsters/ice-mephit.md": `---
  "Monsters/imp.md": `---
  "Monsters/incubus.md": `---
  "Monsters/invisible-stalker.md": `---
  "Monsters/iron-golem.md": `---
  "Monsters/knight.md": `---
  "Monsters/kobold-warrior.md": `---
  "Monsters/kraken.md": `---
  "Monsters/lamia.md": `---
  "Monsters/lemure.md": `---
  "Monsters/lich.md": `---
  "Monsters/mage.md": `---
  "Monsters/magma-mephit.md": `---
  "Monsters/magmin.md": `---
  "Monsters/manticore.md": `---
  "Monsters/marilith.md": `---
  "Monsters/medusa.md": `---
  "Monsters/merfolk-skirmisher.md": `---
  "Monsters/merrow.md": `---
  "Monsters/mimic.md": `---
  "Monsters/minotaur-of-baphomet.md": `---
  "Monsters/minotaur-skeleton.md": `---
  "Monsters/mummy-lord.md": `---
  "Monsters/mummy.md": `---
  "Monsters/nalfeshnee.md": `---
  "Monsters/night-hag.md": `---
  "Monsters/nightmare.md": `---
  "Monsters/noble.md": `---
  "Monsters/ochre-jelly.md": `---
  "Monsters/ogre-zombie.md": `---
  "Monsters/ogre.md": `---
  "Monsters/oni.md": `---
  "Monsters/otyugh.md": `---
  "Monsters/owlbear.md": `---
  "Monsters/pegasus.md": `---
  "Monsters/phase-spider.md": `---
  "Monsters/pirate-captain.md": `---
  "Monsters/pirate.md": `---
  "Monsters/pit-fiend.md": `---
  "Monsters/planetar.md": `---
  "Monsters/priest-acolyte.md": `---
  "Monsters/priest.md": `---
  "Monsters/pseudodragon.md": `---
  "Monsters/purple-worm.md": `---
  "Monsters/quasit.md": `---
  "Monsters/rakshasa.md": `---
  "Monsters/red-dragon-wyrmling.md": `---
  "Monsters/remorhaz.md": `---
  "Monsters/roc.md": `---
  "Monsters/roper.md": `---
  "Monsters/rust-monster.md": `---
  "Monsters/sahuagin-warrior.md": `---
  "Monsters/salamander.md": `---
  "Monsters/satyr.md": `---
  "Monsters/scout.md": `---
  "Monsters/sea-hag.md": `---
  "Monsters/shadow.md": `---
  "Monsters/shambling-mound.md": `---
  "Monsters/shield-guardian.md": `---
  "Monsters/shrieker-fungus.md": `---
  "Monsters/silver-dragon-wyrmling.md": `---
  "Monsters/skeleton.md": `---
  "Monsters/solar.md": `---
  "Monsters/specter.md": `---
  "Monsters/sphinx-of-lore.md": `---
  "Monsters/sphinx-of-valor.md": `---
  "Monsters/sphinx-of-wonder.md": `---
  "Monsters/spirit-naga.md": `---
  "Monsters/sprite.md": `---
  "Monsters/spy.md": `---
  "Monsters/steam-mephit.md": `---
  "Monsters/stirge.md": `---
  "Monsters/stone-giant.md": `---
  "Monsters/stone-golem.md": `---
  "Monsters/storm-giant.md": `---
  "Monsters/succubus.md": `---
  "Monsters/swarm-of-crawling-claws.md": `---
  "Monsters/tarrasque.md": `---
  "Monsters/tough-boss.md": `---
  "Monsters/tough.md": `---
  "Monsters/treant.md": `---
  "Monsters/troll-limb.md": `---
  "Monsters/troll.md": `---
  "Monsters/unicorn.md": `---
  "Monsters/vampire-familiar.md": `---
  "Monsters/vampire-spawn.md": `---
  "Monsters/vampire.md": `---
  "Monsters/violet-fungus.md": `---
  "Monsters/vrock.md": `---
  "Monsters/warhorse-skeleton.md": `---
  "Monsters/warrior-infantry.md": `---
  "Monsters/warrior-veteran.md": `---
  "Monsters/water-elemental.md": `---
  "Monsters/werebear.md": `---
  "Monsters/wereboar.md": `---
  "Monsters/wererat.md": `---
  "Monsters/weretiger.md": `---
  "Monsters/werewolf.md": `---
  "Monsters/white-dragon-wyrmling.md": `---
  "Monsters/wight.md": `---
  "Monsters/will-o-wisp.md": `---
  "Monsters/winter-wolf.md": `---
  "Monsters/worg.md": `---
  "Monsters/wraith.md": `---
  "Monsters/wyvern.md": `---
  "Monsters/xorn.md": `---
  "Monsters/young-black-dragon.md": `---
  "Monsters/young-blue-dragon.md": `---
  "Monsters/young-brass-dragon.md": `---
  "Monsters/young-bronze-dragon.md": `---
  "Monsters/young-copper-dragon.md": `---
  "Monsters/young-gold-dragon.md": `---
  "Monsters/young-green-dragon.md": `---
  "Monsters/young-red-dragon.md": `---
  "Monsters/young-silver-dragon.md": `---
  "Monsters/young-white-dragon.md": `---
  "Monsters/zombie.md": `---
`,
  "AGENTS.md": `# Ziele
- Archiviert Zauber-Presets als Ausgangsmaterial für Library-Imports.
- Sicherstellt, dass Parser und Golden-Tests reale Daten verarbeiten.

# Aktueller Stand
- Enthält Markdown-Snippets für exemplarische Zauber.
- Wird manuell gepflegt, keine automatische Synchronisation.

# ToDo
- [P2] Einheitliche Kopfzeilen (Name, Schule, Quelle) etablieren.
- [P3] Kennzeichnen, welche Presets bereits getestet/exportiert wurden.

# Standards
- Format beibehalten, das Parser erwarten (siehe \`tools/parsers\`).
- Änderungen mit \`npm test\` (Library) validieren.
`,
  "Create Undead.md": `---
smType: spell
name: "Create Undead"
level: 6
school: "Necromancy"
casting_time: "1 minute"
range: "10 feet"
components: ["V", "S", "M"]
materials: "one 150+ GP black onyx stone for each corpse"
duration: "Instantaneous"
classes: ["Cleric", "Warlock", "Wizard"]
---

# Create Undead
Level 6 Necromancy

- Casting Time: 1 minute
- Range: 10 feet
- Components: V, S, M (one 150+ GP black onyx stone for each corpse)
- Duration: Instantaneous
- Classes: Cleric, Warlock, Wizard

You can cast this spell only at night. Choose up to three corpses of Medium or Small Humanoids within range. Each one becomes a **Ghoul** under your control (see "Monsters" for its stat block).

As a Bonus Action on each of your turns, you can mentally command any creature you animated with this spell if the creature is within 120 feet of you (if you control multiple creatures, you can command any of them at the same time, issuing the same command to them). You decide what action the creature will take and where it will move on its next turn, or you can issue a general command, such as to guard a particular place. If you issue no commands, the creature takes the Dodge action and moves only to avoid harm. Once given an order, the creature continues to follow the order until its task is complete.

The creature is under your control for 24 hours, after which it stops obeying any command you've given it. To maintain control of the creature for another 24 hours, you must cast this spell on the creature before the current 24-hour period ends. This use of the spell reasserts your control over up to three creatures you have animated with this spell rather than animating new ones.
`,
  "Find Traps.md": `---
smType: spell
name: "Find Traps"
level: 2
school: "Divination"
casting_time: "Action"
range: "120 feet"
components: ["V", "S"]
duration: "Instantaneous"
classes: ["Cleric", "Druid", "Ranger"]
---

# Find Traps
Level 2 Divination

- Casting Time: Action
- Range: 120 feet
- Components: V, S
- Duration: Instantaneous
- Classes: Cleric, Druid, Ranger

You sense any trap within range that is within line of sight. A trap, for the purpose of this spell, includes any object or mechanism that was created to cause damage or other danger. Thus, the spell would sense the *Alarm* or *Glyph of Warding* spell or a mechanical pit trap, but it wouldn't reveal a natural weakness in the floor, an unstable ceiling, or a hidden sinkhole.

This spell reveals that a trap is present but not its location. You do learn the general nature of the danger posed by a trap you sense.
`,
  "AGENTS.md": `# Ziele
- Hält Item-Presets (Consumables, Loot, Utility) für Tests und Exporte bereit.
- Dient als manuelles Repository für neue Inhalte aus Regelquellen.

# Aktueller Stand
- Markdown-Dateien enthalten strukturierte Frontmatter.
- Parser ziehen diese Daten in den Library-Import.

# ToDo
- [P2] Mehr Beispiele für unterschiedliche Rarity-Level ergänzen.
- [P3] Automatisierte Konsistenzprüfung (z. B. fehlende Felder) hinzufügen.

# Standards
- Frontmatter-Schlüssel folgen Parser-Spezifikation.
- Änderungen mit Golden-Tests abgleichen (\`tests/golden/library/items\`).
  "Horseshoes of a Zephyr.md": `---
name: "Horseshoes of a Zephyr"
rarity: "Very Rare"
# Horseshoes of a Zephyr
*Wondrous Very Rare*
While all four shoes are affixed to the hooves of a horse or similar creature, they allow the creature to move normally while floating 4 inches above a surface. This effect means the creature can cross or stand above nonsolid or unstable surfaces, such as water or lava. The creature leaves no tracks and ignores Difficult Terrain. In addition, the creature can travel for up to 12 hours a day without gaining Exhaustion levels from extended travel.
  "Horseshoes of Speed.md": `---
name: "Horseshoes of Speed"
rarity: "Rare"
# Horseshoes of Speed
*Wondrous Rare*
While all four horseshoes are attached to the same creature, its Speed is increased by 30 feet.
`,
  "Ring of the Ram.md": `---
smType: item
name: "Ring of the Ram"
category: "Ring"
type: "Requires Attunement"
rarity: "Rare"
attunement: true
max_charges: 3
recharge_formula: "1d3"
recharge_time: "Dawn"
---

# Ring of the Ram
*Ring (Requires Attunement) Rare (Requires Attunement)*

## Charges

This item has 3 charges.
regains 1d3 charges at Dawn.

This ring has 3 charges and regains 1d3 expended charges daily at dawn. While wearing the ring, you can take a Magic action to expend 1 to 3 charges to make a ranged spell attack against one creature you can see within 60 feet of yourself. The ring produces a spectral ram's head and makes its attack roll with a +7 bonus. On a hit, for each charge you spend, the target takes 2d10 Force damage and is pushed 5 feet away from you.

Alternatively, you can expend 1 to 3 of the ring's charges as a Magic action to try to break a nonmagical object you can see within 60 feet of yourself that isn't being worn or carried. The ring makes a Strength check with a +5 bonus for each charge you spend.
`,
  "Robe of the Archmagi.md": `---
smType: item
name: "Robe of the Archmagi"
category: "Wondrous"
type: "Requires Attunement by a Sorcerer, Warlock, or Wizard"
rarity: "Legendary"
attunement: true
attunement_req: "by a Sorcerer, Warlock, or Wizard"
---

# Robe of the Archmagi
*Wondrous (Requires Attunement by a Sorcerer, Warlock, or Wizard) Legendary (Requires Attunement by a Sorcerer, Warlock, or Wizard)*

This elegant garment is made from exquisite cloth and adorned with runes.

You gain these benefits while wearing the robe. *Armor.* If you aren't wearing armor, your base

Armor Class is 15 plus your Dexterity modifier. *Magic Resistance.* You have Advantage on saving throws against spells and other magical effects. *War Mage.* Your spell save DC and spell attack bonus each increase by 2.
`,
  "Staff of Thunder and Lightning.md": `---
smType: item
name: "Staff of Thunder and Lightning"
category: "Staff"
type: "Requires Attunement"
rarity: "Very Rare"
attunement: true
---

# Staff of Thunder and Lightning
*Staff (Requires Attunement) Very Rare (Requires Attunement)*

This staff can be wielded as a magic Quarterstaff that grants a +2 bonus to attack rolls and damage rolls made with it. It also has the following additional properties. Once one of these properties is used, it can't be used again until the next dawn.
`,
  "Staff of Withering.md": `---
smType: item
name: "Staff of Withering"
category: "Staff"
type: "Requires Attunement"
rarity: "Rare"
attunement: true
max_charges: 3
recharge_formula: "1d3"
recharge_time: "Dawn"
---

# Staff of Withering
*Staff (Requires Attunement) Rare (Requires Attunement)*

## Charges

This item has 3 charges.
regains 1d3 charges at Dawn.

This staff has 3 charges and regains 1d3 expended charges daily at dawn.

The staff can be wielded as a magic Quarterstaff. On a hit, it deals damage as a normal Quarterstaff, and you can expend 1 charge to deal an extra 2d10 Necrotic damage to the target and force it to make a DC 15 Constitution saving throw. On a failed save, the target has Disadvantage for 1 hour on any ability check or saving throw that uses Strength or Constitution.
  "Talisman of the Sphere.md": `---
name: "Talisman of the Sphere"
# Talisman of the Sphere
While holding or wearing this talisman, you have Advantage on any Intelligence (Arcana) check you make to control a *Sphere of Annihilation*. In addition, when you start your turn in control of a *Sphere of Annihilation*, you can take a Magic action to move it 10 feet plus a number of additional feet equal to 10 times your Intelligence modifier. This movement doesn't have to be in a straight line.
  "Talisman of Ultimate Evil.md": `---
name: "Talisman of Ultimate Evil"
max_charges: 6
# Talisman of Ultimate Evil
## Charges

This item has 6 charges.

This item symbolizes unrepentant evil. A creature that isn't a Fiend or an Undead that touches the talisman takes 8d6 Necrotic damage and takes the damage again each time it ends its turn holding or carrying the talisman.
`,
  "Wand of the War Mage, +1, +2, or +3.md": `---
smType: item
name: "Wand of the War Mage, +1, +2, or +3"
category: "Wand"
type: "+1"
rarity: "Uncommon"
attunement: true
attunement_req: "by a Spellcaster"
---

# Wand of the War Mage, +1, +2, or +3
*Wand (+1) Uncommon (Requires Attunement by a Spellcaster)*

While holding this wand, you gain a bonus to spell attack rolls determined by the wand's rarity. In addition, you ignore Half Cover when making a spell attack roll.
  "AGENTS.md": `# Ziele
- Verwaltet Ausrüstungs-Presets (Waffen, Rüstung, Tools, Gear) für Library-Importe.
- Stellt realistische Datengrundlagen für Parser und UI-Tests bereit.

# Aktueller Stand
- Unterordner strukturieren nach Unterkategorien.
- Markdown-Dateien mit Frontmatter bilden den Primärinput für Skripte.

# ToDo
- [P2] Einheitliche Property-Namen für Damage und Traits durchsetzen.
- [P3] Kennzeichnung für Homebrew vs. Regelwerk hinzufügen.

# Standards
- Format wie in \`tools/parsers\` Dokumentation beschrieben einhalten.
- Nach Updates Golden-Tests (\`tests/golden/library/equipment\`) prüfen.
`,
  "Armor/.md": `---
  "Armor/AGENTS.md": `# Ziele
- Enthält Rüstungs-Presets inklusive AC, Anforderungen und Effekten.
- Dient als Datengrundlage für Library-Import und Golden-Tests.

# Aktueller Stand
- Markdown mit Frontmatter bildet den aktuellen Bestand.
- Noch keine automatisierten Validierungen.

# ToDo
- [P3] Varianten (magische Rüstungen) ergänzen.
- [P3] Strukturiertes Mapping zu Traits (Stealth Disadvantage etc.) prüfen.

# Standards
- Frontmatter-Schlüssel klar halten (\`ac\`, \`requires\`, \`weight\`, ...).
- Nach Änderungen Parser-Tests laufen lassen.
`,
  "Gear/Acid.md": `---
  "Gear/AGENTS.md": `# Ziele
- Beinhaltet allgemeine Ausrüstung (Abenteurerausrüstung, Verbrauchsgüter) als Presets.
- Dient als Referenz für Parser und UI-Listen.

# Aktueller Stand
- Markdown-Dateien mit Frontmatter beschreiben Kosten, Gewicht und Effekte.
- Manuelle Pflege, keine Automatisierung.

# ToDo
- [P3] Kategorien (Utility, Camping, Consumable) sauber kennzeichnen.
- [P3] Verweise zu passenden Regelbuchabschnitten hinzufügen.

# Standards
- Frontmatter-Felder konsistent halten.
- Änderungen nach \`npm test\` verifizieren.
`,
  "Gear/Alchemist's Fire.md": `---
  "Gear/Ammunition.md": `---
  "Gear/Antitoxin.md": `---
  "Gear/Arcane Focus.md": `---
  "Gear/Backpack.md": `---
  "Gear/Ball Bearings.md": `---
  "Gear/Barrel.md": `---
  "Gear/Basket.md": `---
  "Gear/Bedroll.md": `---
  "Gear/Bell.md": `---
  "Gear/Blanket.md": `---
  "Gear/Block and Tackle.md": `---
  "Gear/Book.md": `---
  "Gear/Bottle, Glass.md": `---
  "Gear/Bucket.md": `---
  "Gear/Burglar's Pack.md": `---
  "Gear/Caltrops.md": `---
  "Gear/Candle.md": `---
  "Gear/Case, Crossbow Bolt.md": `---
  "Gear/Case, Map or Scroll.md": `---
  "Gear/Chain.md": `---
  "Gear/Chest.md": `---
  "Gear/Climber's Kit.md": `---
  "Gear/Clothes, Fine.md": `---
  "Gear/Clothes, Traveler's.md": `---
  "Gear/Component Pouch.md": `---
  "Gear/Costume.md": `---
  "Gear/Crowbar.md": `---
  "Gear/Diplomat's Pack.md": `---
  "Gear/Druidic Focus.md": `---
  "Gear/Dungeoneer's Pack.md": `---
  "Gear/Entertainer's Pack.md": `---
  "Gear/Explorer's Pack.md": `---
  "Gear/Flask.md": `---
  "Gear/Grappling Hook.md": `---
  "Gear/Healer's Kit.md": `---
  "Gear/Holy Symbol.md": `---
  "Gear/Holy Water.md": `---
  "Gear/Hunting Trap.md": `---
  "Gear/Ink Pen.md": `---
  "Gear/Ink.md": `---
  "Gear/Jug.md": `---
  "Gear/Ladder.md": `---
  "Gear/Lamp.md": `---
  "Gear/Lantern, Bullseye.md": `---
  "Gear/Lantern, Hooded.md": `---
  "Gear/Lock.md": `---
  "Gear/Magnifying Glass.md": `---
  "Gear/Manacles.md": `---
  "Gear/Map.md": `---
  "Gear/Mirror.md": `---
  "Gear/Net.md": `---
  "Gear/Oil.md": `---
  "Gear/Paper.md": `---
  "Gear/Parchment.md": `---
  "Gear/Perfume.md": `---
  "Gear/Poison, Basic.md": `---
  "Gear/Pole.md": `---
  "Gear/Pot, Iron.md": `---
  "Gear/Potion of Healing.md": `---
  "Gear/Pouch.md": `---
  "Gear/Priest's Pack.md": `---
  "Gear/Quiver.md": `---
  "Gear/Ram, Portable.md": `---
  "Gear/Rations.md": `---
  "Gear/Robe.md": `---
  "Gear/Rope.md": `---
  "Gear/Sack.md": `---
  "Gear/Scholar's Pack.md": `---
  "Gear/Shovel.md": `---
  "Gear/Signal Whistle.md": `---
  "Gear/Spell Scroll (Cantrip).md": `---
  "Gear/Spell Scroll (Level 1).md": `---
  "Gear/Spikes, Iron.md": `---
  "Gear/Spyglass.md": `---
  "Gear/String.md": `---
  "Gear/Tent.md": `---
  "Gear/Tinderbox.md": `---
  "Gear/Torch.md": `---
  "Gear/Vial.md": `---
  "Gear/Waterskin.md": `---
  "Tools/AGENTS.md": `# Ziele
- Archiviert Werkzeug- und Kit-Presets mit Boni und Einsatzgebieten.
- Unterstützt Parser und Quick-Reference-Funktionalitäten.

# Aktueller Stand
- Enthält ausgewählte Tools mit strukturiertem Frontmatter.
- Daten werden manuell gepflegt.

# ToDo
- [P3] Weitere Werkzeuge aus Kampagnensettings sammeln.
- [P3] Felder für verwendete Fertigkeiten (skill) vereinheitlichen.

# Standards
- Frontmatter unverändert belassen; Parser verlässt sich auf Keys.
- Änderungen per Tests (\`library/tools\`) überprüfen.
`,
  "Tools/Alchemist's Supplies.md": `---
  "Tools/Brewer's Supplies.md": `---
  "Tools/Calligrapher's Supplies.md": `---
  "Tools/Carpenter's Tools.md": `---
  "Tools/Cartographer's Tools.md": `---
  "Tools/Cobbler's Tools.md": `---
  "Tools/Cook's Utensils.md": `---
  "Tools/Disguise Kit.md": `---
  "Tools/Forgery Kit.md": `---
  "Tools/Gaming Set.md": `---
  "Tools/Glassblower's Tools.md": `---
  "Tools/Herbalism Kit.md": `---
  "Tools/Jeweler's Tools.md": `---
  "Tools/Leatherworker's Tools.md": `---
  "Tools/Mason's Tools.md": `---
  "Tools/Musical Instrument.md": `---
  "Tools/Navigator's Tools.md": `---
  "Tools/Painter's Supplies.md": `---
  "Tools/Poisoner's Kit.md": `---
  "Tools/Potter's Tools.md": `---
  "Tools/Smith's Tools.md": `---
  "Tools/Thieves' Tools.md": `---
  "Tools/Tinker's Tools.md": `---
  "Tools/Weaver's Tools.md": `---
  "Tools/Woodcarver's Tools.md": `---
  "Weapons/AGENTS.md": `# Ziele
- Beinhaltet Waffen-Presets als Referenz für Parser und Creator.
- Sichert unterschiedliche Kategorien (Nahkampf, Fernkampf, exotisch) ab.

# Aktueller Stand
- Markdown-Dateien mit Frontmatter beschreiben Stats und Eigenschaften.
- Wird manuell aktualisiert.

# ToDo
- [P3] Weitere Waffen aus Alternativquellen aufnehmen.
- [P3] Damage-Typen mit Library-Konstanten abgleichen.

# Standards
- Frontmatter-Schlüssel (damage, properties, cost) strikt nach Parser-Konvention.
- Änderungen stets mit Golden-Dateien (\`tests/golden/library/equipment\`) synchronisieren.
`,
  "Weapons/Battleaxe.md": `---
  "Weapons/Blowgun.md": `---
  "Weapons/Club.md": `---
  "Weapons/Dagger.md": `---
  "Weapons/Dart.md": `---
  "Weapons/Flail.md": `---
  "Weapons/Glaive.md": `---
  "Weapons/Greataxe.md": `---
  "Weapons/Greatclub.md": `---
  "Weapons/Greatsword.md": `---
  "Weapons/Halberd.md": `---
  "Weapons/Hand Crossbow.md": `---
  "Weapons/Handaxe.md": `---
  "Weapons/Heavy Crossbow.md": `---
  "Weapons/Javelin.md": `---
  "Weapons/Lance.md": `---
  "Weapons/Light Crossbow.md": `---
  "Weapons/Light Hammer.md": `---
  "Weapons/Longbow.md": `---
  "Weapons/Longsword.md": `---
  "Weapons/Mace.md": `---
  "Weapons/Maul.md": `---
  "Weapons/Morningstar.md": `---
  "Weapons/Musket.md": `---
  "Weapons/Pike.md": `---
  "Weapons/Pistol.md": `---
  "Weapons/Quarterstaff.md": `---
  "Weapons/Rapier.md": `---
  "Weapons/Scimitar.md": `---
  "Weapons/Shortbow.md": `---
  "Weapons/Shortsword.md": `---
  "Weapons/Sickle.md": `---
  "Weapons/Sling.md": `---
  "Weapons/Spear.md": `---
  "Weapons/Trident.md": `---
  "Weapons/War Pick.md": `---
  "Weapons/Warhammer.md": `---
  "Weapons/Whip.md": `---
