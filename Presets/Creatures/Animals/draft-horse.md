---
smType: creature
name: Draft Horse
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '10'
initiative: +0 (10)
hp: '15'
hitDice: 2d10 + 4
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '10'
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Hooves
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 6 (1d4 + 4) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d4
          bonus: 4
          type: Bludgeoning
          average: 6
      reach: 5 ft.
---

# Draft Horse
*Large, Beast, Unaligned*

**AC** 10
**HP** 15 (2d10 + 4)
**Initiative** +0 (10)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/4, PB +2, XP 50

## Actions

**Hooves**
*Melee Attack Roll:* +6, reach 5 ft. 6 (1d4 + 4) Bludgeoning damage.
