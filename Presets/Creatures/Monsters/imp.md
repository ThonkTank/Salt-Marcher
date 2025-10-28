---
smType: creature
name: Imp
size: Small
type: Fiend
typeTags:
  - value: Devil
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '13'
initiative: +3 (13)
hp: '21'
hitDice: 6d4 + 6
speeds:
  walk:
    distance: 20 ft.
  fly:
    distance: 40 ft.
abilities:
  - key: str
    score: 6
    saveProf: false
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 14
    saveProf: false
pb: '+2'
skills:
  - skill: Deception
    value: '4'
  - skill: Insight
    value: '3'
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision 120 ft. (unimpeded by magical darkness)
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Common
  - value: Infernal
damageResistancesList:
  - value: Cold
damageImmunitiesList:
  - value: Fire
  - value: Poison; Poisoned
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The imp has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Sting
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Piercing damage plus 7 (2d6) Poison damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Piercing
          average: 6
        - dice: 2d6
          bonus: 0
          type: Poison
          average: 7
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Shape-Shift
    entryType: special
    text: The imp shape-shifts to resemble a rat (Speed 20 ft.), a raven (20 ft., Fly 60 ft.), or a spider (20 ft., Climb 20 ft.), or it returns to its true form. Its statistics are the same in each form, except for its Speed. Any equipment it is wearing or carrying isn't transformed.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Invisibility
    entryType: spellcasting
    text: The imp casts *Invisibility* on itself, requiring no spell components and using Charisma as the spellcasting ability. - **At Will:** *Invisibility*
    spellcasting:
      ability: cha
      spellLists:
        - frequency: at-will
          spells:
            - Invisibility
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Imp
*Small, Fiend, Lawful Evil*

**AC** 13
**HP** 21 (6d4 + 6)
**Initiative** +3 (13)
**Speed** 20 ft., fly 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft. (unimpeded by magical darkness); Passive Perception 11
**Languages** Common, Infernal
CR 1, PB +2, XP 200

## Traits

**Magic Resistance**
The imp has Advantage on saving throws against spells and other magical effects.

## Actions

**Sting**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Piercing damage plus 7 (2d6) Poison damage.

**Shape-Shift**
The imp shape-shifts to resemble a rat (Speed 20 ft.), a raven (20 ft., Fly 60 ft.), or a spider (20 ft., Climb 20 ft.), or it returns to its true form. Its statistics are the same in each form, except for its Speed. Any equipment it is wearing or carrying isn't transformed.

**Invisibility**
The imp casts *Invisibility* on itself, requiring no spell components and using Charisma as the spellcasting ability. - **At Will:** *Invisibility*
