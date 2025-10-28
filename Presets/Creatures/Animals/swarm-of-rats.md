---
smType: creature
name: Swarm of Rats
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '10'
initiative: +0 (10)
hp: '14'
hitDice: 4d8 - 4
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 9
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 9
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '30'
passivesList:
  - skill: Perception
    value: '10'
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
    text: The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny rat. The swarm can't regain Hit Points or gain Temporary Hit Points.
  - category: action
    name: Bites
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 5 (2d4) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied.'
    attack:
      type: melee
      bonus: 2
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

# Swarm of Rats
*Medium, Beast, Unaligned*

**AC** 10
**HP** 14 (4d8 - 4)
**Initiative** +0 (10)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 30 ft.; Passive Perception 10
CR 1/4, PB +2, XP 50

## Traits

**Swarm**
The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny rat. The swarm can't regain Hit Points or gain Temporary Hit Points.

## Actions

**Bites**
*Melee Attack Roll:* +2, reach 5 ft. 5 (2d4) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied.
