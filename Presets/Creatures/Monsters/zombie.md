---
smType: creature
name: Zombie
size: Medium
type: Undead
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: "8"
initiative: "-2 (8)"
hp: "15"
hitDice: 2d8 + 6
speeds:
  - type: walk
    value: "20"
abilities:
  - ability: str
    score: 13
  - ability: dex
    score: 6
  - ability: con
    score: 16
  - ability: int
    score: 3
  - ability: wis
    score: 6
  - ability: cha
    score: 5
pb: "+2"
cr: 1/4
xp: "50"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Understands Common plus one other language but can't speak
passivesList:
  - skill: Perception
    value: "8"
damageImmunitiesList:
  - value: Poison
  - value: Exhaustion
  - value: Poisoned
entries:
  - category: trait
    name: Undead Fortitude
    text: If damage reduces the zombie to 0 Hit Points, it makes a Constitution saving throw (DC 5 plus the damage taken) unless the damage is Radiant or from a Critical Hit. On a successful save, the zombie drops to 1 Hit Point instead.
  - category: action
    name: Slam
    text: "*Melee Attack Roll:* +3, reach 5 ft. 5 (1d8 + 1) Bludgeoning damage."

---

# Zombie
*Medium, Undead, Neutral Evil*

**AC** 8
**HP** 15 (2d8 + 6)
**Initiative** -2 (8)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 13 | 6 | 16 | 3 | 6 | 5 |

**Senses** darkvision 60 ft.; Passive Perception 8
**Languages** Understands Common plus one other language but can't speak
CR 1/4, PB +2, XP 50

## Traits

**Undead Fortitude**
If damage reduces the zombie to 0 Hit Points, it makes a Constitution saving throw (DC 5 plus the damage taken) unless the damage is Radiant or from a Critical Hit. On a successful save, the zombie drops to 1 Hit Point instead.

## Actions

**Slam**
*Melee Attack Roll:* +3, reach 5 ft. 5 (1d8 + 1) Bludgeoning damage.
