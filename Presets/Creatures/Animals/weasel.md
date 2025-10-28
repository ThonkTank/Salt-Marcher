---
smType: creature
name: Weasel
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '1'
hitDice: 1d4 - 1
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 3
    saveProf: false
  - key: dex
    score: 16
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
    score: 3
    saveProf: false
pb: '+2'
skills:
  - skill: Acrobatics
    value: '5'
  - skill: Perception
    value: '3'
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '13'
cr: '0'
xp: '0'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 1 Piercing damage.'
    attack:
      type: melee
      bonus: 5
      damage: []
      reach: 5 ft.
---

# Weasel
*Small, Beast, Unaligned*

**AC** 13
**HP** 1 (1d4 - 1)
**Initiative** +3 (13)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 0, PB +2, XP 0

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 1 Piercing damage.
