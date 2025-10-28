---
smType: creature
name: Cloud Giant
size: Huge
type: Giant
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '14'
initiative: +4 (14)
hp: '200'
hitDice: 16d12 + 96
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 20 ft.
    hover: true
abilities:
  - key: str
    score: 27
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 22
    saveProf: true
    saveMod: 10
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 16
    saveProf: true
    saveMod: 7
  - key: cha
    score: 16
    saveProf: false
pb: '+4'
skills:
  - skill: Insight
    value: '7'
  - skill: Perception
    value: '11'
passivesList:
  - skill: Perception
    value: '21'
languagesList:
  - value: Common
  - value: Giant
cr: '9'
xp: '5000'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The giant makes two attacks, using Thunderous Mace or Thundercloud in any combination. It can replace one attack with a use of Spellcasting to cast *Fog Cloud*.
    multiattack:
      attacks:
        - name: two
          count: 1
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            spell: Fog Cloud
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Thunderous Mace
    entryType: attack
    text: '*Melee Attack Roll:* +12, reach 10 ft. 21 (3d8 + 8) Bludgeoning damage plus 7 (2d6) Thunder damage.'
    attack:
      type: melee
      bonus: 12
      damage:
        - dice: 3d8
          bonus: 8
          type: Bludgeoning
          average: 21
        - dice: 2d6
          bonus: 0
          type: Thunder
          average: 7
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Thundercloud
    entryType: attack
    text: '*Ranged Attack Roll:* +12, range 240 ft. 18 (3d6 + 8) Thunder damage, and the target has the Incapacitated condition until the end of its next turn.'
    attack:
      type: ranged
      bonus: 12
      damage:
        - dice: 3d6
          bonus: 8
          type: Thunder
          average: 18
      range: 240 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The giant casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15): - **At Will:** *Detect Magic*, *Fog Cloud*, *Light* - **1e/Day Each:** *Control Weather*, *Gaseous Form*, *Telekinesis*'
    spellcasting:
      ability: cha
      saveDC: 15
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Fog Cloud
            - Light
        - frequency: 1/day
          spells:
            - Control Weather
            - Gaseous Form
            - Telekinesis
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Misty Step
    entryType: spellcasting
    text: The giant casts the *Misty Step* spell, using the same spellcasting ability as Spellcasting.
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Cloud Giant
*Huge, Giant, Neutral Neutral*

**AC** 14
**HP** 200 (16d12 + 96)
**Initiative** +4 (14)
**Speed** 40 ft., fly 20 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common, Giant
CR 9, PB +4, XP 5000

## Actions

**Multiattack**
The giant makes two attacks, using Thunderous Mace or Thundercloud in any combination. It can replace one attack with a use of Spellcasting to cast *Fog Cloud*.

**Thunderous Mace**
*Melee Attack Roll:* +12, reach 10 ft. 21 (3d8 + 8) Bludgeoning damage plus 7 (2d6) Thunder damage.

**Thundercloud**
*Ranged Attack Roll:* +12, range 240 ft. 18 (3d6 + 8) Thunder damage, and the target has the Incapacitated condition until the end of its next turn.

**Spellcasting**
The giant casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15): - **At Will:** *Detect Magic*, *Fog Cloud*, *Light* - **1e/Day Each:** *Control Weather*, *Gaseous Form*, *Telekinesis*

## Bonus Actions

**Misty Step**
The giant casts the *Misty Step* spell, using the same spellcasting ability as Spellcasting.
