---
smType: creature
name: Gnoll Warrior
size: Medium
type: Fiend
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: "15"
initiative: +1 (11)
hp: "27"
hitDice: 6d8
speeds:
  - type: walk
    value: "30"
abilities:
  - ability: str
    score: 14
  - ability: dex
    score: 12
  - ability: con
    score: 11
  - ability: int
    score: 6
  - ability: wis
    score: 10
  - ability: cha
    score: 7
pb: "+2"
cr: 1/2
xp: "100"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Gnoll
passivesList:
  - skill: Perception
    value: "10"
entries:
  - category: action
    name: Rend
    text: "*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage."
  - category: action
    name: Bone Bow
    text: "*Ranged Attack Roll:* +3, range 150/600 ft. 6 (1d10 + 1) Piercing damage."
  - category: bonus
    name: Rampage (1/Day)
    text: Immediately after dealing damage to a creature that is already Bloodied, the gnoll moves up to half its Speed, and it makes one Rend attack.

---

# Gnoll Warrior
*Medium, Fiend, Chaotic Evil*

**AC** 15
**HP** 27 (6d8)
**Initiative** +1 (11)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 14 | 12 | 11 | 6 | 10 | 7 |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Gnoll
CR 1/2, PB +2, XP 100

## Actions

**Rend**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage.

**Bone Bow**
*Ranged Attack Roll:* +3, range 150/600 ft. 6 (1d10 + 1) Piercing damage.

## Bonus Actions

**Rampage (1/Day)**
Immediately after dealing damage to a creature that is already Bloodied, the gnoll moves up to half its Speed, and it makes one Rend attack.
