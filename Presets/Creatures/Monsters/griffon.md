---
smType: creature
name: Griffon
size: Large
type: Monstrosity
alignmentOverride: Unaligned
ac: "12"
initiative: +2 (12)
hp: "59"
hitDice: 7d10 + 21
speeds:
  - type: walk
    value: "30"
  - type: fly
    value: "80"
abilities:
  - ability: str
    score: 18
  - ability: dex
    score: 15
  - ability: con
    score: 16
  - ability: int
    score: 2
  - ability: wis
    score: 13
  - ability: cha
    score: 8
pb: "+2"
cr: "2"
xp: "450"
sensesList:
  - type: darkvision
    range: "60"
passivesList:
  - skill: Perception
    value: "15"
entries:
  - category: action
    name: Multiattack
    text: The griffon makes two Rend attacks.
  - category: action
    name: Rend
    text: "*Melee Attack Roll:* +6, reach 5 ft. 8 (1d8 + 4) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 14) from both of the griffon's front claws."

---

# Griffon
*Large, Monstrosity, Unaligned*

**AC** 12
**HP** 59 (7d10 + 21)
**Initiative** +2 (12)
**Speed** 30 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 18 | 15 | 16 | 2 | 13 | 8 |

**Senses** darkvision 60 ft.; Passive Perception 15
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The griffon makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +6, reach 5 ft. 8 (1d8 + 4) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 14) from both of the griffon's front claws.
