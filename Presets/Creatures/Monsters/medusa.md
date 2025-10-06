---
smType: creature
name: "Medusa"
size: "Medium"
type: "Monstrosity"
alignment: "Lawful Evil"
ac: "15"
initiative: "+6"
hp: "127"
hit_dice: "17d8 + 51"
speed_walk: "30 ft."
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"}}"
str: "10"
dex: "17"
con: "16"
int: "12"
wis: "13"
cha: "15"
pb: "+3"
saves_prof: ["WIS"]
skills_prof: ["Deception", "Perception", "Stealth"]
senses: ["darkvision 150 ft."]
passives: ["Passive Perception 14"]
languages: ["Common plus one other language"]
cr: "6"
xp: "2300"
entries_structured_json: "[{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The medusa makes two Claw attacks and one Snake Hair attack, or it makes three Poison Ray attacks.\"},{\"category\":\"action\",\"name\":\"Claw\",\"text\":\"*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Slashing damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+6\",\"range\":\"5 ft\",\"damage\":\"10 (2d6 + 3) Slashing\"},{\"category\":\"action\",\"name\":\"Snake Hair\",\"text\":\"*Melee Attack Roll:* +6, reach 5 ft. 5 (1d4 + 3) Piercing damage plus 14 (4d6) Poison damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+6\",\"range\":\"5 ft\",\"damage\":\"5 (1d4 + 3) Piercing\"},{\"category\":\"action\",\"name\":\"Poison Ray\",\"text\":\"*Ranged Attack Roll:* +5, range 150 ft. 11 (2d8 + 2) Poison damage.\",\"kind\":\"Ranged Attack Roll\",\"to_hit\":\"+5\",\"range\":\"150 ft\",\"damage\":\"11 (2d8 + 2) Poison\"},{\"category\":\"bonus\",\"name\":\"Petrifying Gaze\",\"recharge\":\"Recharge 5-6\",\"text\":\"*Constitution Saving Throw*: DC 13, each creature in a 30-foot Cone. If the medusa sees its reflection in the Cone, the medusa must make this save. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.\",\"target\":\"each creature in a 30-foot Cone\",\"save_ability\":\"CON\",\"save_dc\":13}]"
---

# Medusa
*Medium, Monstrosity, Lawful Evil*

**AC** 15
**HP** 127 (17d8 + 51)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 10 | 17 | 16 | 12 | 13 | 15 |

CR 6, XP 2300

## Actions

**Multiattack**
The medusa makes two Claw attacks and one Snake Hair attack, or it makes three Poison Ray attacks.

**Claw**
*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Slashing damage.

**Snake Hair**
*Melee Attack Roll:* +6, reach 5 ft. 5 (1d4 + 3) Piercing damage plus 14 (4d6) Poison damage.

**Poison Ray**
*Ranged Attack Roll:* +5, range 150 ft. 11 (2d8 + 2) Poison damage.

## Bonus Actions

**Petrifying Gaze (Recharge 5-6)**
*Constitution Saving Throw*: DC 13, each creature in a 30-foot Cone. If the medusa sees its reflection in the Cone, the medusa must make this save. *First Failure* The target has the Restrained condition and repeats the save at the end of its next turn if it is still Restrained, ending the effect on itself on a success. *Second Failure* The target has the Petrified condition instead of the Restrained condition.
