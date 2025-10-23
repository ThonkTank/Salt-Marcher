---
smType: creature
name: Iron Golem
size: Large
type: Construct
alignmentOverride: Unaligned
ac: "20"
initiative: +9 (19)
hp: "252"
hitDice: 24d10 + 120
speeds:
  - type: walk
    value: "30"
abilities:
  - ability: str
    score: 24
  - ability: dex
    score: 9
  - ability: con
    score: 20
  - ability: int
    score: 3
  - ability: wis
    score: 11
  - ability: cha
    score: 1
pb: "+5"
cr: "16"
xp: "15000"
sensesList:
  - type: darkvision
    range: "120"
languagesList:
  - value: Understands Common plus two other languages but can't speak
passivesList:
  - skill: Perception
    value: "10"
damageImmunitiesList:
  - value: Fire
  - value: Poison
  - value: Psychic
  - value: Charmed
  - value: Exhaustion
  - value: Frightened
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
entries:
  - category: trait
    name: Fire Absorption
    text: Whenever the golem is subjected to Fire damage, it regains a number of Hit Points equal to the Fire damage dealt.
  - category: trait
    name: Immutable Form
    text: The golem can't shape-shift.
  - category: trait
    name: Magic Resistance
    text: The golem has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    text: The golem makes two attacks, using Bladed Arm or Fiery Bolt in any combination.
  - category: action
    name: Bladed Arm
    text: "*Melee Attack Roll:* +12, reach 10 ft. 20 (3d8 + 7) Slashing damage plus 10 (3d6) Fire damage."
  - category: action
    name: Fiery Bolt
    text: "*Ranged Attack Roll:* +10, range 120 ft. 36 (8d8) Fire damage."
  - category: action
    name: Poison Breath
    recharge: Recharge 6
    text: "*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  55 (10d10) Poison damage. *Success:*  Half damage."

---

# Iron Golem
*Large, Construct, Unaligned*

**AC** 20
**HP** 252 (24d10 + 120)
**Initiative** +9 (19)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 24 | 9 | 20 | 3 | 11 | 1 |

**Senses** darkvision 120 ft.; Passive Perception 10
**Languages** Understands Common plus two other languages but can't speak
CR 16, PB +5, XP 15000

## Traits

**Fire Absorption**
Whenever the golem is subjected to Fire damage, it regains a number of Hit Points equal to the Fire damage dealt.

**Immutable Form**
The golem can't shape-shift.

**Magic Resistance**
The golem has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The golem makes two attacks, using Bladed Arm or Fiery Bolt in any combination.

**Bladed Arm**
*Melee Attack Roll:* +12, reach 10 ft. 20 (3d8 + 7) Slashing damage plus 10 (3d6) Fire damage.

**Fiery Bolt**
*Ranged Attack Roll:* +10, range 120 ft. 36 (8d8) Fire damage.

**Poison Breath (Recharge 6)**
*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  55 (10d10) Poison damage. *Success:*  Half damage.
