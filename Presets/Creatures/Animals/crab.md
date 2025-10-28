---
smType: creature
name: Crab
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +0 (10)
hp: '3'
hitDice: 1d4 + 1
speeds:
  walk:
    distance: 20 ft.
  swim:
    distance: 20 ft.
abilities:
  - key: str
    score: 6
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 2
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '2'
sensesList:
  - type: blindsight
    range: '30'
passivesList:
  - skill: Perception
    value: '9'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The crab can breathe air and water.
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 1 Bludgeoning damage.'
    attack:
      type: melee
      bonus: 2
      damage: []
      reach: 5 ft.
---

# Crab
*Small, Beast, Unaligned*

**AC** 11
**HP** 3 (1d4 + 1)
**Initiative** +0 (10)
**Speed** 20 ft., swim 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft.; Passive Perception 9
CR 0, PB +2, XP 0

## Traits

**Amphibious**
The crab can breathe air and water.

## Actions

**Claw**
*Melee Attack Roll:* +2, reach 5 ft. 1 Bludgeoning damage.
