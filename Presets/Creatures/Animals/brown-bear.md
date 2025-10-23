---
smType: creature
name: Brown Bear
size: Large
type: Beast
alignmentOverride: Unaligned
ac: "11"
initiative: +1 (11)
hp: "22"
hitDice: 3d10 + 6
speeds:
  - type: walk
    value: "40"
  - type: climb
    value: "30"
abilities:
  - ability: str
    score: 17
  - ability: dex
    score: 12
  - ability: con
    score: 15
  - ability: int
    score: 2
  - ability: wis
    score: 13
  - ability: cha
    score: 7
pb: "+2"
cr: "1"
xp: "200"
sensesList:
  - type: darkvision
    range: "60"
passivesList:
  - skill: Perception
    value: "13"
entries:
  - category: action
    name: Multiattack
    text: The bear makes one Bite attack and one Claw attack.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage."
  - category: action
    name: Claw
    text: "*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition."

---

# Brown Bear
*Large, Beast, Unaligned*

**AC** 11
**HP** 22 (3d10 + 6)
**Initiative** +1 (11)
**Speed** 40 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 17 | 12 | 15 | 2 | 13 | 7 |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 1, PB +2, XP 200

## Actions

**Multiattack**
The bear makes one Bite attack and one Claw attack.

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage.

**Claw**
*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.
