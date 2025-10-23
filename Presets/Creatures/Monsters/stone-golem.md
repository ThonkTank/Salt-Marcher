---
smType: creature
name: Stone Golem
size: Large
type: Construct
alignmentOverride: Unaligned
ac: "18"
initiative: +3 (13)
hp: "220"
hitDice: 21d10 + 105
speeds:
  - type: walk
    value: "30"
abilities:
  - ability: str
    score: 22
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
pb: "+4"
cr: "10"
xp: "5900"
sensesList:
  - type: darkvision
    range: "120"
languagesList:
  - value: Understands Common plus two other languages but can't speak
passivesList:
  - skill: Perception
    value: "10"
damageImmunitiesList:
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
    name: Immutable Form
    text: The golem can't shape-shift.
  - category: trait
    name: Magic Resistance
    text: The golem has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    text: The golem makes two attacks, using Slam or Force Bolt in any combination.
  - category: action
    name: Slam
    text: "*Melee Attack Roll:* +10, reach 5 ft. 15 (2d8 + 6) Bludgeoning damage plus 9 (2d8) Force damage."
  - category: action
    name: Force Bolt
    text: "*Ranged Attack Roll:* +9, range 120 ft. 22 (4d10) Force damage."
  - category: bonus
    name: Slow (Recharge 5-6)
    text: The golem casts the *Slow* spell, requiring no spell components and using Constitution as the spellcasting ability (spell save DC 17).

---

# Stone Golem
*Large, Construct, Unaligned*

**AC** 18
**HP** 220 (21d10 + 105)
**Initiative** +3 (13)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 22 | 9 | 20 | 3 | 11 | 1 |

**Senses** darkvision 120 ft.; Passive Perception 10
**Languages** Understands Common plus two other languages but can't speak
CR 10, PB +4, XP 5900

## Traits

**Immutable Form**
The golem can't shape-shift.

**Magic Resistance**
The golem has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The golem makes two attacks, using Slam or Force Bolt in any combination.

**Slam**
*Melee Attack Roll:* +10, reach 5 ft. 15 (2d8 + 6) Bludgeoning damage plus 9 (2d8) Force damage.

**Force Bolt**
*Ranged Attack Roll:* +9, range 120 ft. 22 (4d10) Force damage.

## Bonus Actions

**Slow (Recharge 5-6)**
The golem casts the *Slow* spell, requiring no spell components and using Constitution as the spellcasting ability (spell save DC 17).
