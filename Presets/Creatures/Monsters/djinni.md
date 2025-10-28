---
smType: creature
name: Djinni
size: Large
type: Elemental
typeTags:
  - value: Genie
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: '17'
initiative: +2 (12)
hp: '218'
hitDice: 19d10 + 114
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 90 ft.
    hover: true
abilities:
  - key: str
    score: 21
    saveProf: false
  - key: dex
    score: 15
    saveProf: true
    saveMod: 6
  - key: con
    score: 22
    saveProf: false
  - key: int
    score: 15
    saveProf: false
  - key: wis
    score: 16
    saveProf: true
    saveMod: 7
  - key: cha
    score: 20
    saveProf: false
pb: '+4'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '13'
languagesList:
  - value: Primordial (Auran)
damageImmunitiesList:
  - value: Lightning
  - value: Thunder
cr: '11'
xp: '7200'
entries:
  - category: trait
    name: Elemental Restoration
    entryType: special
    text: If the djinni dies outside the Elemental Plane of Air, its body dissolves into mist, and it gains a new body in 1d4 days, reviving with all its Hit Points somewhere on the Plane of Air.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The djinni has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Wishes
    entryType: special
    text: The djinni has a 30 percent chance of knowing the *Wish* spell. If the djinni knows it, the djinni can cast it only on behalf of a non-genie creature who communicates a wish in a way the djinni can understand. If the djinni casts the spell for the creature, the djinni suffers none of the spell's stress. Once the djinni has cast it three times, the djinni can't do so again for 365 days.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: special
    text: The djinni makes three attacks, using Storm Blade or Storm Bolt in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Storm Blade
    entryType: attack
    text: '*Melee Attack Roll:* +9, reach 5 feet. 12 (2d6 + 5) Slashing damage plus 7 (2d6) Lightning damage.'
    attack:
      type: melee
      bonus: 9
      damage:
        - dice: 2d6
          bonus: 5
          type: Slashing
          average: 12
        - dice: 2d6
          bonus: 0
          type: Lightning
          average: 7
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Storm Bolt
    entryType: attack
    text: '*Ranged Attack Roll:* +9, range 120 feet. 13 (3d8) Thunder damage. If the target is a Large or smaller creature, it has the Prone condition.'
    attack:
      type: ranged
      bonus: 9
      damage:
        - dice: 3d8
          bonus: 0
          type: Thunder
          average: 13
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, it has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Create Whirlwind
    entryType: save
    text: 'The djinni conjures a whirlwind at a point it can see within 120 feet. The whirlwind fills a 20-foot-radius, 60-foot-high Cylinder [Area of Effect]|XPHB|Cylinder centered on that point. The whirlwind lasts until the djinni''s  Concentration on it ends. The djinni can move the whirlwind up to 20 feet at the start of each of its turns. Whenever the whirlwind enters a creature''s space or a creature enters the whirlwind, that creature is subjected to the following effect. *Strength Saving Throw*: DC 17 (a creature makes this save only once per turn, and the djinni is unaffected). *Failure:*  While in the whirlwind, the target has the Restrained condition and moves with the whirlwind. At the start of each of its turns, the Restrained target takes 21 (6d6) Thunder damage. At the end of each of its turns, the target repeats the save, ending the effect on itself on a success.'
    save:
      ability: str
      dc: 17
      onFail:
        effects:
          conditions:
            - condition: Restrained
              saveToEnd:
                timing: end-of-turn
        damage:
          - dice: 6d6
            bonus: 0
            type: Thunder
            average: 21
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The djinni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17): - **At Will:** *Detect Evil and Good*, *Detect Magic* - **2e/Day Each:** *Create Food and Water*, *Tongues*, *Wind Walk* - **1e/Day Each:** *Creation*, *Gaseous Form*, *Invisibility*, *Major Image*, *Plane Shift*'
    spellcasting:
      ability: cha
      saveDC: 17
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Evil and Good
            - Detect Magic
        - frequency: 2/day
          spells:
            - Create Food and Water
            - Tongues
            - Wind Walk
        - frequency: 1/day
          spells:
            - Creation
            - Gaseous Form
            - Invisibility
            - Major Image
            - Plane Shift
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Djinni
*Large, Elemental, Chaotic Good*

**AC** 17
**HP** 218 (19d10 + 114)
**Initiative** +2 (12)
**Speed** 30 ft., fly 90 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 13
**Languages** Primordial (Auran)
CR 11, PB +4, XP 7200

## Traits

**Elemental Restoration**
If the djinni dies outside the Elemental Plane of Air, its body dissolves into mist, and it gains a new body in 1d4 days, reviving with all its Hit Points somewhere on the Plane of Air.

**Magic Resistance**
The djinni has Advantage on saving throws against spells and other magical effects.

**Wishes**
The djinni has a 30 percent chance of knowing the *Wish* spell. If the djinni knows it, the djinni can cast it only on behalf of a non-genie creature who communicates a wish in a way the djinni can understand. If the djinni casts the spell for the creature, the djinni suffers none of the spell's stress. Once the djinni has cast it three times, the djinni can't do so again for 365 days.

## Actions

**Multiattack**
The djinni makes three attacks, using Storm Blade or Storm Bolt in any combination.

**Storm Blade**
*Melee Attack Roll:* +9, reach 5 feet. 12 (2d6 + 5) Slashing damage plus 7 (2d6) Lightning damage.

**Storm Bolt**
*Ranged Attack Roll:* +9, range 120 feet. 13 (3d8) Thunder damage. If the target is a Large or smaller creature, it has the Prone condition.

**Create Whirlwind**
The djinni conjures a whirlwind at a point it can see within 120 feet. The whirlwind fills a 20-foot-radius, 60-foot-high Cylinder [Area of Effect]|XPHB|Cylinder centered on that point. The whirlwind lasts until the djinni's  Concentration on it ends. The djinni can move the whirlwind up to 20 feet at the start of each of its turns. Whenever the whirlwind enters a creature's space or a creature enters the whirlwind, that creature is subjected to the following effect. *Strength Saving Throw*: DC 17 (a creature makes this save only once per turn, and the djinni is unaffected). *Failure:*  While in the whirlwind, the target has the Restrained condition and moves with the whirlwind. At the start of each of its turns, the Restrained target takes 21 (6d6) Thunder damage. At the end of each of its turns, the target repeats the save, ending the effect on itself on a success.

**Spellcasting**
The djinni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17): - **At Will:** *Detect Evil and Good*, *Detect Magic* - **2e/Day Each:** *Create Food and Water*, *Tongues*, *Wind Walk* - **1e/Day Each:** *Creation*, *Gaseous Form*, *Invisibility*, *Major Image*, *Plane Shift*
