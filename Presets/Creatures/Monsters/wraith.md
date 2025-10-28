---
smType: creature
name: Wraith
size: Small
type: Undead
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '13'
initiative: +3 (13)
hp: '67'
hitDice: 9d8 + 27
speeds:
  walk:
    distance: 5 ft.
  fly:
    distance: 60 ft.
    hover: true
abilities:
  - key: str
    score: 6
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 15
    saveProf: false
pb: '+3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Common plus two other languages
damageResistancesList:
  - value: Acid
  - value: Bludgeoning
  - value: Cold
  - value: Fire
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Necrotic
  - value: Poison; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
  - value: Prone
  - value: Restrained
  - value: Unconscious
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Incorporeal Movement
    entryType: special
    text: The wraith can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.
  - category: trait
    name: Sunlight Sensitivity
    entryType: special
    text: While in sunlight, the wraith has Disadvantage on ability checks and attack rolls.
  - category: action
    name: Life Drain
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 21 (4d8 + 3) Necrotic damage. If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 4d8
          bonus: 3
          type: Necrotic
          average: 21
      reach: 5 ft.
      onHit:
        other: If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.
      additionalEffects: If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.
  - category: action
    name: Create Specter
    entryType: special
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
| - | - | - | - | - | - |

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
