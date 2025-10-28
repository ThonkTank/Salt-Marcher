---
smType: creature
name: Druid
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '13'
initiative: +1 (11)
hp: '44'
hitDice: 8d8 + 8
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
    score: 13
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 16
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+2'
skills:
  - skill: Medicine
    value: '5'
  - skill: Nature
    value: '3'
  - skill: Perception
    value: '5'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Common
  - value: Druidic
  - value: Sylvan
cr: '2'
xp: '450'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The druid makes two attacks, using Vine Staff or Verdant Wisp in any combination.
  - category: action
    name: Vine Staff
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Bludgeoning damage plus 2 (1d4) Poison damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Bludgeoning
          average: 7
        - dice: 1d4
          bonus: 0
          type: Poison
          average: 2
      reach: 5 ft.
  - category: action
    name: Verdant Wisp
    entryType: attack
    text: '*Ranged Attack Roll:* +5, range 90 ft. 10 (3d6) Radiant damage.'
    attack:
      type: ranged
      bonus: 5
      damage:
        - dice: 3d6
          bonus: 0
          type: Radiant
          average: 10
      range: 90 ft.
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The druid casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 13): - **At Will:** *Druidcraft*, *Speak with Animals* - **2e/Day Each:** *Entangle*, *Thunderwave* - **1e/Day Each:** *Animal Messenger*, *Longstrider*, *Moonbeam*'
    spellcasting:
      ability: wis
      saveDC: 13
      spellLists:
        - frequency: at-will
          spells:
            - Druidcraft
            - Speak with Animals
        - frequency: 2/day
          spells:
            - Entangle
            - Thunderwave
        - frequency: 1/day
          spells:
            - Animal Messenger
            - Longstrider
            - Moonbeam
---

# Druid
*Small, Humanoid, Neutral Neutral*

**AC** 13
**HP** 44 (8d8 + 8)
**Initiative** +1 (11)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common, Druidic, Sylvan
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The druid makes two attacks, using Vine Staff or Verdant Wisp in any combination.

**Vine Staff**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Bludgeoning damage plus 2 (1d4) Poison damage.

**Verdant Wisp**
*Ranged Attack Roll:* +5, range 90 ft. 10 (3d6) Radiant damage.

**Spellcasting**
The druid casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 13): - **At Will:** *Druidcraft*, *Speak with Animals* - **2e/Day Each:** *Entangle*, *Thunderwave* - **1e/Day Each:** *Animal Messenger*, *Longstrider*, *Moonbeam*
