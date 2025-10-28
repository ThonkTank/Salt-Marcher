---
smType: creature
name: Hobgoblin Captain
size: Medium
type: Fey
typeTags:
  - value: Goblinoid
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '17'
initiative: +4 (14)
hp: '58'
hitDice: 9d8 + 18
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 13
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
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Aura of Authority
    entryType: special
    text: While in a 10-foot Emanation originating from the hobgoblin, the hobgoblin and its allies have Advantage on attack rolls and saving throws, provided the hobgoblin doesn't have the Incapacitated condition.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: special
    text: The hobgoblin makes two attacks, using Greatsword or Longbow in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Greatsword
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 9 (2d6 + 2) Slashing damage plus 3 (1d6) Poison damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d6
          bonus: 2
          type: Slashing
          average: 9
        - dice: 1d6
          bonus: 0
          type: Poison
          average: 3
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Longbow
    entryType: attack
    text: '*Ranged Attack Roll:* +4, range 150/600 ft. 6 (1d8 + 2) Piercing damage plus 5 (2d4) Poison damage.'
    attack:
      type: ranged
      bonus: 4
      damage:
        - dice: 1d8
          bonus: 2
          type: Piercing
          average: 6
        - dice: 2d4
          bonus: 0
          type: Poison
          average: 5
      range: 150/600 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Hobgoblin Captain
*Medium, Fey, Lawful Evil*

**AC** 17
**HP** 58 (9d8 + 18)
**Initiative** +4 (14)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Common, Goblin
CR 3, PB +2, XP 700

## Traits

**Aura of Authority**
While in a 10-foot Emanation originating from the hobgoblin, the hobgoblin and its allies have Advantage on attack rolls and saving throws, provided the hobgoblin doesn't have the Incapacitated condition.

## Actions

**Multiattack**
The hobgoblin makes two attacks, using Greatsword or Longbow in any combination.

**Greatsword**
*Melee Attack Roll:* +4, reach 5 ft. 9 (2d6 + 2) Slashing damage plus 3 (1d6) Poison damage.

**Longbow**
*Ranged Attack Roll:* +4, range 150/600 ft. 6 (1d8 + 2) Piercing damage plus 5 (2d4) Poison damage.
