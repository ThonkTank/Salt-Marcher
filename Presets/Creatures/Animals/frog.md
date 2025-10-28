---
smType: creature
name: Frog
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '1'
hitDice: 1d4 - 1
speeds:
  walk:
    distance: 20 ft.
  swim:
    distance: 20 ft.
abilities:
  - key: str
    score: 1
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 8
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '1'
  - skill: Stealth
    value: '3'
sensesList:
  - type: darkvision
    range: '30'
passivesList:
  - skill: Perception
    value: '11'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The frog can breathe air and water.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Standing Leap
    entryType: special
    text: The frog's Long Jump is up to 10 feet and its High Jump is up to 5 feet with or without a running start.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 1 Piercing damage.'
    attack:
      type: melee
      bonus: 3
      damage: []
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Frog
*Small, Beast, Unaligned*

**AC** 11
**HP** 1 (1d4 - 1)
**Initiative** +1 (11)
**Speed** 20 ft., swim 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 30 ft.; Passive Perception 11
CR 0, PB +2, XP 0

## Traits

**Amphibious**
The frog can breathe air and water.

**Standing Leap**
The frog's Long Jump is up to 10 feet and its High Jump is up to 5 feet with or without a running start.

## Actions

**Bite**
*Melee Attack Roll:* +3, reach 5 ft. 1 Piercing damage.
