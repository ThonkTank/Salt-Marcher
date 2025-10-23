---
smType: creature
name: Grick
size: Medium
type: Aberration
alignmentOverride: Unaligned
ac: "14"
initiative: +2 (12)
hp: "54"
hitDice: 12d8
speeds:
  - type: walk
    value: "30"
  - type: climb
    value: "30"
abilities:
  - ability: str
    score: 14
  - ability: dex
    score: 14
  - ability: con
    score: 11
  - ability: int
    score: 3
  - ability: wis
    score: 14
  - ability: cha
    score: 5
pb: "+2"
cr: "2"
xp: "450"
sensesList:
  - type: darkvision
    range: "60"
passivesList:
  - skill: Perception
    value: "12"
entries:
  - category: action
    name: Multiattack
    text: The grick makes one Beak attack and one Tentacles attack.
  - category: action
    name: Beak
    text: "*Melee Attack Roll:* +4, reach 5 ft. 9 (2d6 + 2) Piercing damage."
  - category: action
    name: Tentacles
    text: "*Melee Attack Roll:* +4, reach 5 ft. 7 (1d10 + 2) Slashing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12) from all four tentacles."

---

# Grick
*Medium, Aberration, Unaligned*

**AC** 14
**HP** 54 (12d8)
**Initiative** +2 (12)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 14 | 14 | 11 | 3 | 14 | 5 |

**Senses** darkvision 60 ft.; Passive Perception 12
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The grick makes one Beak attack and one Tentacles attack.

**Beak**
*Melee Attack Roll:* +4, reach 5 ft. 9 (2d6 + 2) Piercing damage.

**Tentacles**
*Melee Attack Roll:* +4, reach 5 ft. 7 (1d10 + 2) Slashing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12) from all four tentacles.
