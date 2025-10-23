---
smType: creature
name: Specter
size: Medium
type: Undead
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: "12"
initiative: +2 (12)
hp: "22"
hitDice: 5d8
speeds:
  - type: walk
    value: "30"
  - type: fly
    value: "50"
    hover: true
abilities:
  - ability: str
    score: 1
  - ability: dex
    score: 14
  - ability: con
    score: 11
  - ability: int
    score: 10
  - ability: wis
    score: 10
  - ability: cha
    score: 11
pb: "+2"
cr: "1"
xp: "200"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Understands Common plus one other language but can't speak
passivesList:
  - skill: Perception
    value: "10"
damageResistancesList:
  - value: Acid
  - value: Bludgeoning
  - value: Cold
  - value: Fire
  - value: Lightning
  - value: Piercing
  - value: Slashing
  - value: Thunder
damageImmunitiesList:
  - value: Necrotic
  - value: Poison
  - value: Charmed
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
    name: Incorporeal Movement
    text: The specter can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.
  - category: trait
    name: Sunlight Sensitivity
    text: While in sunlight, the specter has Disadvantage on ability checks and attack rolls.
  - category: action
    name: Life Drain
    text: "*Melee Attack Roll:* +4, reach 5 ft. 7 (2d6) Necrotic damage. If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken."

---

# Specter
*Medium, Undead, Chaotic Evil*

**AC** 12
**HP** 22 (5d8)
**Initiative** +2 (12)
**Speed** 30 ft., fly 50 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 1 | 14 | 11 | 10 | 10 | 11 |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Understands Common plus one other language but can't speak
CR 1, PB +2, XP 200

## Traits

**Incorporeal Movement**
The specter can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.

**Sunlight Sensitivity**
While in sunlight, the specter has Disadvantage on ability checks and attack rolls.

## Actions

**Life Drain**
*Melee Attack Roll:* +4, reach 5 ft. 7 (2d6) Necrotic damage. If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.
