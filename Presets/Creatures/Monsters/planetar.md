---
smType: creature
name: Planetar
size: Large
type: Celestial
typeTags:
  - value: Angel
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '19'
initiative: +10 (20)
hp: '262'
hitDice: 21d10 + 147
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 120 ft.
    hover: true
abilities:
  - key: str
    score: 24
    saveProf: true
    saveMod: 12
  - key: dex
    score: 20
    saveProf: false
  - key: con
    score: 24
    saveProf: true
    saveMod: 12
  - key: int
    score: 19
    saveProf: false
  - key: wis
    score: 22
    saveProf: true
    saveMod: 11
  - key: cha
    score: 25
    saveProf: true
    saveMod: 12
pb: '+5'
skills:
  - skill: Perception
    value: '11'
sensesList:
  - type: truesight
    range: '120'
passivesList:
  - skill: Perception
    value: '21'
languagesList:
  - value: All
  - value: telepathy 120 ft.
damageResistancesList:
  - value: Radiant
damageImmunitiesList:
  - value: Exhaustion
conditionImmunitiesList:
  - value: Charmed
  - value: Frightened
cr: '16'
xp: '15000'
entries:
  - category: trait
    name: Divine Awareness
    entryType: special
    text: The planetar knows if it hears a lie.
  - category: trait
    name: Exalted Restoration
    entryType: special
    text: If the planetar dies outside Mount Celestia, its body disappears, and it gains a new body instantly, reviving with all its Hit Points somewhere in Mount Celestia.
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The planetar has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The planetar makes three Radiant Sword attacks or uses Holy Burst twice.
    multiattack:
      attacks:
        - name: Sword
          count: 1
      substitutions: []
  - category: action
    name: Radiant Sword
    entryType: attack
    text: '*Melee Attack Roll:* +12, reach 10 ft. 14 (2d6 + 7) Slashing damage plus 18 (4d8) Radiant damage.'
    attack:
      type: melee
      bonus: 12
      damage:
        - dice: 2d6
          bonus: 7
          type: Slashing
          average: 14
        - dice: 4d8
          bonus: 0
          type: Radiant
          average: 18
      reach: 10 ft.
  - category: action
    name: Holy Burst
    entryType: save
    text: '*Dexterity Saving Throw*: DC 20, each enemy in a 20-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the planetar can see within 120 feet. *Failure:*  24 (7d6) Radiant damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 20
      targeting:
        shape: sphere
        size: 20 ft.
      onFail:
        effects:
          other: 24 (7d6) Radiant damage.
        damage:
          - dice: 7d6
            bonus: 0
            type: Radiant
            average: 24
        legacyEffects: 24 (7d6) Radiant damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The planetar casts one of the following spells, requiring no Material components and using Charisma as spellcasting ability (spell save DC 20): - **At Will:** *Detect Evil and Good* - **1e/Day Each:** *Commune*, *Control Weather*, *Dispel Evil and Good*, *Raise Dead*'
    spellcasting:
      ability: cha
      saveDC: 20
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Evil and Good
        - frequency: 1/day
          spells:
            - Commune
            - Control Weather
            - Dispel Evil and Good
            - Raise Dead
  - category: bonus
    name: Divine Aid (2/Day)
    entryType: spellcasting
    text: The planetar casts *Cure Wounds*, *Invisibility*, *Lesser Restoration*, or *Remove Curse*, using the same spellcasting ability as Spellcasting.
    limitedUse:
      count: 2
      reset: day
    spellcasting:
      ability: int
      spellLists: []
---

# Planetar
*Large, Celestial, Lawful Good*

**AC** 19
**HP** 262 (21d10 + 147)
**Initiative** +10 (20)
**Speed** 40 ft., fly 120 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 120 ft.; Passive Perception 21
**Languages** All, telepathy 120 ft.
CR 16, PB +5, XP 15000

## Traits

**Divine Awareness**
The planetar knows if it hears a lie.

**Exalted Restoration**
If the planetar dies outside Mount Celestia, its body disappears, and it gains a new body instantly, reviving with all its Hit Points somewhere in Mount Celestia.

**Magic Resistance**
The planetar has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The planetar makes three Radiant Sword attacks or uses Holy Burst twice.

**Radiant Sword**
*Melee Attack Roll:* +12, reach 10 ft. 14 (2d6 + 7) Slashing damage plus 18 (4d8) Radiant damage.

**Holy Burst**
*Dexterity Saving Throw*: DC 20, each enemy in a 20-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the planetar can see within 120 feet. *Failure:*  24 (7d6) Radiant damage. *Success:*  Half damage.

**Spellcasting**
The planetar casts one of the following spells, requiring no Material components and using Charisma as spellcasting ability (spell save DC 20): - **At Will:** *Detect Evil and Good* - **1e/Day Each:** *Commune*, *Control Weather*, *Dispel Evil and Good*, *Raise Dead*

## Bonus Actions

**Divine Aid (2/Day)**
The planetar casts *Cure Wounds*, *Invisibility*, *Lesser Restoration*, or *Remove Curse*, using the same spellcasting ability as Spellcasting.
