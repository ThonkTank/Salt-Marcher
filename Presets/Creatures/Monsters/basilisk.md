---
smType: creature
name: "Basilisk"
size: "Medium"
type: "Monstrosity"
alignment: "Unaligned"
ac: "15"
initiative: "-1"
hp: "52"
hit_dice: "8d8 + 16"
speed_walk: "20 ft."
speeds_json: "{\"walk\":{\"distance\":\"20 ft.\"}}"
str: "16"
dex: "8"
con: "15"
int: "2"
wis: "8"
cha: "7"
pb: "+2"
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 9"]
cr: "3"
xp: "700"
entries_structured_json: "[{\"category\":\"action\",\"name\":\"Bite\",\"text\":\"*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage plus 7 (2d6) Poison damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+5\",\"range\":\"5 ft\",\"damage\":\"10 (2d6 + 3) Piercing\"},{\"category\":\"bonus\",\"name\":\"Petrifying Gaze\",\"recharge\":\"Recharge 4-6\",\"text\":\"*Constitution Saving Throw*: DC 12, each creature in a 30-foot Cone. If the basilisk sees its reflection within the Cone, the basilisk must make this save. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.\",\"target\":\"each creature in a 30-foot Cone\",\"save_ability\":\"CON\",\"save_dc\":12}]"
---

# Basilisk
*Medium, Monstrosity, Unaligned*

**AC** 15
**HP** 52 (8d8 + 16)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 16 | 8 | 15 | 2 | 8 | 7 |

CR 3, XP 700

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage plus 7 (2d6) Poison damage.

## Bonus Actions

**Petrifying Gaze (Recharge 4-6)**
*Constitution Saving Throw*: DC 12, each creature in a 30-foot Cone. If the basilisk sees its reflection within the Cone, the basilisk must make this save. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.
