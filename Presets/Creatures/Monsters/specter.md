---
smType: creature
name: "Specter"
size: "Medium"
type: "Undead"
alignment: "Chaotic Evil"
ac: "12"
initiative: "+2"
hp: "22"
hit_dice: "5d8"
speed_walk: "30 ft."
speed_fly: "50 ft."
speed_fly_hover: true
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"},\"fly\":{\"distance\":\"50 ft.\",\"hover\":true}}"
str: "1"
dex: "14"
con: "11"
int: "10"
wis: "10"
cha: "11"
pb: "+2"
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 10"]
languages: ["Understands Common plus one other language but can't speak"]
damage_resistances: ["Acid", "Bludgeoning", "Cold", "Fire", "Lightning", "Piercing", "Slashing", "Thunder"]
damage_immunities: ["Necrotic", "Poison", "Charmed", "Exhaustion", "Grappled", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Unconscious"]
cr: "1"
xp: "200"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Incorporeal Movement\",\"text\":\"The specter can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.\",\"damage\":\"5 (1d10) Force\"},{\"category\":\"trait\",\"name\":\"Sunlight Sensitivity\",\"text\":\"While in sunlight, the specter has Disadvantage on ability checks and attack rolls.\"},{\"category\":\"action\",\"name\":\"Life Drain\",\"text\":\"*Melee Attack Roll:* +4, reach 5 ft. 7 (2d6) Necrotic damage. If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+4\",\"range\":\"5 ft\",\"damage\":\"7 (2d6) Necrotic\"}]"
---

# Specter
*Medium, Undead, Chaotic Evil*

**AC** 12
**HP** 22 (5d8)
**Speed** 30 ft., fly 50 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 1 | 14 | 11 | 10 | 10 | 11 |

CR 1, XP 200

## Traits

**Incorporeal Movement**
The specter can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.

**Sunlight Sensitivity**
While in sunlight, the specter has Disadvantage on ability checks and attack rolls.

## Actions

**Life Drain**
*Melee Attack Roll:* +4, reach 5 ft. 7 (2d6) Necrotic damage. If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.
