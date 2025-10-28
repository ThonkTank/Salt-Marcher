---
smType: creature
name: Riding Horse
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '13'
hitDice: 2d10 + 2
speeds:
  walk:
    distance: 60 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 12
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
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Bludgeoning
          average: 7
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Riding Horse
*Large, Beast, Unaligned*

**AC** 11
**HP** 13 (2d10 + 2)
**Initiative** +1 (11)
**Speed** 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/4, PB +2, XP 50

## Actions

**Hooves**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Bludgeoning damage.
