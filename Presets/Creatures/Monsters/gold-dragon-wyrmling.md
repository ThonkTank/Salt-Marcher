---
smType: creature
name: "Gold Dragon Wyrmling"
size: "Medium"
type: "Dragon"
type_tags: ["Metallic"]
alignment: "Lawful Good"
ac: "17"
initiative: "+4"
hp: "60"
hit_dice: "8d8 + 24"
speed_walk: "30 ft."
speed_swim: "30 ft."
speed_fly: "60 ft."
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"},\"fly\":{\"distance\":\"60 ft.\"},\"swim\":{\"distance\":\"30 ft.\"}}"
str: "19"
dex: "14"
con: "17"
int: "14"
wis: "11"
cha: "16"
pb: "+2"
saves_prof: ["DEX", "WIS"]
skills_prof: ["Perception", "Stealth"]
senses: ["blindsight 10 ft.", "darkvision 60 ft."]
passives: ["Passive Perception 14"]
languages: ["Draconic"]
damage_immunities: ["Fire"]
cr: "3"
xp: "700"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Amphibious\",\"text\":\"The dragon can breathe air and water.\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The dragon makes two Rend attacks.\"},{\"category\":\"action\",\"name\":\"Rend\",\"text\":\"*Melee Attack Roll:* +6, reach 5 ft. 9 (1d10 + 4) Slashing damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+6\",\"range\":\"5 ft\",\"damage\":\"9 (1d10 + 4) Slashing\"},{\"category\":\"action\",\"name\":\"Fire Breath\",\"recharge\":\"Recharge 5-6\",\"text\":\"*Dexterity Saving Throw*: DC 13, each creature in a 15-foot Cone. *Failure:*  22 (4d10) Fire damage. *Success:*  Half damage.\",\"target\":\"each creature in a 15-foot Cone\",\"damage\":\"22 (4d10) Fire\",\"save_ability\":\"DEX\",\"save_dc\":13,\"save_effect\":\"Half damage\"},{\"category\":\"action\",\"name\":\"Weakening Breath\",\"text\":\"*Strength Saving Throw*: DC 13, each creature that isn't currently affected by this breath in a 15-foot Cone. *Failure:*  The target has Disadvantage on Strength-based D20 Test and subtracts 2 (1d4) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.\",\"save_ability\":\"STR\",\"save_dc\":13}]"
---

# Gold Dragon Wyrmling
*Medium, Dragon, Lawful Good*

**AC** 17
**HP** 60 (8d8 + 24)
**Speed** 30 ft., swim 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 19 | 14 | 17 | 14 | 11 | 16 |

CR 3, XP 700

## Traits

**Amphibious**
The dragon can breathe air and water.

## Actions

**Multiattack**
The dragon makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +6, reach 5 ft. 9 (1d10 + 4) Slashing damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 13, each creature in a 15-foot Cone. *Failure:*  22 (4d10) Fire damage. *Success:*  Half damage.

**Weakening Breath**
*Strength Saving Throw*: DC 13, each creature that isn't currently affected by this breath in a 15-foot Cone. *Failure:*  The target has Disadvantage on Strength-based D20 Test and subtracts 2 (1d4) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.
