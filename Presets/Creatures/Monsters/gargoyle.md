---
smType: creature
name: Gargoyle
size: Medium
type: Elemental
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '15'
initiative: +2 (12)
hp: '67'
hitDice: 9d8 + 27
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Primordial (Terran)
damageImmunitiesList:
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Petrified
  - value: Poisoned
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Flyby
    entryType: special
    text: The gargoyle doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The gargoyle makes two Claw attacks.
    multiattack:
      attacks:
        - name: Claw
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 7 (2d4 + 2) Slashing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d4
          bonus: 2
          type: Slashing
          average: 7
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Gargoyle
*Medium, Elemental, Chaotic Evil*

**AC** 15
**HP** 67 (9d8 + 27)
**Initiative** +2 (12)
**Speed** 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Primordial (Terran)
CR 2, PB +2, XP 450

## Traits

**Flyby**
The gargoyle doesn't provoke an Opportunity Attack when it flies out of an enemy's reach.

## Actions

**Multiattack**
The gargoyle makes two Claw attacks.

**Claw**
*Melee Attack Roll:* +4, reach 5 ft. 7 (2d4 + 2) Slashing damage.
