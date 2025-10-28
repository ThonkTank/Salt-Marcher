---
smType: creature
name: Owlbear
size: Large
type: Monstrosity
alignmentOverride: Unaligned
ac: '13'
initiative: +1 (11)
hp: '59'
hitDice: 7d10 + 21
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 40 ft.
abilities:
  - key: str
    score: 20
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 3
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
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
cr: '3'
xp: '700'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The owlbear makes two Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 14 (2d8 + 5) Slashing damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d8
          bonus: 5
          type: Slashing
          average: 14
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Owlbear
*Large, Monstrosity, Unaligned*

**AC** 13
**HP** 59 (7d10 + 21)
**Initiative** +1 (11)
**Speed** 40 ft., climb 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
CR 3, PB +2, XP 700

## Actions

**Multiattack**
The owlbear makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +7, reach 5 ft. 14 (2d8 + 5) Slashing damage.
