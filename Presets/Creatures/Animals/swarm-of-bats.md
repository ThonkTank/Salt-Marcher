---
smType: creature
name: Swarm of Bats
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '11'
hitDice: 2d10
speeds:
  walk:
    distance: 5 ft.
  fly:
    distance: 30 ft.
abilities:
  - key: str
    score: 5
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 4
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '60'
passivesList:
  - skill: Perception
    value: '11'
damageResistancesList:
  - value: Bludgeoning
  - value: Piercing
  - value: Slashing
conditionImmunitiesList:
  - value: Charmed
  - value: Frightened
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Prone
  - value: Restrained
  - value: Stunned
cr: 1/4
xp: '50'
entries:
  - category: trait
    name: Swarm
    entryType: special
    text: The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny bat. The swarm can't regain Hit Points or gain Temporary Hit Points.
  - category: action
    name: Bites
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (2d4) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d4
          bonus: 0
          type: Piercing
          average: 5
        - dice: 1d4
          bonus: 0
          type: Piercing
          average: 2
      reach: 5 ft.
---

# Swarm of Bats
*Large, Beast, Unaligned*

**AC** 12
**HP** 11 (2d10)
**Initiative** +2 (12)
**Speed** 5 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft.; Passive Perception 11
CR 1/4, PB +2, XP 50

## Traits

**Swarm**
The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny bat. The swarm can't regain Hit Points or gain Temporary Hit Points.

## Actions

**Bites**
*Melee Attack Roll:* +4, reach 5 ft. 5 (2d4) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied.
