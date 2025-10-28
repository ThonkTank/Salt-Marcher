---
smType: creature
name: Swarm of Insects
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '19'
hitDice: 3d8 + 6
speeds:
  walk:
    distance: 20 ft.
abilities:
  - key: str
    score: 3
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 7
    saveProf: false
  - key: cha
    score: 1
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '30'
passivesList:
  - skill: Perception
    value: '8'
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
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Spider Climb
    entryType: special
    text: If the swarm has a Climb Speed, the swarm can climb difficult surfaces, including along ceilings, without needing to make an ability check.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Swarm
    entryType: special
    text: The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny insect. The swarm can't regain Hit Points or gain Temporary Hit Points.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bites
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 6 (2d4 + 1) Poison damage, or 3 (1d4 + 1) Poison damage if the swarm is Bloodied.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 2d4
          bonus: 1
          type: Poison
          average: 6
        - dice: 1d4
          bonus: 1
          type: Poison
          average: 3
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Swarm of Insects
*Medium, Beast, Unaligned*

**AC** 11
**HP** 19 (3d8 + 6)
**Initiative** +1 (11)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft.; Passive Perception 8
CR 1/2, PB +2, XP 100

## Traits

**Spider Climb**
If the swarm has a Climb Speed, the swarm can climb difficult surfaces, including along ceilings, without needing to make an ability check.

**Swarm**
The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny insect. The swarm can't regain Hit Points or gain Temporary Hit Points.

## Actions

**Bites**
*Melee Attack Roll:* +3, reach 5 ft. 6 (2d4 + 1) Poison damage, or 3 (1d4 + 1) Poison damage if the swarm is Bloodied.
