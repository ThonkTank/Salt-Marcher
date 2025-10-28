---
smType: creature
name: Grimlock
size: Medium
type: Aberration
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '11'
initiative: +1 (11)
hp: '11'
hitDice: 2d8 + 2
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 9
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
skills:
  - skill: Athletics
    value: '5'
  - skill: Perception
    value: '3'
  - skill: Stealth
    value: '5'
sensesList:
  - type: blindsight
    range: '30'
passivesList:
  - skill: Perception
    value: '13'
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Bone Cudgel
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Bludgeoning damage plus 2 (1d4) Psychic damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Bludgeoning
          average: 6
        - dice: 1d4
          bonus: 0
          type: Psychic
          average: 2
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Grimlock
*Medium, Aberration, Neutral Evil*

**AC** 11
**HP** 11 (2d8 + 2)
**Initiative** +1 (11)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft.; Passive Perception 13
CR 1/4, PB +2, XP 50

## Actions

**Bone Cudgel**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Bludgeoning damage plus 2 (1d4) Psychic damage.
