---
smType: creature
name: Purple Worm
size: Gargantuan
type: Monstrosity
alignmentOverride: Unaligned
ac: "18"
initiative: +3 (13)
hp: "247"
hitDice: 15d20 + 90
speeds:
  - type: walk
    value: "50"
  - type: burrow
    value: "50"
abilities:
  - ability: str
    score: 28
  - ability: dex
    score: 7
  - ability: con
    score: 22
  - ability: int
    score: 1
  - ability: wis
    score: 8
  - ability: cha
    score: 4
pb: "+5"
cr: "15"
xp: "13000"
sensesList:
  - type: blindsight
    range: "30"
  - type: tremorsense
    range: "60"
passivesList:
  - skill: Perception
    value: "9"
entries:
  - category: trait
    name: Tunneler
    text: The worm can burrow through solid rock at half its Burrow Speed and leaves a 10-foot-diameter tunnel in its wake.
  - category: action
    name: Multiattack
    text: The worm makes one Bite attack and one Tail Stinger attack.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +14, reach 10 ft. 22 (3d8 + 9) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 19), and it has the Restrained condition until the grapple ends."
  - category: action
    name: Tail Stinger
    text: "*Melee Attack Roll:* +14, reach 10 ft. 16 (2d6 + 9) Piercing damage plus 35 (10d6) Poison damage."
  - category: bonus
    name: Swallow
    text: "*Strength Saving Throw*: DC 19, one Large or smaller creature Grappled by the worm (it can have up to three creatures swallowed at a time). *Failure:*  The target is swallowed by the worm, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions, has Cover|XPHB|Total Cover against attacks and other effects outside the worm, and takes 17 (5d6) Acid damage at the start of each of the worm's turns. If the worm takes 30 damage or more on a single turn from a creature inside it, the worm must succeed on a DC 21 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 5 feet of the worm and has the Prone condition. If the worm dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 20 feet of movement, exiting Prone."

---

# Purple Worm
*Gargantuan, Monstrosity, Unaligned*

**AC** 18
**HP** 247 (15d20 + 90)
**Initiative** +3 (13)
**Speed** 50 ft., burrow 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 28 | 7 | 22 | 1 | 8 | 4 |

**Senses** blindsight 30 ft., tremorsense 60 ft.; Passive Perception 9
CR 15, PB +5, XP 13000

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
