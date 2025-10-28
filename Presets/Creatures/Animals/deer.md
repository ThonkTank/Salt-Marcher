---
smType: creature
name: Deer
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '4'
hitDice: 1d8
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 11
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
    score: 14
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Agile
    entryType: special
    text: The deer doesn't provoke an Opportunity Attack when it moves out of an enemy's reach.
  - category: action
    name: Ram
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 2
      damage:
        - dice: 1d4
          bonus: 0
          type: Bludgeoning
          average: 2
      reach: 5 ft.
---

# Deer
*Medium, Beast, Unaligned*

**AC** 13
**HP** 4 (1d8)
**Initiative** +3 (13)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
CR 0, PB +2, XP 0

## Traits

**Agile**
The deer doesn't provoke an Opportunity Attack when it moves out of an enemy's reach.

## Actions

**Ram**
*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Bludgeoning damage.
