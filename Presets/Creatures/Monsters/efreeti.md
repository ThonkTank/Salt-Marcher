---
smType: creature
name: Efreeti
size: Large
type: Elemental
typeTags:
  - value: Genie
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '17'
initiative: +1 (11)
hp: '212'
hitDice: 17d10 + 119
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 60 ft.
    hover: true
abilities:
  - key: str
    score: 22
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 24
    saveProf: false
  - key: int
    score: 16
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 6
  - key: cha
    score: 19
    saveProf: true
    saveMod: 8
pb: '+4'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Primordial (Ignan)
damageImmunitiesList:
  - value: Fire
cr: '11'
xp: '7200'
entries:
  - category: trait
    name: Elemental Restoration
    entryType: special
    text: If the efreeti dies outside the Elemental Plane of Fire, its body dissolves into ash, and it gains a new body in 1d4 days, reviving with all its Hit Points somewhere on the Plane of Fire.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The efreeti has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Wishes
    entryType: special
    text: The efreeti has a 30 percent chance of knowing the *Wish* spell. If the efreeti knows it, the efreeti can cast it only on behalf of a non-genie creature who communicates a wish in a way the efreeti can understand. If the efreeti casts the spell for the creature, the efreeti suffers none of the spell's stress. Once the efreeti has cast it three times, the efreeti can't do so again for 365 days.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: special
    text: The efreeti makes three attacks, using Heated Blade or Hurl Flame in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Heated Blade
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 5 ft. 13 (2d6 + 6) Slashing damage plus 13 (2d12) Fire damage.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 2d6
          bonus: 6
          type: Slashing
          average: 13
        - dice: 2d12
          bonus: 0
          type: Fire
          average: 13
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Hurl Flame
    entryType: attack
    text: '*Ranged Attack Roll:* +8, range 120 ft. 24 (7d6) Fire damage.'
    attack:
      type: ranged
      bonus: 8
      damage:
        - dice: 7d6
          bonus: 0
          type: Fire
          average: 24
      range: 120 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The efreeti casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16): - **At Will:** *Detect Magic*, *Elementalism* - **1e/Day Each:** *Gaseous Form*, *Invisibility*, *Major Image*, *Plane Shift*, *Tongues*, *Wall of Fire*'
    spellcasting:
      ability: cha
      saveDC: 16
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Elementalism
        - frequency: 1/day
          spells:
            - Gaseous Form
            - Invisibility
            - Major Image
            - Plane Shift
            - Tongues
            - Wall of Fire
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Efreeti
*Large, Elemental, Neutral Neutral*

**AC** 17
**HP** 212 (17d10 + 119)
**Initiative** +1 (11)
**Speed** 40 ft., fly 60 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 12
**Languages** Primordial (Ignan)
CR 11, PB +4, XP 7200

## Traits

**Elemental Restoration**
If the efreeti dies outside the Elemental Plane of Fire, its body dissolves into ash, and it gains a new body in 1d4 days, reviving with all its Hit Points somewhere on the Plane of Fire.

**Magic Resistance**
The efreeti has Advantage on saving throws against spells and other magical effects.

**Wishes**
The efreeti has a 30 percent chance of knowing the *Wish* spell. If the efreeti knows it, the efreeti can cast it only on behalf of a non-genie creature who communicates a wish in a way the efreeti can understand. If the efreeti casts the spell for the creature, the efreeti suffers none of the spell's stress. Once the efreeti has cast it three times, the efreeti can't do so again for 365 days.

## Actions

**Multiattack**
The efreeti makes three attacks, using Heated Blade or Hurl Flame in any combination.

**Heated Blade**
*Melee Attack Roll:* +10, reach 5 ft. 13 (2d6 + 6) Slashing damage plus 13 (2d12) Fire damage.

**Hurl Flame**
*Ranged Attack Roll:* +8, range 120 ft. 24 (7d6) Fire damage.

**Spellcasting**
The efreeti casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16): - **At Will:** *Detect Magic*, *Elementalism* - **1e/Day Each:** *Gaseous Form*, *Invisibility*, *Major Image*, *Plane Shift*, *Tongues*, *Wall of Fire*
