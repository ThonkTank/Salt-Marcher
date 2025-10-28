---
smType: creature
name: Giant Weasel
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '9'
hitDice: 2d8
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 11
    saveProf: false
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 4
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 5
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
cr: 1/8
xp: '25'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Piercing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d4
          bonus: 3
          type: Piercing
          average: 5
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Weasel
*Medium, Beast, Unaligned*

**AC** 13
**HP** 9 (2d8)
**Initiative** +3 (13)
**Speed** 40 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 1/8, PB +2, XP 25

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Piercing damage.
