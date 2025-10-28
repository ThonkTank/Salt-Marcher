---
smType: creature
name: Hobgoblin Warrior
size: Medium
type: Fey
typeTags:
  - value: Goblinoid
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '18'
initiative: +3 (13)
hp: '11'
hitDice: 2d8 + 2
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 13
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 9
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common
  - value: Goblin
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The hobgoblin has Advantage on an attack roll against a creature if at least one of the hobgoblin's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Longsword
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 12 (2d10 + 1) Slashing damage.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 2d10
          bonus: 1
          type: Slashing
          average: 12
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Longbow
    entryType: attack
    text: '*Ranged Attack Roll:* +3, range 150/600 ft. 5 (1d8 + 1) Piercing damage plus 7 (3d4) Poison damage.'
    attack:
      type: ranged
      bonus: 3
      damage:
        - dice: 1d8
          bonus: 1
          type: Piercing
          average: 5
        - dice: 3d4
          bonus: 0
          type: Poison
          average: 7
      range: 150/600 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Hobgoblin Warrior
*Medium, Fey, Lawful Evil*

**AC** 18
**HP** 11 (2d8 + 2)
**Initiative** +3 (13)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Common, Goblin
CR 1/2, PB +2, XP 100

## Traits

**Pack Tactics**
The hobgoblin has Advantage on an attack roll against a creature if at least one of the hobgoblin's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Longsword**
*Melee Attack Roll:* +3, reach 5 ft. 12 (2d10 + 1) Slashing damage.

**Longbow**
*Ranged Attack Roll:* +3, range 150/600 ft. 5 (1d8 + 1) Piercing damage plus 7 (3d4) Poison damage.
