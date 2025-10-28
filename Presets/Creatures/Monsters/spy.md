---
smType: creature
name: Spy
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '12'
initiative: +4 (14)
hp: '27'
hitDice: 6d8
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 16
    saveProf: false
pb: '+2'
skills:
  - skill: Deception
    value: '5'
  - skill: Insight
    value: '4'
  - skill: Investigation
    value: '5'
  - skill: Perception
    value: '6'
  - skill: Sleight of hand
    value: '4'
  - skill: Stealth
    value: '6'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Common plus one other language
cr: '1'
xp: '200'
entries:
  - category: action
    name: Shortsword
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 7 (2d6) Poison damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Piercing
          average: 5
        - dice: 2d6
          bonus: 0
          type: Poison
          average: 7
      reach: 5 ft.
  - category: action
    name: Hand Crossbow
    entryType: attack
    text: '*Ranged Attack Roll:* +4, range 30/120 ft. 5 (1d6 + 2) Piercing damage plus 7 (2d6) Poison damage.'
    attack:
      type: ranged
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Piercing
          average: 5
        - dice: 2d6
          bonus: 0
          type: Poison
          average: 7
      range: 30/120 ft.
  - category: bonus
    name: Cunning Action
    entryType: special
    text: The spy takes the Dash, Disengage, or Hide action.
---

# Spy
*Small, Humanoid, Neutral Neutral*

**AC** 12
**HP** 27 (6d8)
**Initiative** +4 (14)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common plus one other language
CR 1, PB +2, XP 200

## Actions

**Shortsword**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 7 (2d6) Poison damage.

**Hand Crossbow**
*Ranged Attack Roll:* +4, range 30/120 ft. 5 (1d6 + 2) Piercing damage plus 7 (2d6) Poison damage.

## Bonus Actions

**Cunning Action**
The spy takes the Dash, Disengage, or Hide action.
