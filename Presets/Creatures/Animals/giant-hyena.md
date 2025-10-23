---
smType: creature
name: Giant Hyena
size: Large
type: Beast
alignmentOverride: Unaligned
ac: "12"
initiative: +2 (12)
hp: "45"
hitDice: 6d10 + 12
speeds:
  - type: walk
    value: "50"
abilities:
  - ability: str
    score: 16
  - ability: dex
    score: 14
  - ability: con
    score: 14
  - ability: int
    score: 2
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
    value: "13"
entries:
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage."
  - category: bonus
    name: Rampage (1/Day)
    text: Immediately after dealing damage to a creature that was already Bloodied, the hyena can move up to half its Speed, and it makes one Bite attack.

---

# Giant Hyena
*Large, Beast, Unaligned*

**AC** 12
**HP** 45 (6d10 + 12)
**Initiative** +2 (12)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 16 | 14 | 14 | 2 | 12 | 7 |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 1, PB +2, XP 200

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage.

## Bonus Actions

**Rampage (1/Day)**
Immediately after dealing damage to a creature that was already Bloodied, the hyena can move up to half its Speed, and it makes one Bite attack.
