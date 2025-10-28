---
smType: creature
name: Flying Snake
size: Small
type: Monstrosity
alignmentOverride: Unaligned
ac: '14'
initiative: +2 (12)
hp: '5'
hitDice: 2d4
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 60 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 4
    saveProf: false
  - key: dex
    score: 15
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
    score: 5
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '10'
passivesList:
  - skill: Perception
    value: '11'
cr: 1/8
xp: '25'
entries:
  - category: trait
    name: Flyby
    entryType: special
    text: The snake doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 1 Piercing damage plus 5 (2d4) Poison damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d4
          bonus: 0
          type: Poison
          average: 5
      reach: 5 ft.
---

# Flying Snake
*Small, Monstrosity, Unaligned*

**AC** 14
**HP** 5 (2d4)
**Initiative** +2 (12)
**Speed** 30 ft., swim 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft.; Passive Perception 11
CR 1/8, PB +2, XP 25

## Traits

**Flyby**
The snake doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 1 Piercing damage plus 5 (2d4) Poison damage.
