---
smType: creature
name: Fire Elemental
size: Large
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '13'
initiative: +3 (13)
hp: '93'
hitDice: 11d10 + 33
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Primordial (Ignan)
damageResistancesList:
  - value: Bludgeoning
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Fire
  - value: Poison; Exhaustion
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
    name: Fire Aura
    entryType: special
    text: At the end of each of the elemental's turns, each creature in a 10-foot Emanation originating from the elemental takes 5 (1d10) Fire damage. Creatures and flammable objects in the Emanation start Hitazard burning.
  - category: trait
    name: Fire Form
    entryType: special
    text: The elemental can move through a space as narrow as 1 inch without expending extra movement to do so, and it can enter a creature's space and stop there. The first time it enters a creature's space on a turn, that creature takes 5 (1d10) Fire damage.
  - category: trait
    name: Illumination
    entryType: special
    text: The elemental sheds Bright Light in a 30-foot radius and Dim Light for an additional 30 feet.
  - category: trait
    name: Water Susceptibility
    entryType: special
    text: The elemental takes 3 (1d6) Cold damage for every 5 feet the elemental moves in water or for every gallon of water splashed on it.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The elemental makes two Burn attacks.
    multiattack:
      attacks:
        - name: Burn
          count: 2
      substitutions: []
  - category: action
    name: Burn
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Fire damage. If the target is a creature or a flammable object, it starts burning.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d6
          bonus: 3
          type: Fire
          average: 10
      reach: 5 ft.
      onHit:
        other: If the target is a creature or a flammable object, it starts burning.
      additionalEffects: If the target is a creature or a flammable object, it starts burning.
---

# Fire Elemental
*Large, Elemental, Neutral Neutral*

**AC** 13
**HP** 93 (11d10 + 33)
**Initiative** +3 (13)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Primordial (Ignan)
CR 5, PB +3, XP 1800

## Traits

**Fire Aura**
At the end of each of the elemental's turns, each creature in a 10-foot Emanation originating from the elemental takes 5 (1d10) Fire damage. Creatures and flammable objects in the Emanation start Hitazard burning.

**Fire Form**
The elemental can move through a space as narrow as 1 inch without expending extra movement to do so, and it can enter a creature's space and stop there. The first time it enters a creature's space on a turn, that creature takes 5 (1d10) Fire damage.

**Illumination**
The elemental sheds Bright Light in a 30-foot radius and Dim Light for an additional 30 feet.

**Water Susceptibility**
The elemental takes 3 (1d6) Cold damage for every 5 feet the elemental moves in water or for every gallon of water splashed on it.

## Actions

**Multiattack**
The elemental makes two Burn attacks.

**Burn**
*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Fire damage. If the target is a creature or a flammable object, it starts burning.
