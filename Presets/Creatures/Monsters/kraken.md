---
smType: creature
name: "Kraken"
size: "Gargantuan"
type: "Monstrosity"
type_tags: ["Titan"]
alignment: "Chaotic Evil"
ac: "18"
initiative: "+4"
hp: "481"
hit_dice: "26d20 + 208"
speed_walk: "30 ft."
speed_swim: "120 ft."
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"},\"swim\":{\"distance\":\"120 ft.\"}}"
str: "30"
dex: "11"
con: "26"
int: "22"
wis: "18"
cha: "20"
pb: "+7"
saves_prof: ["STR", "DEX", "CON", "WIS"]
skills_prof: ["History", "Perception"]
senses: ["truesight 120 ft."]
passives: ["Passive Perception 21"]
languages: ["Understands Abyssal", "Celestial", "Infernal", "And Primordial but can't speak", "telepathy 120 ft."]
damage_immunities: ["Cold", "Lightning", "Frightened", "Grappled", "Paralyzed", "Restrained"]
cr: "23"
xp: "50000"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Amphibious\",\"text\":\"The kraken can breathe air and water.\"},{\"category\":\"trait\",\"name\":\"Legendary Resistance (4/Day, or 5/Day in Lair)\",\"text\":\"If the kraken fails a saving throw, it can choose to succeed instead.\"},{\"category\":\"trait\",\"name\":\"Siege Monster\",\"text\":\"The kraken deals double damage to objects and structures.\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The kraken makes two Tentacle attacks and uses Fling, Lightning Strike, or Swallow.\"},{\"category\":\"action\",\"name\":\"Tentacle\",\"text\":\"*Melee Attack Roll:* +17, reach 30 ft. 24 (4d6 + 10) Bludgeoning damage. The target has the Grappled condition (escape DC 20) from one of ten tentacles, and it has the Restrained condition until the grapple ends.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+17\",\"range\":\"30 ft\",\"damage\":\"24 (4d6 + 10) Bludgeoning\"},{\"category\":\"action\",\"name\":\"Fling\",\"text\":\"The kraken throws a Large or smaller creature Grappled by it to a space it can see within 60 feet of itself that isn't in the air. *Dexterity Saving Throw*: DC 25, the creature thrown and each creature in the destination space. *Failure:*  18 (4d8) Bludgeoning damage, and the target has the Prone condition. *Success:*  Half damage only.\",\"target\":\"each creature in the destination space\",\"damage\":\"18 (4d8) Bludgeoning\",\"save_ability\":\"DEX\",\"save_dc\":25,\"save_effect\":\"Half damage only\"},{\"category\":\"action\",\"name\":\"Lightning Strike\",\"text\":\"*Dexterity Saving Throw*: DC 23, one creature the kraken can see within 120 feet. *Failure:*  33 (6d10) Lightning damage. *Success:*  Half damage.\",\"target\":\"one creature\",\"damage\":\"33 (6d10) Lightning\",\"save_ability\":\"DEX\",\"save_dc\":23,\"save_effect\":\"Half damage\"},{\"category\":\"action\",\"name\":\"Swallow\",\"text\":\"*Dexterity Saving Throw*: DC 25, one creature Grappled by the kraken (it can have up to four creatures swallowed at a time). *Failure:*  23 (3d8 + 10) Piercing damage. If the target is Large or smaller, it is swallowed and no longer Grappled. A swallowed creature has the Restrained condition, has Cover|XPHB|Total Cover against attacks and other effects outside the kraken, and takes 24 (7d6) Acid damage at the start of each of its turns. If the kraken takes 50 damage or more on a single turn from a creature inside it, the kraken must succeed on a DC 25 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 10 feet of the kraken with the Prone condition. If the kraken dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 15 feet of movement, exiting Prone.\",\"target\":\"one creature\",\"damage\":\"23 (3d8 + 10) Piercing\",\"save_ability\":\"DEX\",\"save_dc\":25},{\"category\":\"legendary\",\"name\":\"Storm Bolt\",\"text\":\"The kraken uses Lightning Strike.\"},{\"category\":\"legendary\",\"name\":\"Toxic Ink\",\"text\":\"*Constitution Saving Throw*: DC 23, each creature in a 15-foot Emanation originating from the kraken while it is underwater. *Failure:*  The target has the Blinded and Poisoned conditions until the end of the kraken's next turn. The kraken then moves up to its Speed. *Failure or Success*:  The kraken can't take this action again until the start of its next turn.\",\"target\":\"each creature in a 15-foot Emanation originating from the kraken while it is underwater\",\"save_ability\":\"CON\",\"save_dc\":23}]"
---

# Kraken
*Gargantuan, Monstrosity, Chaotic Evil*

**AC** 18
**HP** 481 (26d20 + 208)
**Speed** 30 ft., swim 120 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 30 | 11 | 26 | 22 | 18 | 20 |

CR 23, XP 50000

## Traits

**Amphibious**
The kraken can breathe air and water.

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the kraken fails a saving throw, it can choose to succeed instead.

**Siege Monster**
The kraken deals double damage to objects and structures.

## Actions

**Multiattack**
The kraken makes two Tentacle attacks and uses Fling, Lightning Strike, or Swallow.

**Tentacle**
*Melee Attack Roll:* +17, reach 30 ft. 24 (4d6 + 10) Bludgeoning damage. The target has the Grappled condition (escape DC 20) from one of ten tentacles, and it has the Restrained condition until the grapple ends.

**Fling**
The kraken throws a Large or smaller creature Grappled by it to a space it can see within 60 feet of itself that isn't in the air. *Dexterity Saving Throw*: DC 25, the creature thrown and each creature in the destination space. *Failure:*  18 (4d8) Bludgeoning damage, and the target has the Prone condition. *Success:*  Half damage only.

**Lightning Strike**
*Dexterity Saving Throw*: DC 23, one creature the kraken can see within 120 feet. *Failure:*  33 (6d10) Lightning damage. *Success:*  Half damage.

**Swallow**
*Dexterity Saving Throw*: DC 25, one creature Grappled by the kraken (it can have up to four creatures swallowed at a time). *Failure:*  23 (3d8 + 10) Piercing damage. If the target is Large or smaller, it is swallowed and no longer Grappled. A swallowed creature has the Restrained condition, has Cover|XPHB|Total Cover against attacks and other effects outside the kraken, and takes 24 (7d6) Acid damage at the start of each of its turns. If the kraken takes 50 damage or more on a single turn from a creature inside it, the kraken must succeed on a DC 25 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 10 feet of the kraken with the Prone condition. If the kraken dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 15 feet of movement, exiting Prone.

## Legendary Actions

**Storm Bolt**
The kraken uses Lightning Strike.

**Toxic Ink**
*Constitution Saving Throw*: DC 23, each creature in a 15-foot Emanation originating from the kraken while it is underwater. *Failure:*  The target has the Blinded and Poisoned conditions until the end of the kraken's next turn. The kraken then moves up to its Speed. *Failure or Success*:  The kraken can't take this action again until the start of its next turn.
