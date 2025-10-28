---
smType: creature
name: Pegasus
size: Large
type: Celestial
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: '12'
initiative: +2 (12)
hp: '59'
hitDice: 7d10 + 21
speeds:
  walk:
    distance: 60 ft.
  fly:
    distance: 90 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 15
    saveProf: true
    saveMod: 4
  - key: con
    score: 16
    saveProf: true
    saveMod: 5
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 4
  - key: cha
    score: 13
    saveProf: true
    saveMod: 3
pb: '+2'
skills:
  - skill: Perception
    value: '6'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Understands Celestial
  - value: Common
  - value: Elvish
  - value: And Sylvan but can't speak
cr: '2'
xp: '450'
entries:
  - category: action
    name: Hooves
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 7 (1d6 + 4) Bludgeoning damage plus 5 (2d4) Radiant damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d6
          bonus: 4
          type: Bludgeoning
          average: 7
        - dice: 2d4
          bonus: 0
          type: Radiant
          average: 5
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Pegasus
*Large, Celestial, Chaotic Good*

**AC** 12
**HP** 59 (7d10 + 21)
**Initiative** +2 (12)
**Speed** 60 ft., fly 90 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Understands Celestial, Common, Elvish, And Sylvan but can't speak
CR 2, PB +2, XP 450

## Actions

**Hooves**
*Melee Attack Roll:* +6, reach 5 ft. 7 (1d6 + 4) Bludgeoning damage plus 5 (2d4) Radiant damage.
