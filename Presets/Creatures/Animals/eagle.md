---
smType: creature
name: Eagle
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '4'
hitDice: 1d6 + 1
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 6
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '6'
passivesList:
  - skill: Perception
    value: '16'
cr: '0'
xp: '0'
entries:
  - category: action
    name: Talons
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 feet. 4 (1d4 + 2) Slashing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d4
          bonus: 2
          type: Slashing
          average: 4
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Eagle
*Small, Beast, Unaligned*

**AC** 12
**HP** 4 (1d6 + 1)
**Initiative** +2 (12)
**Speed** 10 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 0, PB +2, XP 0

## Actions

**Talons**
*Melee Attack Roll:* +4, reach 5 feet. 4 (1d4 + 2) Slashing damage.
