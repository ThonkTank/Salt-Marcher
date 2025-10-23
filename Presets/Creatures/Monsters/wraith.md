---
smType: creature
name: Wraith
size: Small
type: Undead
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: "13"
initiative: +3 (13)
hp: "67"
hitDice: 9d8 + 27
speeds:
  - type: walk
    value: "5"
  - type: fly
    value: "60"
    hover: true
abilities:
  - ability: str
    score: 6
  - ability: dex
    score: 16
  - ability: con
    score: 16
  - ability: int
    score: 12
  - ability: wis
    score: 14
  - ability: cha
    score: 15
pb: "+3"
cr: "5"
xp: "1800"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Common plus two other languages
passivesList:
  - skill: Perception
    value: "12"
damageResistancesList:
  - value: Acid
  - value: Bludgeoning
  - value: Cold
  - value: Fire
  - value: Piercing
  - value: Slashing
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
    text: The wraith can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.
  - category: trait
    name: Sunlight Sensitivity
    text: While in sunlight, the wraith has Disadvantage on ability checks and attack rolls.
  - category: action
    name: Life Drain
    text: "*Melee Attack Roll:* +6, reach 5 ft. 21 (4d8 + 3) Necrotic damage. If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken."
  - category: action
    name: Create Specter
    text: The wraith targets a Humanoid corpse within 10 feet of itself that has been dead for no longer than 1 minute. The target's spirit rises as a Specter in the space of its corpse or in the nearest unoccupied space. The specter is under the wraith's control. The wraith can have no more than seven specters under its control at a time.

---

# Wraith
*Small, Undead, Neutral Evil*

**AC** 13
**HP** 67 (9d8 + 27)
**Initiative** +3 (13)
**Speed** 5 ft., fly 60 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 6 | 16 | 16 | 12 | 14 | 15 |

**Senses** darkvision 60 ft.; Passive Perception 12
**Languages** Common plus two other languages
CR 5, PB +3, XP 1800

## Traits

**Incorporeal Movement**
The wraith can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.

**Sunlight Sensitivity**
While in sunlight, the wraith has Disadvantage on ability checks and attack rolls.

## Actions

**Life Drain**
*Melee Attack Roll:* +6, reach 5 ft. 21 (4d8 + 3) Necrotic damage. If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.

**Create Specter**
The wraith targets a Humanoid corpse within 10 feet of itself that has been dead for no longer than 1 minute. The target's spirit rises as a Specter in the space of its corpse or in the nearest unoccupied space. The specter is under the wraith's control. The wraith can have no more than seven specters under its control at a time.
