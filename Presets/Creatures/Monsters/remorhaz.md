---
smType: creature
name: "Remorhaz"
size: "Huge"
type: "Monstrosity"
alignment: "Unaligned"
ac: "17"
initiative: "+5"
hp: "195"
hit_dice: "17d12 + 85"
speed_walk: "40 ft."
speed_burrow: "30 ft."
speeds_json: "{\"walk\":{\"distance\":\"40 ft.\"},\"burrow\":{\"distance\":\"30 ft.\"}}"
str: "24"
dex: "13"
con: "21"
int: "4"
wis: "10"
cha: "5"
pb: "+4"
senses: ["darkvision 60 ft.", "tremorsense 60 ft."]
passives: ["Passive Perception 10"]
damage_immunities: ["Cold", "Fire"]
cr: "11"
xp: "7200"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Heat Aura\",\"text\":\"At the end of each of the remorhaz's turns, each creature in a 5-foot Emanation originating from the remorhaz takes 16 (3d10) Fire damage.\",\"target\":\"each creature in a 5-foot Emanation originating from the remorhaz takes 16 (3d10) Fire damage\",\"damage\":\"16 (3d10) Fire\"},{\"category\":\"action\",\"name\":\"Bite\",\"text\":\"*Melee Attack Roll:* +11, reach 10 ft. 18 (2d10 + 7) Piercing damage plus 14 (4d6) Fire damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17), and it has the Restrained condition until the grapple ends.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+11\",\"range\":\"10 ft\",\"damage\":\"18 (2d10 + 7) Piercing\"},{\"category\":\"bonus\",\"name\":\"Swallow\",\"text\":\"*Strength Saving Throw*: DC 19, one Large or smaller creature Grappled by the remorhaz (it can have up to two creatures swallowed at a time). *Failure:*  The target is swallowed by the remorhaz, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions, it has Cover|XPHB|Total Cover against attacks and other effects outside the remorhaz, and it takes 10 (3d6) Acid damage plus 10 (3d6) Fire damage at the start of each of the remorhaz's turns. If the remorhaz takes 30 damage or more on a single turn from a creature inside it, the remorhaz must succeed on a DC 15 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 5 feet of the remorhaz and has the Prone condition. If the remorhaz dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse by using 15 feet of movement, exiting Prone.\",\"damage\":\"10 (3d6) Acid\",\"save_ability\":\"STR\",\"save_dc\":19}]"
---

# Remorhaz
*Huge, Monstrosity, Unaligned*

**AC** 17
**HP** 195 (17d12 + 85)
**Speed** 40 ft., burrow 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 24 | 13 | 21 | 4 | 10 | 5 |

CR 11, XP 7200

## Traits

**Heat Aura**
At the end of each of the remorhaz's turns, each creature in a 5-foot Emanation originating from the remorhaz takes 16 (3d10) Fire damage.

## Actions

**Bite**
*Melee Attack Roll:* +11, reach 10 ft. 18 (2d10 + 7) Piercing damage plus 14 (4d6) Fire damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17), and it has the Restrained condition until the grapple ends.

## Bonus Actions

**Swallow**
*Strength Saving Throw*: DC 19, one Large or smaller creature Grappled by the remorhaz (it can have up to two creatures swallowed at a time). *Failure:*  The target is swallowed by the remorhaz, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions, it has Cover|XPHB|Total Cover against attacks and other effects outside the remorhaz, and it takes 10 (3d6) Acid damage plus 10 (3d6) Fire damage at the start of each of the remorhaz's turns. If the remorhaz takes 30 damage or more on a single turn from a creature inside it, the remorhaz must succeed on a DC 15 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 5 feet of the remorhaz and has the Prone condition. If the remorhaz dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse by using 15 feet of movement, exiting Prone.
