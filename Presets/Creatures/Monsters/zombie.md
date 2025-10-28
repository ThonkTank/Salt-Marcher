---
smType: creature
name: Zombie
size: Medium
type: Undead
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '8'
initiative: '-2 (8)'
hp: '15'
hitDice: 2d8 + 6
speeds:
  walk:
    distance: 20 ft.
abilities:
  - key: str
    score: 13
    saveProf: false
  - key: dex
    score: 6
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 6
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '8'
languagesList:
  - value: Understands Common plus one other language but can't speak
damageImmunitiesList:
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Poisoned
cr: 1/4
xp: '50'
entries:
  - category: trait
    name: Undead Fortitude
    entryType: special
    text: If damage reduces the zombie to 0 Hit Points, it makes a Constitution saving throw (DC 5 plus the damage taken) unless the damage is Radiant or from a Critical Hit. On a successful save, the zombie drops to 1 Hit Point instead.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Slam
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 5 (1d8 + 1) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 1d8
          bonus: 1
          type: Bludgeoning
          average: 5
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Zombie
*Medium, Undead, Neutral Evil*

**AC** 8
**HP** 15 (2d8 + 6)
**Initiative** -2 (8)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 8
**Languages** Understands Common plus one other language but can't speak
CR 1/4, PB +2, XP 50

## Traits

**Undead Fortitude**
If damage reduces the zombie to 0 Hit Points, it makes a Constitution saving throw (DC 5 plus the damage taken) unless the damage is Radiant or from a Critical Hit. On a successful save, the zombie drops to 1 Hit Point instead.

## Actions

**Slam**
*Melee Attack Roll:* +3, reach 5 ft. 5 (1d8 + 1) Bludgeoning damage.
