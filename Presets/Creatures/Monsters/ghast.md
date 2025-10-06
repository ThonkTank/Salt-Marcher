---
smType: creature
name: "Ghast"
size: "Medium"
type: "Undead"
alignment: "Chaotic Evil"
ac: "13"
initiative: "+3"
hp: "36"
hit_dice: "8d8"
speed_walk: "30 ft."
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"}}"
str: "16"
dex: "17"
con: "10"
int: "11"
wis: "10"
cha: "8"
pb: "+2"
saves_prof: ["WIS"]
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 10"]
languages: ["Common"]
damage_resistances: ["Necrotic"]
damage_immunities: ["Poison", "Charmed", "Exhaustion", "Poisoned"]
cr: "2"
xp: "450"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Stench\",\"text\":\"*Constitution Saving Throw*: DC 10, any creature that starts its turn in a 5-foot Emanation originating from the ghast. *Failure:*  The target has the Poisoned condition until the start of its next turn. *Success:*  The target is immune to this ghast's Stench for 24 hours.\",\"save_ability\":\"CON\",\"save_dc\":10,\"save_effect\":\"The target is immune to this ghast's Stench for 24 hours\"},{\"category\":\"action\",\"name\":\"Bite\",\"text\":\"*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage plus 9 (2d8) Necrotic damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+5\",\"range\":\"5 ft\",\"damage\":\"7 (1d8 + 3) Piercing\"},{\"category\":\"action\",\"name\":\"Claw\",\"text\":\"*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage. If the target is a non-Undead creature, it is subjected to the following effect. *Constitution Saving Throw*: DC 10. *Failure:*  The target has the Paralyzed condition until the end of its next turn.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+5\",\"range\":\"5 ft\",\"damage\":\"10 (2d6 + 3) Slashing\",\"save_ability\":\"CON\",\"save_dc\":10}]"
---

# Ghast
*Medium, Undead, Chaotic Evil*

**AC** 13
**HP** 36 (8d8)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 16 | 17 | 10 | 11 | 10 | 8 |

CR 2, XP 450

## Traits

**Stench**
*Constitution Saving Throw*: DC 10, any creature that starts its turn in a 5-foot Emanation originating from the ghast. *Failure:*  The target has the Poisoned condition until the start of its next turn. *Success:*  The target is immune to this ghast's Stench for 24 hours.

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage plus 9 (2d8) Necrotic damage.

**Claw**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage. If the target is a non-Undead creature, it is subjected to the following effect. *Constitution Saving Throw*: DC 10. *Failure:*  The target has the Paralyzed condition until the end of its next turn.
