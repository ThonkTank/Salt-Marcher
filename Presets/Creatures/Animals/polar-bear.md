---
smType: creature
name: Polar Bear
size: Large
type: Beast
alignmentOverride: Unaligned
ac: "12"
initiative: +2 (12)
hp: "42"
hitDice: 5d10 + 15
speeds:
  - type: walk
    value: "40"
  - type: swim
    value: "40"
abilities:
  - ability: str
    score: 20
  - ability: dex
    score: 14
  - ability: con
    score: 16
  - ability: int
    score: 2
  - ability: wis
    score: 13
  - ability: cha
    score: 7
pb: "+2"
cr: "2"
xp: "450"
sensesList:
  - type: darkvision
    range: "60"
passivesList:
  - skill: Perception
    value: "15"
damageResistancesList:
  - value: Cold
entries:
  - category: action
    name: Multiattack
    text: The bear makes two Rend attacks.
  - category: action
    name: Rend
    text: "*Melee Attack Roll:* +7, reach 5 ft. 9 (1d8 + 5) Slashing damage."

---

# Polar Bear
*Large, Beast, Unaligned*

**AC** 12
**HP** 42 (5d10 + 15)
**Initiative** +2 (12)
**Speed** 40 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 20 | 14 | 16 | 2 | 13 | 7 |

**Senses** darkvision 60 ft.; Passive Perception 15
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The bear makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +7, reach 5 ft. 9 (1d8 + 5) Slashing damage.
