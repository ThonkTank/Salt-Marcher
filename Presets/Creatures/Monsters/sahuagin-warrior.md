---
smType: creature
name: Sahuagin Warrior
size: Medium
type: Fiend
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '12'
initiative: +0 (10)
hp: '22'
hitDice: 4d8 + 4
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 13
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 9
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Sahuagin
damageResistancesList:
  - value: Acid
  - value: Cold
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Blood Frenzy
    entryType: special
    text: The sahuagin has Advantage on attack rolls against any creature that doesn't have all its Hit Points.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Limited Amphibiousness
    entryType: special
    text: The sahuagin can breathe air and water, but it must be submerged at least once every 4 hours to avoid suffocating outside water.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Shark Telepathy
    entryType: special
    text: The sahuagin can magically control sharks within 120 feet of itself, using a special telepathy.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The sahuagin makes two Claw attacks.
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
    text: '*Melee Attack Roll:* +3, reach 5 ft. 4 (1d6 + 1) Slashing damage.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 1d6
          bonus: 1
          type: Slashing
          average: 4
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Aquatic Charge
    entryType: special
    text: The sahuagin swims up to its Swim Speed straight toward an enemy it can see.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Sahuagin Warrior
*Medium, Fiend, Lawful Evil*

**AC** 12
**HP** 22 (4d8 + 4)
**Initiative** +0 (10)
**Speed** 30 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 15
**Languages** Sahuagin
CR 1/2, PB +2, XP 100

## Traits

**Blood Frenzy**
The sahuagin has Advantage on attack rolls against any creature that doesn't have all its Hit Points.

**Limited Amphibiousness**
The sahuagin can breathe air and water, but it must be submerged at least once every 4 hours to avoid suffocating outside water.

**Shark Telepathy**
The sahuagin can magically control sharks within 120 feet of itself, using a special telepathy.

## Actions

**Multiattack**
The sahuagin makes two Claw attacks.

**Claw**
*Melee Attack Roll:* +3, reach 5 ft. 4 (1d6 + 1) Slashing damage.

## Bonus Actions

**Aquatic Charge**
The sahuagin swims up to its Swim Speed straight toward an enemy it can see.
