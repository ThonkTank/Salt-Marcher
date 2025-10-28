---
smType: creature
name: Dryad
size: Medium
type: Fey
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '16'
initiative: +1 (11)
hp: '22'
hitDice: 5d8
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 14
    saveProf: false
  - key: wis
    score: 15
    saveProf: false
  - key: cha
    score: 18
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Elvish
  - value: Sylvan
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The dryad has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Speak with Beasts and Plants
    entryType: special
    text: The dryad can communicate with Beasts and Plants as if they shared a language.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dryad makes one Vine Lash or Thorn Burst attack, and it can use Spellcasting to cast *Charm Monster*.
    multiattack:
      attacks:
        - name: Burst
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Vine Lash
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 8 (1d8 + 4) Slashing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d8
          bonus: 4
          type: Slashing
          average: 8
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Thorn Burst
    entryType: attack
    text: '*Ranged Attack Roll:* +6, range 60 ft. 7 (1d6 + 4) Piercing damage.'
    attack:
      type: ranged
      bonus: 6
      damage:
        - dice: 1d6
          bonus: 4
          type: Piercing
          average: 7
      range: 60 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Tree Stride
    entryType: special
    text: If within 5 feet of a Large or bigger tree, the dryad teleports to an unoccupied space within 5 feet of a second Large or bigger tree that is within 60 feet of the previous tree.
    trigger.activation: bonus
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The dryad casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14): - **At Will:** *Animal Friendship*, *Charm Monster*, *Druidcraft* - **1e/Day Each:** *Entangle*, *Pass without Trace*'
    spellcasting:
      ability: cha
      saveDC: 14
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Animal Friendship
            - Charm Monster
            - Druidcraft
        - frequency: 1/day
          spells:
            - Entangle
            - Pass without Trace
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Dryad
*Medium, Fey, Neutral Neutral*

**AC** 16
**HP** 22 (5d8)
**Initiative** +1 (11)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Elvish, Sylvan
CR 1, PB +2, XP 200

## Traits

**Magic Resistance**
The dryad has Advantage on saving throws against spells and other magical effects.

**Speak with Beasts and Plants**
The dryad can communicate with Beasts and Plants as if they shared a language.

## Actions

**Multiattack**
The dryad makes one Vine Lash or Thorn Burst attack, and it can use Spellcasting to cast *Charm Monster*.

**Vine Lash**
*Melee Attack Roll:* +6, reach 10 ft. 8 (1d8 + 4) Slashing damage.

**Thorn Burst**
*Ranged Attack Roll:* +6, range 60 ft. 7 (1d6 + 4) Piercing damage.

**Spellcasting**
The dryad casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14): - **At Will:** *Animal Friendship*, *Charm Monster*, *Druidcraft* - **1e/Day Each:** *Entangle*, *Pass without Trace*

## Bonus Actions

**Tree Stride**
If within 5 feet of a Large or bigger tree, the dryad teleports to an unoccupied space within 5 feet of a second Large or bigger tree that is within 60 feet of the previous tree.
