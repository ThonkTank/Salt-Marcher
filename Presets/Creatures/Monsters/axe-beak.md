---
smType: creature
name: Axe Beak
size: Large
type: Monstrosity
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '19'
hitDice: 3d10 + 3
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '10'
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Beak
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Slashing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Slashing
          average: 5
      reach: 5 ft.
---

# Axe Beak
*Large, Monstrosity, Unaligned*

**AC** 11
**HP** 19 (3d10 + 3)
**Initiative** +1 (11)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/4, PB +2, XP 50

## Actions

**Beak**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Slashing damage.
