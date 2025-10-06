---
smType: creature
name: "Shambling Mound"
size: "Large"
type: "Plant"
alignment: "Unaligned"
ac: "15"
initiative: "-1"
hp: "110"
hit_dice: "13d10 + 39"
speed_walk: "30 ft."
speed_swim: "20 ft."
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"},\"swim\":{\"distance\":\"20 ft.\"}}"
str: "18"
dex: "8"
con: "16"
int: "5"
wis: "10"
cha: "5"
pb: "+3"
skills_prof: ["Stealth"]
senses: ["blindsight 60 ft."]
passives: ["Passive Perception 10"]
damage_resistances: ["Cold", "Fire"]
damage_immunities: ["Lightning", "Deafened", "Exhaustion"]
cr: "5"
xp: "1800"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Lightning Absorption\",\"text\":\"Whenever the shambling mound is subjected to Lightning damage, it regains a number of Hit Points equal to the Lightning damage dealt.\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The shambling mound makes three Charged Tendril attacks. It can replace one attack with a use of Engulf.\"},{\"category\":\"action\",\"name\":\"Charged Tendril\",\"text\":\"*Melee Attack Roll:* +7, reach 10 ft. 7 (1d6 + 4) Bludgeoning damage plus 5 (2d4) Lightning damage. If the target is a Medium or smaller creature, the shambling mound pulls the target 5 feet straight toward itself.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+7\",\"range\":\"10 ft\",\"damage\":\"7 (1d6 + 4) Bludgeoning\"},{\"category\":\"action\",\"name\":\"Engulf\",\"text\":\"*Strength Saving Throw*: DC 15, one Medium or smaller creature within 5 feet. *Failure:*  The target is pulled into the shambling mound's space and has the Grappled condition (escape DC 14). Until the grapple ends, the target has the Blinded and Restrained conditions, and it takes 10 (3d6) Lightning damage at the start of each of its turns. When the shambling mound moves, the Grappled target moves with it, costing it no extra movement. The shambling mound can have only one creature Grappled by this action at a time.\",\"target\":\"one creature\",\"damage\":\"10 (3d6) Lightning\",\"save_ability\":\"STR\",\"save_dc\":15}]"
---

# Shambling Mound
*Large, Plant, Unaligned*

**AC** 15
**HP** 110 (13d10 + 39)
**Speed** 30 ft., swim 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 18 | 8 | 16 | 5 | 10 | 5 |

CR 5, XP 1800

## Traits

**Lightning Absorption**
Whenever the shambling mound is subjected to Lightning damage, it regains a number of Hit Points equal to the Lightning damage dealt.

## Actions

**Multiattack**
The shambling mound makes three Charged Tendril attacks. It can replace one attack with a use of Engulf.

**Charged Tendril**
*Melee Attack Roll:* +7, reach 10 ft. 7 (1d6 + 4) Bludgeoning damage plus 5 (2d4) Lightning damage. If the target is a Medium or smaller creature, the shambling mound pulls the target 5 feet straight toward itself.

**Engulf**
*Strength Saving Throw*: DC 15, one Medium or smaller creature within 5 feet. *Failure:*  The target is pulled into the shambling mound's space and has the Grappled condition (escape DC 14). Until the grapple ends, the target has the Blinded and Restrained conditions, and it takes 10 (3d6) Lightning damage at the start of each of its turns. When the shambling mound moves, the Grappled target moves with it, costing it no extra movement. The shambling mound can have only one creature Grappled by this action at a time.
