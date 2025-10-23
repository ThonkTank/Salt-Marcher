---
smType: creature
name: Constrictor Snake
size: Large
type: Beast
alignmentOverride: Unaligned
ac: "13"
initiative: +2 (12)
hp: "13"
hitDice: 2d10 + 2
speeds:
  - type: walk
    value: "30"
  - type: swim
    value: "30"
abilities:
  - ability: str
    score: 15
  - ability: dex
    score: 14
  - ability: con
    score: 12
  - ability: int
    score: 1
  - ability: wis
    score: 10
  - ability: cha
    score: 3
pb: "+2"
cr: 1/4
xp: "50"
sensesList:
  - type: blindsight
    range: "10"
passivesList:
  - skill: Perception
    value: "12"
entries:
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Piercing damage."
  - category: action
    name: Constrict
    text: "*Strength Saving Throw*: DC 12, one Medium or smaller creature the snake can see within 5 feet. *Failure:*  7 (3d4) Bludgeoning damage, and the target has the Grappled condition (escape DC 12)."

---

# Constrictor Snake
*Large, Beast, Unaligned*

**AC** 13
**HP** 13 (2d10 + 2)
**Initiative** +2 (12)
**Speed** 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 15 | 14 | 12 | 1 | 10 | 3 |

**Senses** blindsight 10 ft.; Passive Perception 12
CR 1/4, PB +2, XP 50

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Piercing damage.

**Constrict**
*Strength Saving Throw*: DC 12, one Medium or smaller creature the snake can see within 5 feet. *Failure:*  7 (3d4) Bludgeoning damage, and the target has the Grappled condition (escape DC 12).
