---
smType: creature
name: Piranha
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '1'
hitDice: 1d4 - 1
speeds:
  walk:
    distance: 5 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 2
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 9
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 7
    saveProf: false
  - key: cha
    score: 2
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '8'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Water Breathing
    entryType: special
    text: The piranha can breathe only underwater.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5 (with Advantage if the target doesn''t have all its Hit Points), reach 5 ft. 1 Piercing damage.'
    attack:
      type: melee
      bonus: 5
      damage: []
      reach: 5 ft.
---

# Piranha
*Small, Beast, Unaligned*

**AC** 13
**HP** 1 (1d4 - 1)
**Initiative** +3 (13)
**Speed** 5 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 8
CR 0, PB +2, XP 0

## Traits

**Water Breathing**
The piranha can breathe only underwater.

## Actions

**Bite**
*Melee Attack Roll:* +5 (with Advantage if the target doesn't have all its Hit Points), reach 5 ft. 1 Piercing damage.
