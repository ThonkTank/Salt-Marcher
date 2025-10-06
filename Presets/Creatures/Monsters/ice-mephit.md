---
smType: creature
name: "Ice Mephit"
size: "Small"
type: "Elemental"
alignment: "Neutral Evil"
ac: "11"
initiative: "+1"
hp: "21"
hit_dice: "6d6"
speed_walk: "30 ft."
speed_fly: "30 ft."
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"},\"fly\":{\"distance\":\"30 ft.\"}}"
str: "7"
dex: "13"
con: "10"
int: "9"
wis: "11"
cha: "12"
pb: "+2"
skills_prof: ["Perception", "Stealth"]
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 12"]
languages: ["Primordial (Aquan", "Auran)"]
damage_immunities: ["Cold", "Poison", "Exhaustion", "Poisoned"]
damage_vulnerabilities: ["Fire"]
cr: "1/2"
xp: "100"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Death Burst\",\"text\":\"The mephit explodes when it dies. *Constitution Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Cold damage. *Success:*  Half damage.\",\"target\":\"each creature in a 5-foot Emanation originating from the mephit\",\"damage\":\"5 (2d4) Cold\",\"save_ability\":\"CON\",\"save_dc\":10,\"save_effect\":\"Half damage\"},{\"category\":\"action\",\"name\":\"Claw\",\"text\":\"*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Slashing damage plus 2 (1d4) Cold damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+3\",\"range\":\"5 ft\",\"damage\":\"3 (1d4 + 1) Slashing\"},{\"category\":\"action\",\"name\":\"Frost Breath\",\"recharge\":\"Recharge 6\",\"text\":\"*Constitution Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  7 (3d4) Cold damage. *Success:*  Half damage.\",\"target\":\"each creature in a 15-foot Cone\",\"damage\":\"7 (3d4) Cold\",\"save_ability\":\"CON\",\"save_dc\":10,\"save_effect\":\"Half damage\"},{\"category\":\"action\",\"name\":\"Fog Cloud\",\"recharge\":\"1/Day\",\"text\":\"The mephit casts *Fog Cloud*, requiring no spell components and using Charisma as the spellcasting ability. - **At Will:** - **1/Day Each:** *Fog Cloud*\"}]"
---

# Ice Mephit
*Small, Elemental, Neutral Evil*

**AC** 11
**HP** 21 (6d6)
**Speed** 30 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 7 | 13 | 10 | 9 | 11 | 12 |

CR 1/2, XP 100

## Traits

**Death Burst**
The mephit explodes when it dies. *Constitution Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Cold damage. *Success:*  Half damage.

## Actions

**Claw**
*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Slashing damage plus 2 (1d4) Cold damage.

**Frost Breath (Recharge 6)**
*Constitution Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  7 (3d4) Cold damage. *Success:*  Half damage.

**Fog Cloud (1/Day)**
The mephit casts *Fog Cloud*, requiring no spell components and using Charisma as the spellcasting ability. - **At Will:** - **1/Day Each:** *Fog Cloud*
