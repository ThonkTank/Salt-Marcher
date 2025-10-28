---
smType: creature
name: Giant Wasp
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +2 (12)
hp: '22'
hitDice: 5d8
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 50 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '10'
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Flyby
    entryType: special
    text: The wasp doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.
  - category: action
    name: Sting
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 5 (2d4) Poison damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Piercing
          average: 5
        - dice: 2d4
          bonus: 0
          type: Poison
          average: 5
      reach: 5 ft.
---

# Giant Wasp
*Medium, Beast, Unaligned*

**AC** 13
**HP** 22 (5d8)
**Initiative** +2 (12)
**Speed** 10 ft., fly 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/2, PB +2, XP 100

## Traits

**Flyby**
The wasp doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.

## Actions

**Sting**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 5 (2d4) Poison damage.
