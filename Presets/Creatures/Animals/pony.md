---
smType: creature
name: Pony
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '10'
initiative: +0 (10)
hp: '11'
hitDice: 2d8 + 2
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 15
    saveProf: true
    saveMod: 4
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 13
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
cr: 1/8
xp: '25'
entries:
  - category: action
    name: Hooves
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d4
          bonus: 2
          type: Bludgeoning
          average: 4
      reach: 5 ft.
---

# Pony
*Medium, Beast, Unaligned*

**AC** 10
**HP** 11 (2d8 + 2)
**Initiative** +0 (10)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/8, PB +2, XP 25

## Actions

**Hooves**
*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Bludgeoning damage.
