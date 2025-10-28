---
smType: creature
name: Hyena
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '5'
hitDice: 1d8 + 1
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 11
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '13'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The hyena has Advantage on an attack roll against a creature if at least one of the hyena's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 3 (1d6) Piercing damage.'
    attack:
      type: melee
      bonus: 2
      damage:
        - dice: 1d6
          bonus: 0
          type: Piercing
          average: 3
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Hyena
*Medium, Beast, Unaligned*

**AC** 11
**HP** 5 (1d8 + 1)
**Initiative** +1 (11)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 0, PB +2, XP 0

## Traits

**Pack Tactics**
The hyena has Advantage on an attack roll against a creature if at least one of the hyena's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Bite**
*Melee Attack Roll:* +2, reach 5 ft. 3 (1d6) Piercing damage.
