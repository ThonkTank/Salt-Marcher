---
smType: creature
name: Spirit Naga
size: Large
type: Fiend
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '17'
initiative: +3 (13)
hp: '135'
hitDice: 18d10 + 36
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 17
    saveProf: true
    saveMod: 6
  - key: con
    score: 14
    saveProf: true
    saveMod: 5
  - key: int
    score: 16
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 5
  - key: cha
    score: 16
    saveProf: true
    saveMod: 6
pb: '+3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Abyssal
  - value: Common
damageImmunitiesList:
  - value: Poison; Charmed
conditionImmunitiesList:
  - value: Poisoned
cr: '8'
xp: '3900'
entries:
  - category: trait
    name: Fiendish Restoration
    entryType: special
    text: If it dies, the naga returns to life in 1d6 days and regains all its Hit Points. Only a *Wish* spell can prevent this trait from functioning.
  - category: action
    name: Multiattack
    entryType: special
    text: The naga makes three attacks, using Bite or Necrotic Ray in any combination.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 10 ft. 7 (1d6 + 4) Piercing damage plus 14 (4d6) Poison damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 1d6
          bonus: 4
          type: Piercing
          average: 7
        - dice: 4d6
          bonus: 0
          type: Poison
          average: 14
      reach: 10 ft.
  - category: action
    name: Necrotic Ray
    entryType: attack
    text: '*Ranged Attack Roll:* +6, range 60 ft. 21 (6d6) Necrotic damage.'
    attack:
      type: ranged
      bonus: 6
      damage:
        - dice: 6d6
          bonus: 0
          type: Necrotic
          average: 21
      range: 60 ft.
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The naga casts one of the following spells, requiring no Somatic or Material components and using Intelligence as the spellcasting ability (spell save DC 14): - **At Will:** *Detect Magic*, *Mage Hand*, *Minor Illusion*, *Water Breathing* - **2e/Day Each:** *Detect Thoughts*, *Dimension Door*, *Hold Person*, *Lightning Bolt*'
    spellcasting:
      ability: int
      saveDC: 14
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Mage Hand
            - Minor Illusion
            - Water Breathing
        - frequency: 2/day
          spells:
            - Detect Thoughts
            - Dimension Door
            - Hold Person
            - Lightning Bolt
---

# Spirit Naga
*Large, Fiend, Chaotic Evil*

**AC** 17
**HP** 135 (18d10 + 36)
**Initiative** +3 (13)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 12
**Languages** Abyssal, Common
CR 8, PB +3, XP 3900

## Traits

**Fiendish Restoration**
If it dies, the naga returns to life in 1d6 days and regains all its Hit Points. Only a *Wish* spell can prevent this trait from functioning.

## Actions

**Multiattack**
The naga makes three attacks, using Bite or Necrotic Ray in any combination.

**Bite**
*Melee Attack Roll:* +7, reach 10 ft. 7 (1d6 + 4) Piercing damage plus 14 (4d6) Poison damage.

**Necrotic Ray**
*Ranged Attack Roll:* +6, range 60 ft. 21 (6d6) Necrotic damage.

**Spellcasting**
The naga casts one of the following spells, requiring no Somatic or Material components and using Intelligence as the spellcasting ability (spell save DC 14): - **At Will:** *Detect Magic*, *Mage Hand*, *Minor Illusion*, *Water Breathing* - **2e/Day Each:** *Detect Thoughts*, *Dimension Door*, *Hold Person*, *Lightning Bolt*
