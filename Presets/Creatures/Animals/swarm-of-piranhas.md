---
smType: creature
name: Swarm of Piranhas
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '28'
hitDice: 8d8 - 8
speeds:
  walk:
    distance: 5 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 13
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 9
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 7
    saveProf: false
  - key: cha
    score: 2
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
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
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Swarm
    entryType: special
    text: The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny piranha. The swarm can't regain Hit Points or gain Temporary Hit Points.
  - category: trait
    name: Water Breathing
    entryType: special
    text: The swarm can breathe only underwater.
  - category: action
    name: Bites
    entryType: attack
    text: '*Melee Attack Roll:* +5 (with Advantage if the target doesn''t have all its Hit Points), reach 5 ft. 8 (2d4 + 3) Piercing damage, or 5 (1d4 + 3) Piercing damage if the swarm is Bloodied.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d4
          bonus: 3
          type: Piercing
          average: 8
        - dice: 1d4
          bonus: 3
          type: Piercing
          average: 5
      reach: 5 ft.
---

# Swarm of Piranhas
*Medium, Beast, Unaligned*

**AC** 13
**HP** 28 (8d8 - 8)
**Initiative** +3 (13)
**Speed** 5 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 8
CR 1, PB +2, XP 200

## Traits

**Swarm**
The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny piranha. The swarm can't regain Hit Points or gain Temporary Hit Points.

**Water Breathing**
The swarm can breathe only underwater.

## Actions

**Bites**
*Melee Attack Roll:* +5 (with Advantage if the target doesn't have all its Hit Points), reach 5 ft. 8 (2d4 + 3) Piercing damage, or 5 (1d4 + 3) Piercing damage if the swarm is Bloodied.
