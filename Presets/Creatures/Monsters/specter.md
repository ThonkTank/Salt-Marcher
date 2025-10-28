---
smType: creature
name: Specter
size: Medium
type: Undead
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '12'
initiative: +2 (12)
hp: '22'
hitDice: 5d8
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 50 ft.
    hover: true
abilities:
  - key: str
    score: 1
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Understands Common plus one other language but can't speak
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
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Incorporeal Movement
    entryType: special
    text: The specter can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Sunlight Sensitivity
    entryType: special
    text: While in sunlight, the specter has Disadvantage on ability checks and attack rolls.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Life Drain
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 7 (2d6) Necrotic damage. If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d6
          bonus: 0
          type: Necrotic
          average: 7
      reach: 5 ft.
      onHit:
        other: If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.
      additionalEffects: If the target is a creature, its Hit Point maximum decreases by an amount equal to the damage taken.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Specter
*Medium, Undead, Chaotic Evil*

**AC** 12
**HP** 22 (5d8)
**Initiative** +2 (12)
**Speed** 30 ft., fly 50 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

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
