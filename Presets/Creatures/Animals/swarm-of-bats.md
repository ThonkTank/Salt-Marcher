---
smType: creature
name: Swarm of Bats
size: Large
type: Beast
alignmentOverride: Unaligned
ac: "12"
initiative: +2 (12)
hp: "11"
hitDice: 2d10
speeds:
  - type: walk
    value: "5"
  - type: fly
    value: "30"
abilities:
  - ability: str
    score: 5
  - ability: dex
    score: 15
  - ability: con
    score: 10
  - ability: int
    score: 2
  - ability: wis
    score: 12
  - ability: cha
    score: 4
pb: "+2"
cr: 1/4
xp: "50"
sensesList:
  - type: blindsight
    range: "60"
passivesList:
  - skill: Perception
    value: "11"
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
    text: The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny bat. The swarm can't regain Hit Points or gain Temporary Hit Points.
  - category: action
    name: Bites
    text: "*Melee Attack Roll:* +4, reach 5 ft. 5 (2d4) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied."

---

# Swarm of Bats
*Large, Beast, Unaligned*

**AC** 12
**HP** 11 (2d10)
**Initiative** +2 (12)
**Speed** 5 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 5 | 15 | 10 | 2 | 12 | 4 |

**Senses** blindsight 60 ft.; Passive Perception 11
CR 1/4, PB +2, XP 50

## Traits

**Swarm**
The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny bat. The swarm can't regain Hit Points or gain Temporary Hit Points.

## Actions

**Bites**
*Melee Attack Roll:* +4, reach 5 ft. 5 (2d4) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied.
