---
smType: creature
name: "Purple Worm"
size: "Gargantuan"
type: "Monstrosity"
alignment: "Unaligned"
ac: "18"
initiative: "+3"
hp: "247"
hit_dice: "15d20 + 90"
speed_walk: "50 ft."
speed_burrow: "50 ft."
speeds_json: "{\"walk\":{\"distance\":\"50 ft.\"},\"burrow\":{\"distance\":\"50 ft.\"}}"
str: "28"
dex: "7"
con: "22"
int: "1"
wis: "8"
cha: "4"
pb: "+5"
saves_prof: ["CON", "WIS"]
senses: ["blindsight 30 ft.", "tremorsense 60 ft."]
passives: ["Passive Perception 9"]
cr: "15"
xp: "13000"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Tunneler\",\"text\":\"The worm can burrow through solid rock at half its Burrow Speed and leaves a 10-foot-diameter tunnel in its wake.\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The worm makes one Bite attack and one Tail Stinger attack.\"},{\"category\":\"action\",\"name\":\"Bite\",\"text\":\"*Melee Attack Roll:* +14, reach 10 ft. 22 (3d8 + 9) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 19), and it has the Restrained condition until the grapple ends.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+14\",\"range\":\"10 ft\",\"damage\":\"22 (3d8 + 9) Piercing\"},{\"category\":\"action\",\"name\":\"Tail Stinger\",\"text\":\"*Melee Attack Roll:* +14, reach 10 ft. 16 (2d6 + 9) Piercing damage plus 35 (10d6) Poison damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+14\",\"range\":\"10 ft\",\"damage\":\"16 (2d6 + 9) Piercing\"},{\"category\":\"bonus\",\"name\":\"Swallow\",\"text\":\"*Strength Saving Throw*: DC 19, one Large or smaller creature Grappled by the worm (it can have up to three creatures swallowed at a time). *Failure:*  The target is swallowed by the worm, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions, has Cover|XPHB|Total Cover against attacks and other effects outside the worm, and takes 17 (5d6) Acid damage at the start of each of the worm's turns. If the worm takes 30 damage or more on a single turn from a creature inside it, the worm must succeed on a DC 21 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 5 feet of the worm and has the Prone condition. If the worm dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 20 feet of movement, exiting Prone.\",\"damage\":\"17 (5d6) Acid\",\"save_ability\":\"STR\",\"save_dc\":19}]"
---

# Purple Worm
*Gargantuan, Monstrosity, Unaligned*

**AC** 18
**HP** 247 (15d20 + 90)
**Speed** 50 ft., burrow 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 28 | 7 | 22 | 1 | 8 | 4 |

CR 15, XP 13000

## Traits

**Tunneler**
The worm can burrow through solid rock at half its Burrow Speed and leaves a 10-foot-diameter tunnel in its wake.

## Actions

**Multiattack**
The worm makes one Bite attack and one Tail Stinger attack.

**Bite**
*Melee Attack Roll:* +14, reach 10 ft. 22 (3d8 + 9) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 19), and it has the Restrained condition until the grapple ends.

**Tail Stinger**
*Melee Attack Roll:* +14, reach 10 ft. 16 (2d6 + 9) Piercing damage plus 35 (10d6) Poison damage.

## Bonus Actions

**Swallow**
*Strength Saving Throw*: DC 19, one Large or smaller creature Grappled by the worm (it can have up to three creatures swallowed at a time). *Failure:*  The target is swallowed by the worm, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions, has Cover|XPHB|Total Cover against attacks and other effects outside the worm, and takes 17 (5d6) Acid damage at the start of each of the worm's turns. If the worm takes 30 damage or more on a single turn from a creature inside it, the worm must succeed on a DC 21 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 5 feet of the worm and has the Prone condition. If the worm dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 20 feet of movement, exiting Prone.
