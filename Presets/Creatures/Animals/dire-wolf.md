---
smType: creature
name: Dire Wolf
size: Large
type: Beast
alignmentOverride: Unaligned
ac: "14"
initiative: +2 (12)
hp: "22"
hitDice: 3d10 + 6
speeds:
  - type: walk
    value: "50"
abilities:
  - ability: str
    score: 17
  - ability: dex
    score: 15
  - ability: con
    score: 15
  - ability: int
    score: 3
  - ability: wis
    score: 12
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
    value: "15"
entries:
  - category: trait
    name: Pack Tactics
    text: The wolf has Advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Piercing damage. If the target is a Large or smaller creature, it has the Prone condition."

---

# Dire Wolf
*Large, Beast, Unaligned*

**AC** 14
**HP** 22 (3d10 + 6)
**Initiative** +2 (12)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 17 | 15 | 15 | 3 | 12 | 7 |

**Senses** darkvision 60 ft.; Passive Perception 15
CR 1, PB +2, XP 200

## Traits

**Pack Tactics**
The wolf has Advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Piercing damage. If the target is a Large or smaller creature, it has the Prone condition.
