---
smType: creature
name: Giant Bat
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '22'
hitDice: 4d10
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '120'
passivesList:
  - skill: Perception
    value: '11'
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Piercing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Piercing
          average: 6
      reach: 5 ft.
---

# Giant Bat
*Large, Beast, Unaligned*

**AC** 13
**HP** 22 (4d10)
**Initiative** +3 (13)
**Speed** 10 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 120 ft.; Passive Perception 11
CR 1/4, PB +2, XP 50

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Piercing damage.
