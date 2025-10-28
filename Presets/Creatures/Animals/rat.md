---
smType: creature
name: Rat
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '10'
initiative: +0 (10)
hp: '1'
hitDice: 1d4 - 1
speeds:
  walk:
    distance: 20 ft.
  climb:
    distance: 20 ft.
abilities:
  - key: str
    score: 2
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 9
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 4
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '2'
sensesList:
  - type: darkvision
    range: '30'
passivesList:
  - skill: Perception
    value: '12'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Agile
    entryType: special
    text: The rat doesn't provoke Opportunity Attacks when it moves out of an enemy's reach.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 1 Piercing damage.'
    attack:
      type: melee
      bonus: 2
      damage: []
      reach: 5 ft.
---

# Rat
*Small, Beast, Unaligned*

**AC** 10
**HP** 1 (1d4 - 1)
**Initiative** +0 (10)
**Speed** 20 ft., climb 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 30 ft.; Passive Perception 12
CR 0, PB +2, XP 0

## Traits

**Agile**
The rat doesn't provoke Opportunity Attacks when it moves out of an enemy's reach.

## Actions

**Bite**
*Melee Attack Roll:* +2, reach 5 ft. 1 Piercing damage.
