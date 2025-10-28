---
smType: creature
name: Swarm of Venomous Snakes
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '14'
initiative: +4 (14)
hp: '36'
hitDice: 8d8
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 8
    saveProf: false
  - key: dex
    score: 18
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '10'
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
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Swarm
    entryType: special
    text: The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny snake. The swarm can't regain Hit Points or gain Temporary Hit Points.
  - category: action
    name: Bites
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 8 (1d8 + 4) Piercing damage—or 6 (1d4 + 4) Piercing damage if the swarm is Bloodied—plus 10 (3d6) Poison damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d8
          bonus: 4
          type: Piercing
          average: 8
        - dice: 1d4
          bonus: 4
          type: Piercing
          average: 6
        - dice: 3d6
          bonus: 0
          type: Poison
          average: 10
      reach: 5 ft.
---

# Swarm of Venomous Snakes
*Medium, Beast, Unaligned*

**AC** 14
**HP** 36 (8d8)
**Initiative** +4 (14)
**Speed** 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft.; Passive Perception 10
CR 2, PB +2, XP 450

## Traits

**Swarm**
The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny snake. The swarm can't regain Hit Points or gain Temporary Hit Points.

## Actions

**Bites**
*Melee Attack Roll:* +6, reach 5 ft. 8 (1d8 + 4) Piercing damage—or 6 (1d4 + 4) Piercing damage if the swarm is Bloodied—plus 10 (3d6) Poison damage.
