---
smType: creature
name: Animated Flying Sword
size: Small
type: Construct
alignmentOverride: Unaligned
ac: "17"
initiative: +4 (14)
hp: "14"
hitDice: 4d6
speeds:
  - type: walk
    value: "5"
  - type: fly
    value: "50"
    hover: true
abilities:
  - ability: str
    score: 12
  - ability: dex
    score: 15
  - ability: con
    score: 11
  - ability: int
    score: 1
  - ability: wis
    score: 5
  - ability: cha
    score: 1
pb: "+2"
cr: 1/4
xp: "50"
sensesList:
  - type: blindsight
    range: "60"
passivesList:
  - skill: Perception
    value: "7"
damageImmunitiesList:
  - value: Poison
  - value: Psychic
  - value: Charmed
  - value: Deafened
  - value: Exhaustion
  - value: Frightened
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
entries:
  - category: action
    name: Slash
    text: "*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Slashing damage."

---

# Animated Flying Sword
*Small, Construct, Unaligned*

**AC** 17
**HP** 14 (4d6)
**Initiative** +4 (14)
**Speed** 5 ft., fly 50 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 12 | 15 | 11 | 1 | 5 | 1 |

**Senses** blindsight 60 ft.; Passive Perception 7
CR 1/4, PB +2, XP 50

## Actions

**Slash**
*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Slashing damage.
