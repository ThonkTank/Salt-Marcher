---
smType: creature
name: Archmage
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '17'
initiative: +6 (16)
hp: '170'
hitDice: 31d8 + 31
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 20
    saveProf: true
    saveMod: 9
  - key: wis
    score: 15
    saveProf: true
    saveMod: 6
  - key: cha
    score: 16
    saveProf: false
pb: '+4'
skills:
  - skill: Arcana
    value: '13'
  - skill: History
    value: '9'
  - skill: Perception
    value: '6'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Common plus five other languages
damageImmunitiesList:
  - value: Psychic; Charmed ((with Mind Blank))
cr: '12'
xp: '8400'
entries:
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The archmage has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The archmage makes four Arcane Burst attacks.
    multiattack:
      attacks:
        - name: Burst
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Arcane Burst
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +9, reach 5 ft. or range 150 ft. 27 (4d10 + 5) Force damage.'
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The archmage casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 17): - **At Will:** *Detect Magic*, *Detect Thoughts*, *Disguise Self*, *Invisibility*, *Light*, *Mage Armor*, *Mage Hand*, *Prestidigitation* - **2e/Day Each:** *Fly*, *Lightning Bolt* - **1e/Day Each:** *Cone of Cold*, *Mind Blank*, *Scrying*, *Teleport*'
    spellcasting:
      ability: int
      saveDC: 17
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Detect Thoughts
            - Disguise Self
            - Invisibility
            - Light
            - Mage Armor
            - Mage Hand
            - Prestidigitation
        - frequency: 2/day
          spells:
            - Fly
            - Lightning Bolt
        - frequency: 1/day
          spells:
            - Cone of Cold
            - Mind Blank
            - Scrying
            - Teleport
    trigger.activation: action
    trigger.targeting:
      type: single
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
    trigger.activation: bonus
    trigger.targeting:
      type: single
  - category: reaction
    name: Protective Magic (3/Day)
    entryType: spellcasting
    text: The archmage casts *Counterspell* or *Shield* in response to the spell's trigger, using the same spellcasting ability as Spellcasting.
    limitedUse:
      count: 3
      reset: day
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: reaction
    trigger.targeting:
      type: single
    trigger.reactionTrigger: the spell's trigger
---

# Archmage
*Small, Humanoid, Neutral Neutral*

**AC** 17
**HP** 170 (31d8 + 31)
**Initiative** +6 (16)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common plus five other languages
CR 12, PB +4, XP 8400

## Traits

**Magic Resistance**
The archmage has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The archmage makes four Arcane Burst attacks.

**Arcane Burst**
*Melee or Ranged Attack Roll:* +9, reach 5 ft. or range 150 ft. 27 (4d10 + 5) Force damage.

**Spellcasting**
The archmage casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 17): - **At Will:** *Detect Magic*, *Detect Thoughts*, *Disguise Self*, *Invisibility*, *Light*, *Mage Armor*, *Mage Hand*, *Prestidigitation* - **2e/Day Each:** *Fly*, *Lightning Bolt* - **1e/Day Each:** *Cone of Cold*, *Mind Blank*, *Scrying*, *Teleport*

## Bonus Actions

**Misty Step (3/Day)**
The mage casts *Misty Step*, using the same spellcasting ability as Spellcasting.

## Reactions

**Protective Magic (3/Day)**
The archmage casts *Counterspell* or *Shield* in response to the spell's trigger, using the same spellcasting ability as Spellcasting.
