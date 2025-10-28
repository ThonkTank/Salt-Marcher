---
smType: creature
name: Swarm of Crawling Claws
size: Medium
type: Undead
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '12'
initiative: +2 (12)
hp: '49'
hitDice: 11d8
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 4
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '30'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Understands Common but can't speak
damageResistancesList:
  - value: Bludgeoning
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Necrotic
  - value: Poison; Charmed
  - value: Exhaustion
  - value: Incapacitated
conditionImmunitiesList:
  - value: Frightened
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
  - value: Prone
  - value: Restrained
  - value: Stunned
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Swarm
    entryType: special
    text: The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny creature. The swarm can't regain Hit Points or gain Temporary Hit Points.
  - category: action
    name: Swarm of Grasping Hands
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 20 (4d8 + 2) Necrotic damage, or 11 (2d8 + 2) Necrotic damage if the swarm is Bloodied. If the target is a Medium or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 4d8
          bonus: 2
          type: Necrotic
          average: 20
        - dice: 2d8
          bonus: 2
          type: Necrotic
          average: 11
      reach: 5 ft.
---

# Swarm of Crawling Claws
*Medium, Undead, Neutral Evil*

**AC** 12
**HP** 49 (11d8)
**Initiative** +2 (12)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft.; Passive Perception 10
**Languages** Understands Common but can't speak
CR 3, PB +2, XP 700

## Traits

**Swarm**
The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny creature. The swarm can't regain Hit Points or gain Temporary Hit Points.

## Actions

**Swarm of Grasping Hands**
*Melee Attack Roll:* +4, reach 5 ft. 20 (4d8 + 2) Necrotic damage, or 11 (2d8 + 2) Necrotic damage if the swarm is Bloodied. If the target is a Medium or smaller creature, it has the Prone condition.
