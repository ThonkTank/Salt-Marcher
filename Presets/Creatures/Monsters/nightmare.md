---
smType: creature
name: Nightmare
size: Large
type: Fiend
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '13'
initiative: +2 (12)
hp: '68'
hitDice: 8d10 + 24
speeds:
  walk:
    distance: 60 ft.
  fly:
    distance: 90 ft.
    hover: true
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 15
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Understands Abyssal
  - value: Common
  - value: And Infernal but can't speak
damageImmunitiesList:
  - value: Fire
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Confer Fire Resistance
    entryType: special
    text: The nightmare can grant Resistance to Fire damage to a rider while it is on the nightmare.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Illumination
    entryType: special
    text: The nightmare sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Hooves
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 13 (2d8 + 4) Bludgeoning damage plus 10 (3d6) Fire damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d8
          bonus: 4
          type: Bludgeoning
          average: 13
        - dice: 3d6
          bonus: 0
          type: Fire
          average: 10
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Ethereal Stride
    entryType: special
    text: The nightmare and up to three willing creatures within 5 feet of it teleport to the Ethereal Plane from the Material Plane or vice versa.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Nightmare
*Large, Fiend, Neutral Evil*

**AC** 13
**HP** 68 (8d10 + 24)
**Initiative** +2 (12)
**Speed** 60 ft., fly 90 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Understands Abyssal, Common, And Infernal but can't speak
CR 3, PB +2, XP 700

## Traits

**Confer Fire Resistance**
The nightmare can grant Resistance to Fire damage to a rider while it is on the nightmare.

**Illumination**
The nightmare sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.

## Actions

**Hooves**
*Melee Attack Roll:* +6, reach 5 ft. 13 (2d8 + 4) Bludgeoning damage plus 10 (3d6) Fire damage.

**Ethereal Stride**
The nightmare and up to three willing creatures within 5 feet of it teleport to the Ethereal Plane from the Material Plane or vice versa.
