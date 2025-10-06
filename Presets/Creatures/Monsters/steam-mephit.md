---
smType: creature
name: "Steam Mephit"
size: "Small"
type: "Elemental"
alignment: "Neutral Evil"
ac: "10"
initiative: "+0"
hp: "17"
hit_dice: "5d6"
speed_walk: "30 ft."
speed_fly: "30 ft."
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"},\"fly\":{\"distance\":\"30 ft.\"}}"
str: "5"
dex: "11"
con: "10"
int: "11"
wis: "10"
cha: "12"
pb: "+2"
skills_prof: ["Stealth"]
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 10"]
languages: ["Primordial (Aquan", "Ignan)"]
damage_immunities: ["Fire", "Poison", "Exhaustion", "Poisoned"]
cr: "1/4"
xp: "50"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Blurred Form\",\"text\":\"Attack rolls against the mephit are made with Disadvantage unless the mephit has the Incapacitated condition.\"},{\"category\":\"trait\",\"name\":\"Death Burst\",\"text\":\"The mephit explodes when it dies. *Dexterity Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Fire damage. *Success:*  Half damage.\",\"target\":\"each creature in a 5-foot Emanation originating from the mephit\",\"damage\":\"5 (2d4) Fire\",\"save_ability\":\"DEX\",\"save_dc\":10,\"save_effect\":\"Half damage\"},{\"category\":\"action\",\"name\":\"Claw\",\"text\":\"*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Slashing damage plus 2 (1d4) Fire damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+2\",\"range\":\"5 ft\",\"damage\":\"2 (1d4) Slashing\"},{\"category\":\"action\",\"name\":\"Steam Breath\",\"recharge\":\"Recharge 6\",\"text\":\"*Constitution Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  5 (2d4) Fire damage, and the target's Speed decreases by 10 feet until the end of the mephit's next turn. *Success:*  Half damage only. *Failure or Success*:  Being underwater doesn't grant Resistance to this Fire damage.\",\"target\":\"each creature in a 15-foot Cone\",\"damage\":\"5 (2d4) Fire\",\"save_ability\":\"CON\",\"save_dc\":10,\"save_effect\":\"Half damage only\"}]"
---

# Steam Mephit
*Small, Elemental, Neutral Evil*

**AC** 10
**HP** 17 (5d6)
**Speed** 30 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 5 | 11 | 10 | 11 | 10 | 12 |

CR 1/4, XP 50

## Traits

**Blurred Form**
Attack rolls against the mephit are made with Disadvantage unless the mephit has the Incapacitated condition.

**Death Burst**
The mephit explodes when it dies. *Dexterity Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Fire damage. *Success:*  Half damage.

## Actions

**Claw**
*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Slashing damage plus 2 (1d4) Fire damage.

**Steam Breath (Recharge 6)**
*Constitution Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  5 (2d4) Fire damage, and the target's Speed decreases by 10 feet until the end of the mephit's next turn. *Success:*  Half damage only. *Failure or Success*:  Being underwater doesn't grant Resistance to this Fire damage.
