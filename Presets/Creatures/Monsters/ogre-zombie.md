---
smType: creature
name: Ogre Zombie
size: Large
type: Undead
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '8'
initiative: '-2 (8)'
hp: '85'
hitDice: 9d10 + 36
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 6
    saveProf: false
  - key: con
    score: 18
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
  - value: Understands Common and Giant but can't speak
damageImmunitiesList:
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Poisoned
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Undead Fortitude
    entryType: special
    text: If damage reduces the zombie to 0 Hit Points, it makes a Constitution saving throw (DC 5 plus the damage taken) unless the damage is Radiant or from a Critical Hit. On a successful save, the zombie drops to 1 Hit Point instead.
  - category: action
    name: Slam
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 13 (2d8 + 4) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d8
          bonus: 4
          type: Bludgeoning
          average: 13
      reach: 5 ft.
---

# Ogre Zombie
*Large, Undead, Neutral Evil*

**AC** 8
**HP** 85 (9d10 + 36)
**Initiative** -2 (8)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 8
**Languages** Understands Common and Giant but can't speak
CR 2, PB +2, XP 450

## Traits

**Undead Fortitude**
If damage reduces the zombie to 0 Hit Points, it makes a Constitution saving throw (DC 5 plus the damage taken) unless the damage is Radiant or from a Critical Hit. On a successful save, the zombie drops to 1 Hit Point instead.

## Actions

**Slam**
*Melee Attack Roll:* +6, reach 5 ft. 13 (2d8 + 4) Bludgeoning damage.
