---
smType: creature
name: Air Elemental
size: Large
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: "15"
initiative: +5 (15)
hp: "90"
hitDice: 12d10 + 24
speeds:
  - type: walk
    value: "10"
  - type: fly
    value: "90"
    hover: true
abilities:
  - ability: str
    score: 14
  - ability: dex
    score: 20
  - ability: con
    score: 14
  - ability: int
    score: 6
  - ability: wis
    score: 10
  - ability: cha
    score: 6
pb: "+3"
cr: "5"
xp: "1800"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Primordial (Auran)
passivesList:
  - skill: Perception
    value: "10"
damageResistancesList:
  - value: Bludgeoning
  - value: Lightning
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Poison
  - value: Thunder
  - value: Exhaustion
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
  - value: Prone
  - value: Restrained
  - value: Unconscious
entries:
  - category: trait
    name: Air Form
    text: The elemental can enter a creature's space and stop there. It can move through a space as narrow as 1 inch without expending extra movement to do so.
  - category: action
    name: Multiattack
    text: The elemental makes two Thunderous Slam attacks.
  - category: action
    name: Thunderous Slam
    text: "*Melee Attack Roll:* +8, reach 10 ft. 14 (2d8 + 5) Thunder damage."
  - category: action
    name: Whirlwind (Recharge 4-6)
    text: "*Strength Saving Throw*: DC 13, one Medium or smaller creature in the elemental's space. *Failure:*  24 (4d10 + 2) Thunder damage, and the target is pushed up to 20 feet straight away from the elemental and has the Prone condition. *Success:*  Half damage only."

---

# Air Elemental
*Large, Elemental, Neutral Neutral*

**AC** 15
**HP** 90 (12d10 + 24)
**Initiative** +5 (15)
**Speed** 10 ft., fly 90 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 14 | 20 | 14 | 6 | 10 | 6 |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Primordial (Auran)
CR 5, PB +3, XP 1800

## Traits

**Air Form**
The elemental can enter a creature's space and stop there. It can move through a space as narrow as 1 inch without expending extra movement to do so.

## Actions

**Multiattack**
The elemental makes two Thunderous Slam attacks.

**Thunderous Slam**
*Melee Attack Roll:* +8, reach 10 ft. 14 (2d8 + 5) Thunder damage.

**Whirlwind (Recharge 4-6)**
*Strength Saving Throw*: DC 13, one Medium or smaller creature in the elemental's space. *Failure:*  24 (4d10 + 2) Thunder damage, and the target is pushed up to 20 feet straight away from the elemental and has the Prone condition. *Success:*  Half damage only.
