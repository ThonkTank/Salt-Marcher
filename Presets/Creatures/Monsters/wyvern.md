---
smType: creature
name: Wyvern
size: Large
type: Dragon
alignmentOverride: Unaligned
ac: "14"
initiative: +0 (10)
hp: "127"
hitDice: 15d10 + 45
speeds:
  - type: walk
    value: "30"
  - type: fly
    value: "80"
abilities:
  - ability: str
    score: 19
  - ability: dex
    score: 10
  - ability: con
    score: 16
  - ability: int
    score: 5
  - ability: wis
    score: 12
  - ability: cha
    score: 6
pb: "+3"
cr: "6"
xp: "2300"
sensesList:
  - type: darkvision
    range: "120"
passivesList:
  - skill: Perception
    value: "14"
entries:
  - category: action
    name: Multiattack
    text: The wyvern makes one Bite attack and one Sting attack.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Piercing damage."
  - category: action
    name: Sting
    text: "*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Piercing damage plus 24 (7d6) Poison damage, and the target has the Poisoned condition until the start of the wyvern's next turn."

---

# Wyvern
*Large, Dragon, Unaligned*

**AC** 14
**HP** 127 (15d10 + 45)
**Initiative** +0 (10)
**Speed** 30 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 19 | 10 | 16 | 5 | 12 | 6 |

**Senses** darkvision 120 ft.; Passive Perception 14
CR 6, PB +3, XP 2300

## Actions

**Multiattack**
The wyvern makes one Bite attack and one Sting attack.

**Bite**
*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Piercing damage.

**Sting**
*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Piercing damage plus 24 (7d6) Poison damage, and the target has the Poisoned condition until the start of the wyvern's next turn.
