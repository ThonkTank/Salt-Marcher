---
smType: creature
name: Mage
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '15'
initiative: +2 (12)
hp: '81'
hitDice: 18d8
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 9
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 17
    saveProf: true
    saveMod: 6
  - key: wis
    score: 12
    saveProf: true
    saveMod: 4
  - key: cha
    score: 11
    saveProf: false
pb: '+3'
skills:
  - skill: Arcana
    value: '6'
  - skill: History
    value: '6'
  - skill: Perception
    value: '4'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Common and any three languages
cr: '6'
xp: '2300'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The mage makes three Arcane Burst attacks.
    multiattack:
      attacks:
        - name: Burst
          count: 1
      substitutions: []
  - category: action
    name: Arcane Burst
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +6, reach 5 ft. or range 120 ft. 16 (3d8 + 3) Force damage.'
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The mage casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 14): - **At Will:** *Detect Magic*, *Light*, *Mage Armor*, *Mage Hand*, *Prestidigitation* - **2e/Day Each:** *Fireball*, *Invisibility* - **1e/Day Each:** *Cone of Cold*, *Fly*'
    spellcasting:
      ability: int
      saveDC: 14
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Light
            - Mage Armor
            - Mage Hand
            - Prestidigitation
        - frequency: 2/day
          spells:
            - Fireball
            - Invisibility
        - frequency: 1/day
          spells:
            - Cone of Cold
            - Fly
  - category: bonus
    name: Misty Step (3/Day)
    entryType: spellcasting
    text: The mage casts *Misty Step*, using the same spellcasting ability as Spellcasting.
    limitedUse:
      count: 3
      reset: day
    spellcasting:
      ability: int
      spellLists: []
  - category: reaction
    name: Protective Magic (3/Day)
    entryType: spellcasting
    text: The mage casts *Counterspell* or *Shield* in response to the spell's trigger, using the same spellcasting ability as Spellcasting.
    limitedUse:
      count: 3
      reset: day
    spellcasting:
      ability: int
      spellLists: []
---

# Mage
*Small, Humanoid, Neutral Neutral*

**AC** 15
**HP** 81 (18d8)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common and any three languages
CR 6, PB +3, XP 2300

## Actions

**Multiattack**
The mage makes three Arcane Burst attacks.

**Arcane Burst**
*Melee or Ranged Attack Roll:* +6, reach 5 ft. or range 120 ft. 16 (3d8 + 3) Force damage.

**Spellcasting**
The mage casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 14): - **At Will:** *Detect Magic*, *Light*, *Mage Armor*, *Mage Hand*, *Prestidigitation* - **2e/Day Each:** *Fireball*, *Invisibility* - **1e/Day Each:** *Cone of Cold*, *Fly*

## Bonus Actions

**Misty Step (3/Day)**
The mage casts *Misty Step*, using the same spellcasting ability as Spellcasting.

## Reactions

**Protective Magic (3/Day)**
The mage casts *Counterspell* or *Shield* in response to the spell's trigger, using the same spellcasting ability as Spellcasting.
