---
smType: creature
name: "Ghoul"
size: "Medium"
type: "Undead"
alignment: "Chaotic Evil"
ac: "12"
initiative: "+2"
hp: "22"
hit_dice: "5d8"
speed_walk: "30 ft."
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"}}"
str: "13"
dex: "15"
con: "10"
int: "7"
wis: "10"
cha: "6"
pb: "+2"
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 10"]
languages: ["Common"]
damage_immunities: ["Poison", "Charmed", "Exhaustion", "Poisoned"]
cr: "1"
xp: "200"
entries_structured_json: "[{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The ghoul makes two Bite attacks.\"},{\"category\":\"action\",\"name\":\"Bite\",\"text\":\"*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 3 (1d6) Necrotic damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+4\",\"range\":\"5 ft\",\"damage\":\"5 (1d6 + 2) Piercing\"},{\"category\":\"action\",\"name\":\"Claw\",\"text\":\"*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Slashing damage. If the target is a creature that isn't an Undead or elf, it is subjected to the following effect. *Constitution Saving Throw*: DC 10. *Failure:*  The target has the Paralyzed condition until the end of its next turn.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+4\",\"range\":\"5 ft\",\"damage\":\"4 (1d4 + 2) Slashing\",\"save_ability\":\"CON\",\"save_dc\":10}]"
---

# Ghoul
*Medium, Undead, Chaotic Evil*

**AC** 12
**HP** 22 (5d8)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 13 | 15 | 10 | 7 | 10 | 6 |

CR 1, XP 200

## Actions

**Multiattack**
The ghoul makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 3 (1d6) Necrotic damage.

**Claw**
*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Slashing damage. If the target is a creature that isn't an Undead or elf, it is subjected to the following effect. *Constitution Saving Throw*: DC 10. *Failure:*  The target has the Paralyzed condition until the end of its next turn.
