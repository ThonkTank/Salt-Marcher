---
smType: creature
name: Swarm of Ravens
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: "12"
initiative: +2 (12)
hp: "11"
hitDice: 2d8 + 2
speeds:
  - type: walk
    value: "10"
  - type: fly
    value: "50"
abilities:
  - ability: str
    score: 6
  - ability: dex
    score: 14
  - ability: con
    score: 12
  - ability: int
    score: 5
  - ability: wis
    score: 12
  - ability: cha
    score: 6
pb: "+2"
cr: 1/4
xp: "50"
passivesList:
  - skill: Perception
    value: "15"
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
    text: The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny raven. The swarm can't regain Hit Points or gain Temporary Hit Points.
  - category: action
    name: Beaks
    text: "*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied."
  - category: action
    name: Cacophony
    recharge: Recharge 6
    text: "*Wisdom Saving Throw*: DC 10, one creature in the swarm's space. *Failure:*  The target has the Deafened condition until the start of the swarm's next turn. While Deafened, the target also has Disadvantage on ability checks and attack rolls."

---

# Swarm of Ravens
*Medium, Beast, Unaligned*

**AC** 12
**HP** 11 (2d8 + 2)
**Initiative** +2 (12)
**Speed** 10 ft., fly 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 6 | 14 | 12 | 5 | 12 | 6 |

CR 1/4, PB +2, XP 50

## Traits

**Swarm**
The swarm can occupy another creature's space and vice versa, and the swarm can move through any opening large enough for a Tiny raven. The swarm can't regain Hit Points or gain Temporary Hit Points.

## Actions

**Beaks**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage, or 2 (1d4) Piercing damage if the swarm is Bloodied.

**Cacophony (Recharge 6)**
*Wisdom Saving Throw*: DC 10, one creature in the swarm's space. *Failure:*  The target has the Deafened condition until the start of the swarm's next turn. While Deafened, the target also has Disadvantage on ability checks and attack rolls.
