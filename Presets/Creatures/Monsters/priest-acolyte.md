---
smType: creature
name: Priest Acolyte
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '13'
initiative: +0 (10)
hp: '11'
hitDice: 2d8 + 2
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+2'
skills:
  - skill: Medicine
    value: '4'
  - skill: Religion
    value: '2'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Common
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Mace
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Bludgeoning damage plus 2 (1d4) Radiant damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Bludgeoning
          average: 5
        - dice: 1d4
          bonus: 0
          type: Radiant
          average: 2
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Radiant Flame
    entryType: attack
    text: '*Ranged Attack Roll:* +4, range 60 ft. 7 (2d6) Radiant damage.'
    attack:
      type: ranged
      bonus: 4
      damage:
        - dice: 2d6
          bonus: 0
          type: Radiant
          average: 7
      range: 60 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The priest casts one of the following spells, using Wisdom as the spellcasting ability: - **At Will:** *Light*, *Thaumaturgy*'
    spellcasting:
      ability: wis
      spellLists:
        - frequency: at-will
          spells:
            - Light
            - Thaumaturgy
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Divine Aid (1/Day)
    entryType: spellcasting
    text: The priest casts *Bless*, *Healing Word*, or *Sanctuary*, using the same spellcasting ability as Spellcasting.
    limitedUse:
      count: 1
      reset: day
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Priest Acolyte
*Small, Humanoid, Neutral Neutral*

**AC** 13
**HP** 11 (2d8 + 2)
**Initiative** +0 (10)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common
CR 1/4, PB +2, XP 50

## Actions

**Mace**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Bludgeoning damage plus 2 (1d4) Radiant damage.

**Radiant Flame**
*Ranged Attack Roll:* +4, range 60 ft. 7 (2d6) Radiant damage.

**Spellcasting**
The priest casts one of the following spells, using Wisdom as the spellcasting ability: - **At Will:** *Light*, *Thaumaturgy*

## Bonus Actions

**Divine Aid (1/Day)**
The priest casts *Bless*, *Healing Word*, or *Sanctuary*, using the same spellcasting ability as Spellcasting.
