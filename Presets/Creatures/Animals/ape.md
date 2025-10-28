---
smType: creature
name: Ape
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '19'
hitDice: 3d8 + 6
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
skills:
  - skill: Athletics
    value: '5'
  - skill: Perception
    value: '3'
passivesList:
  - skill: Perception
    value: '13'
cr: 1/2
xp: '100'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The ape makes two Fist attacks.
    multiattack:
      attacks:
        - name: Fist
          count: 2
        - name: Fist
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Fist
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d4
          bonus: 3
          type: Bludgeoning
          average: 5
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Rock
    entryType: attack
    text: '*Ranged Attack Roll:* +5, range 25/50 ft. 10 (2d6 + 3) Bludgeoning damage.'
    attack:
      type: ranged
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Bludgeoning
          average: 10
      range: 25/50 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Ape
*Medium, Beast, Unaligned*

**AC** 12
**HP** 19 (3d8 + 6)
**Initiative** +2 (12)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/2, PB +2, XP 100

## Actions

**Multiattack**
The ape makes two Fist attacks.

**Fist**
*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Bludgeoning damage.

**Rock (Recharge 6)**
*Ranged Attack Roll:* +5, range 25/50 ft. 10 (2d6 + 3) Bludgeoning damage.
