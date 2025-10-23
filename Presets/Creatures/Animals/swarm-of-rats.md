---
smType: creature
name: Swarm of Rats
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: "10"
initiative: +0 (10)
hp: "14"
hitDice: 4d8 - 4
speeds:
  - type: walk
    value: "30"
  - type: climb
    value: "30"
abilities:
  - ability: str
    score: 9
  - ability: dex
    score: 11
  - ability: con
    score: 9
  - ability: int
    score: 2
  - ability: wis
    score: 10
  - ability: cha
    score: 3
pb: "+2"
cr: 1/4
xp: "50"
sensesList:
  - type: darkvision
    range: "30"
passivesList:
  - skill: Perception
    value: "10"
damageResistancesList:
  - value: Bludgeoning
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Charmed
  - value: Frightened
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Prone
  - value: Restrained
  - value: Stunned
entries:
  - category: trait
    name: Swarm
    text: The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny rat. The swarm can't regain Hit Points or gain Temporary Hit Points.
  - category: action
    name: Bites
    text: "*Melee Attack Roll:* +2, reach 5 ft. 5 (2d4) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied."

---

# Swarm of Rats
*Medium, Beast, Unaligned*

**AC** 10
**HP** 14 (4d8 - 4)
**Initiative** +0 (10)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 9 | 11 | 9 | 2 | 10 | 3 |

**Senses** darkvision 30 ft.; Passive Perception 10
CR 1/4, PB +2, XP 50

## Traits

**Swarm**
The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny rat. The swarm can't regain Hit Points or gain Temporary Hit Points.

## Actions

**Bites**
*Melee Attack Roll:* +2, reach 5 ft. 5 (2d4) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied.
