---
smType: creature
name: Priest
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '13'
initiative: +0 (10)
hp: '38'
hitDice: 7d8 + 7
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 13
    saveProf: false
  - key: wis
    score: 16
    saveProf: false
  - key: cha
    score: 13
    saveProf: false
pb: '+2'
skills:
  - skill: Medicine
    value: '7'
  - skill: Perception
    value: '5'
  - skill: Religion
    value: '5'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Common plus one other language
cr: '2'
xp: '450'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The priest makes two attacks, using Mace or Radiant Flame in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Mace
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Bludgeoning damage plus 5 (2d4) Radiant damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Bludgeoning
          average: 6
        - dice: 2d4
          bonus: 0
          type: Radiant
          average: 5
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Radiant Flame
    entryType: attack
    text: '*Ranged Attack Roll:* +5, range 60 ft. 11 (2d10) Radiant damage.'
    attack:
      type: ranged
      bonus: 5
      damage:
        - dice: 2d10
          bonus: 0
          type: Radiant
          average: 11
      range: 60 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The priest casts one of the following spells, using Wisdom as the spellcasting ability: - **At Will:** *Light*, *Thaumaturgy* - **1/Day Each:** *Spirit Guardians*'
    spellcasting:
      ability: wis
      spellLists:
        - frequency: at-will
          spells:
            - Light
            - Thaumaturgy
        - frequency: 1/day
          spells:
            - Spirit Guardians
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Divine Aid (3/Day)
    entryType: spellcasting
    text: The priest casts *Bless*, *Dispel Magic*, *Healing Word*, or *Lesser Restoration*, using the same spellcasting ability as Spellcasting.
    limitedUse:
      count: 3
      reset: day
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Priest
*Small, Humanoid, Neutral Neutral*

**AC** 13
**HP** 38 (7d8 + 7)
**Initiative** +0 (10)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common plus one other language
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The priest makes two attacks, using Mace or Radiant Flame in any combination.

**Mace**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Bludgeoning damage plus 5 (2d4) Radiant damage.

**Radiant Flame**
*Ranged Attack Roll:* +5, range 60 ft. 11 (2d10) Radiant damage.

**Spellcasting**
The priest casts one of the following spells, using Wisdom as the spellcasting ability: - **At Will:** *Light*, *Thaumaturgy* - **1/Day Each:** *Spirit Guardians*

## Bonus Actions

**Divine Aid (3/Day)**
The priest casts *Bless*, *Dispel Magic*, *Healing Word*, or *Lesser Restoration*, using the same spellcasting ability as Spellcasting.
