---
smType: creature
name: "Air Elemental"
size: "Large"
type: "Elemental"
alignment: "Neutral Neutral"
ac: "15"
initiative: "+5"
hp: "90"
hit_dice: "12d10 + 24"
speed_walk: "10 ft."
speed_fly: "90 ft."
speed_fly_hover: true
speeds_json: "{\"walk\":{\"distance\":\"10 ft.\"},\"fly\":{\"distance\":\"90 ft.\",\"hover\":true}}"
str: "14"
dex: "20"
con: "14"
int: "6"
wis: "10"
cha: "6"
pb: "+3"
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 10"]
languages: ["Primordial (Auran)"]
damage_resistances: ["Bludgeoning", "Lightning", "Piercing", "Slashing"]
damage_immunities: ["Poison", "Thunder", "Exhaustion", "Grappled", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Unconscious"]
cr: "5"
xp: "1800"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Air Form\",\"text\":\"The elemental can enter a creature's space and stop there. It can move through a space as narrow as 1 inch without expending extra movement to do so.\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The elemental makes two Thunderous Slam attacks.\"},{\"category\":\"action\",\"name\":\"Thunderous Slam\",\"text\":\"*Melee Attack Roll:* +8, reach 10 ft. 14 (2d8 + 5) Thunder damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+8\",\"range\":\"10 ft\",\"damage\":\"14 (2d8 + 5) Thunder\"},{\"category\":\"action\",\"name\":\"Whirlwind\",\"recharge\":\"Recharge 4-6\",\"text\":\"*Strength Saving Throw*: DC 13, one Medium or smaller creature in the elemental's space. *Failure:*  24 (4d10 + 2) Thunder damage, and the target is pushed up to 20 feet straight away from the elemental and has the Prone condition. *Success:*  Half damage only.\",\"damage\":\"24 (4d10 + 2) Thunder\",\"save_ability\":\"STR\",\"save_dc\":13,\"save_effect\":\"Half damage only\"}]"
---

# Air Elemental
*Large, Elemental, Neutral Neutral*

**AC** 15
**HP** 90 (12d10 + 24)
**Speed** 10 ft., fly 90 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 14 | 20 | 14 | 6 | 10 | 6 |

CR 5, XP 1800

## Traits

**Air Form**
The elemental can enter a creature's space and stop there. It can move through a space as narrow as 1 inch without expending extra movement to do so.

## Actions

**Multiattack**
The elemental makes two Thunderous Slam attacks.

**Thunderous Slam**
*Melee Attack Roll:* +8, reach 10 ft. 14 (2d8 + 5) Thunder damage.

**Whirlwind (Recharge 4-6)**
*Strength Saving Throw*: DC 13, one Medium or smaller creature in the elemental's space. *Failure:*  24 (4d10 + 2) Thunder damage, and the target is pushed up to 20 feet straight away from the elemental and has the Prone condition. *Success:*  Half damage only.
