---
smType: creature
name: Giant Rat
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '7'
hitDice: 2d6
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 7
    saveProf: false
  - key: dex
    score: 16
    saveProf: true
    saveMod: 5
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 4
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '12'
cr: 1/8
xp: '25'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The rat has Advantage on an attack roll against a creature if at least one of the rat's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 feet. 5 (1d4 + 3) Piercing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d4
          bonus: 3
          type: Piercing
          average: 5
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Rat
*Small, Beast, Unaligned*

**AC** 13
**HP** 7 (2d6)
**Initiative** +3 (13)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 12
CR 1/8, PB +2, XP 25

## Traits

**Pack Tactics**
The rat has Advantage on an attack roll against a creature if at least one of the rat's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 feet. 5 (1d4 + 3) Piercing damage.
