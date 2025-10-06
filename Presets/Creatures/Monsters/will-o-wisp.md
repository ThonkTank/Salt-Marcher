---
smType: creature
name: "Will-o'-Wisp"
size: "Small"
type: "Undead"
alignment: "Chaotic Evil"
ac: "19"
initiative: "+9"
hp: "27"
hit_dice: "11d4"
speed_walk: "5 ft."
speed_fly: "50 ft."
speed_fly_hover: true
speeds_json: "{\"walk\":{\"distance\":\"5 ft.\"},\"fly\":{\"distance\":\"50 ft.\",\"hover\":true}}"
str: "1"
dex: "28"
con: "10"
int: "13"
wis: "14"
cha: "11"
pb: "+2"
senses: ["darkvision 120 ft."]
passives: ["Passive Perception 12"]
languages: ["Common plus one other language"]
damage_resistances: ["Acid", "Bludgeoning", "Cold", "Fire", "Necrotic", "Piercing", "Slashing"]
damage_immunities: ["Lightning", "Poison", "Exhaustion", "Grappled", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Unconscious"]
cr: "2"
xp: "450"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Ephemeral\",\"text\":\"The wisp can't wear or carry anything.\"},{\"category\":\"trait\",\"name\":\"Illumination\",\"text\":\"The wisp sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet.\"},{\"category\":\"trait\",\"name\":\"Incorporeal Movement\",\"text\":\"The wisp can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.\",\"damage\":\"5 (1d10) Force\"},{\"category\":\"action\",\"name\":\"Shock\",\"text\":\"*Melee Attack Roll:* +4, reach 5 ft. 11 (2d8 + 2) Lightning damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+4\",\"range\":\"5 ft\",\"damage\":\"11 (2d8 + 2) Lightning\"},{\"category\":\"bonus\",\"name\":\"Consume Life\",\"text\":\"*Constitution Saving Throw*: DC 10, one living creature the wisp can see within 5 feet that has 0 Hit Points. *Failure:*  The target dies, and the wisp regains 10 (3d6) Hit Points.\",\"save_ability\":\"CON\",\"save_dc\":10},{\"category\":\"bonus\",\"name\":\"Vanish\",\"text\":\"The wisp and its light have the Invisible condition until the wisp's  Concentration ends on this effect, which ends early immediately after the wisp makes an attack roll or uses Consume Life.\"}]"
---

# Will-o'-Wisp
*Small, Undead, Chaotic Evil*

**AC** 19
**HP** 27 (11d4)
**Speed** 5 ft., fly 50 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 1 | 28 | 10 | 13 | 14 | 11 |

CR 2, XP 450

## Traits

**Ephemeral**
The wisp can't wear or carry anything.

**Illumination**
The wisp sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet.

**Incorporeal Movement**
The wisp can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.

## Actions

**Shock**
*Melee Attack Roll:* +4, reach 5 ft. 11 (2d8 + 2) Lightning damage.

## Bonus Actions

**Consume Life**
*Constitution Saving Throw*: DC 10, one living creature the wisp can see within 5 feet that has 0 Hit Points. *Failure:*  The target dies, and the wisp regains 10 (3d6) Hit Points.

**Vanish**
The wisp and its light have the Invisible condition until the wisp's  Concentration ends on this effect, which ends early immediately after the wisp makes an attack roll or uses Consume Life.
