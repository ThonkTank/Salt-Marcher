---
smType: creature
name: Berserker
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '13'
initiative: +1 (11)
hp: '67'
hitDice: 9d8 + 27
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 9
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 9
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Bloodied Frenzy
    entryType: special
    text: While Bloodied, the berserker has Advantage on attack rolls and saving throws.
  - category: action
    name: Greataxe
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 9 (1d12 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d12
          bonus: 3
          type: Slashing
          average: 9
      reach: 5 ft.
---

# Berserker
*Small, Humanoid, Neutral Neutral*

**AC** 13
**HP** 67 (9d8 + 27)
**Initiative** +1 (11)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common
CR 2, PB +2, XP 450

## Traits

**Bloodied Frenzy**
While Bloodied, the berserker has Advantage on attack rolls and saving throws.

## Actions

**Greataxe**
*Melee Attack Roll:* +5, reach 5 ft. 9 (1d12 + 3) Slashing damage.
