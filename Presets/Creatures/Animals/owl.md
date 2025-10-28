---
smType: creature
name: Owl
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '1'
hitDice: 1d4 - 1
speeds:
  walk:
    distance: 5 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 3
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 8
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '15'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Flyby
    entryType: special
    text: The owl doesn't provoke Opportunity Attacks when it flies out of an enemy's reach.
  - category: action
    name: Talons
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 1 Slashing damage.'
    attack:
      type: melee
      bonus: 3
      damage: []
      reach: 5 ft.
---

# Owl
*Small, Beast, Unaligned*

**AC** 11
**HP** 1 (1d4 - 1)
**Initiative** +1 (11)
**Speed** 5 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 15
CR 0, PB +2, XP 0

## Traits

**Flyby**
The owl doesn't provoke Opportunity Attacks when it flies out of an enemy's reach.

## Actions

**Talons**
*Melee Attack Roll:* +3, reach 5 ft. 1 Slashing damage.
