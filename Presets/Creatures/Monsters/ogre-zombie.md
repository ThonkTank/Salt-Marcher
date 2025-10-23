---
smType: creature
name: Ogre Zombie
size: Large
type: Undead
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: "8"
initiative: "-2 (8)"
hp: "85"
hitDice: 9d10 + 36
speeds:
  - type: walk
    value: "30"
abilities:
  - ability: str
    score: 19
  - ability: dex
    score: 6
  - ability: con
    score: 18
  - ability: int
    score: 3
  - ability: wis
    score: 6
  - ability: cha
    score: 5
pb: "+2"
cr: "2"
xp: "450"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Understands Common and Giant but can't speak
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
    text: "*Melee Attack Roll:* +6, reach 5 ft. 13 (2d8 + 4) Bludgeoning damage."

---

# Ogre Zombie
*Large, Undead, Neutral Evil*

**AC** 8
**HP** 85 (9d10 + 36)
**Initiative** -2 (8)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 19 | 6 | 18 | 3 | 6 | 5 |

**Senses** darkvision 60 ft.; Passive Perception 8
**Languages** Understands Common and Giant but can't speak
CR 2, PB +2, XP 450

## Traits

**Undead Fortitude**
If damage reduces the zombie to 0 Hit Points, it makes a Constitution saving throw (DC 5 plus the damage taken) unless the damage is Radiant or from a Critical Hit. On a successful save, the zombie drops to 1 Hit Point instead.

## Actions

**Slam**
*Melee Attack Roll:* +6, reach 5 ft. 13 (2d8 + 4) Bludgeoning damage.
