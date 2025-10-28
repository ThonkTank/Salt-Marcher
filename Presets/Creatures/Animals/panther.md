---
smType: creature
name: Panther
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '13'
hitDice: 3d8
speeds:
  walk:
    distance: 50 ft.
  climb:
    distance: 40 ft.
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '6'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Slashing
          average: 6
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Nimble Escape
    entryType: special
    text: The panther takes the Disengage or Hide action.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Panther
*Medium, Beast, Unaligned*

**AC** 13
**HP** 13 (3d8)
**Initiative** +3 (13)
**Speed** 50 ft., climb 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
CR 1/4, PB +2, XP 50

## Actions

**Rend**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Slashing damage.

## Bonus Actions

**Nimble Escape**
The panther takes the Disengage or Hide action.
