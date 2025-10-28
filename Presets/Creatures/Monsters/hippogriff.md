---
smType: creature
name: Hippogriff
size: Large
type: Monstrosity
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '26'
hitDice: 4d10 + 4
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
passivesList:
  - skill: Perception
    value: '15'
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Flyby
    entryType: special
    text: The hippogriff doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The hippogriff makes two Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 2
      substitutions: []
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Slashing
          average: 7
      reach: 5 ft.
---

# Hippogriff
*Large, Monstrosity, Unaligned*

**AC** 11
**HP** 26 (4d10 + 4)
**Initiative** +1 (11)
**Speed** 40 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1, PB +2, XP 200

## Traits

**Flyby**
The hippogriff doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.

## Actions

**Multiattack**
The hippogriff makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Slashing damage.
