---
smType: creature
name: Baboon
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '3'
hitDice: 1d6
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 8
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 4
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '11'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The baboon has Advantage on an attack roll against a creature if at least one of the baboon's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +1, reach 5 ft. 1 (1d4 - 1) Piercing damage.'
    attack:
      type: melee
      bonus: 1
      damage:
        - dice: 1d4
          bonus: 0
          type: Piercing
          average: 1
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Baboon
*Small, Beast, Unaligned*

**AC** 12
**HP** 3 (1d6)
**Initiative** +2 (12)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 0, PB +2, XP 0

## Traits

**Pack Tactics**
The baboon has Advantage on an attack roll against a creature if at least one of the baboon's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Bite**
*Melee Attack Roll:* +1, reach 5 ft. 1 (1d4 - 1) Piercing damage.
