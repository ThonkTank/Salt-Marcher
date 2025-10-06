---
smType: creature
name: "Storm Giant"
size: "Huge"
type: "Giant"
alignment: "Chaotic Good"
ac: "16"
initiative: "+7"
hp: "230"
hit_dice: "20d12 + 100"
speed_walk: "50 ft."
speed_swim: "50 ft."
speed_fly: "25 ft."
speed_fly_hover: true
speeds_json: "{\"walk\":{\"distance\":\"50 ft.\"},\"fly\":{\"distance\":\"25 ft.\",\"hover\":true},\"swim\":{\"distance\":\"50 ft.\"}}"
str: "29"
dex: "14"
con: "20"
int: "16"
wis: "20"
cha: "18"
pb: "+5"
saves_prof: ["STR", "CON", "WIS", "CHA"]
skills_prof: ["Arcana", "Athletics", "History", "Perception"]
senses: ["darkvision 120 ft.", "truesight 30 ft."]
passives: ["Passive Perception 20"]
languages: ["Common", "Giant"]
damage_resistances: ["Cold"]
damage_immunities: ["Lightning", "Thunder"]
cr: "13"
xp: "10000"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Amphibious\",\"text\":\"The giant can breathe air and water.\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The giant makes two attacks, using Storm Sword or Thunderbolt in any combination.\"},{\"category\":\"action\",\"name\":\"Storm Sword\",\"text\":\"*Melee Attack Roll:* +14, reach 10 ft. 23 (4d6 + 9) Slashing damage plus 13 (3d8) Lightning damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+14\",\"range\":\"10 ft\",\"damage\":\"23 (4d6 + 9) Slashing\"},{\"category\":\"action\",\"name\":\"Thunderbolt\",\"text\":\"*Ranged Attack Roll:* +14, range 500 ft. 22 (2d12 + 9) Lightning damage, and the target has the Blinded and Deafened conditions until the start of the giant's next turn.\",\"kind\":\"Ranged Attack Roll\",\"to_hit\":\"+14\",\"range\":\"500 ft\",\"damage\":\"22 (2d12 + 9) Lightning\"},{\"category\":\"action\",\"name\":\"Lightning Storm\",\"recharge\":\"Recharge 5-6\",\"text\":\"*Dexterity Saving Throw*: DC 18, each creature in a 10-foot-radius, 40-foot-high Cylinder [Area of Effect]|XPHB|Cylinder originating from a point the giant can see within 500 feet. *Failure:*  55 (10d10) Lightning damage. *Success:*  Half damage.\",\"target\":\"each creature in a 10-foot-radius, 40-foot-high Cylinder [Area of Effect]|XPHB|Cylinder originating from a point the giant can see within 500 feet\",\"damage\":\"55 (10d10) Lightning\",\"save_ability\":\"DEX\",\"save_dc\":18,\"save_effect\":\"Half damage\"},{\"category\":\"action\",\"name\":\"Spellcasting\",\"text\":\"The giant casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 18): - **At Will:** *Detect Magic*, *Light* - **1/Day Each:** *Control Weather*\"}]"
---

# Storm Giant
*Huge, Giant, Chaotic Good*

**AC** 16
**HP** 230 (20d12 + 100)
**Speed** 50 ft., swim 50 ft., fly 25 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 29 | 14 | 20 | 16 | 20 | 18 |

CR 13, XP 10000

## Traits

**Amphibious**
The giant can breathe air and water.

## Actions

**Multiattack**
The giant makes two attacks, using Storm Sword or Thunderbolt in any combination.

**Storm Sword**
*Melee Attack Roll:* +14, reach 10 ft. 23 (4d6 + 9) Slashing damage plus 13 (3d8) Lightning damage.

**Thunderbolt**
*Ranged Attack Roll:* +14, range 500 ft. 22 (2d12 + 9) Lightning damage, and the target has the Blinded and Deafened conditions until the start of the giant's next turn.

**Lightning Storm (Recharge 5-6)**
*Dexterity Saving Throw*: DC 18, each creature in a 10-foot-radius, 40-foot-high Cylinder [Area of Effect]|XPHB|Cylinder originating from a point the giant can see within 500 feet. *Failure:*  55 (10d10) Lightning damage. *Success:*  Half damage.

**Spellcasting**
The giant casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 18): - **At Will:** *Detect Magic*, *Light* - **1/Day Each:** *Control Weather*
