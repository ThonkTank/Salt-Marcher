---
smType: creature
name: Giant Venomous Snake
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '14'
initiative: +4 (14)
hp: '11'
hitDice: 2d8 + 2
speeds:
  walk:
    distance: 40 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 18
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '2'
sensesList:
  - type: blindsight
    range: '10'
passivesList:
  - skill: Perception
    value: '12'
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 6 (1d4 + 4) Piercing damage plus 4 (1d8) Poison damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d4
          bonus: 4
          type: Piercing
          average: 6
        - dice: 1d8
          bonus: 0
          type: Poison
          average: 4
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Venomous Snake
*Medium, Beast, Unaligned*

**AC** 14
**HP** 11 (2d8 + 2)
**Initiative** +4 (14)
**Speed** 40 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft.; Passive Perception 12
CR 1/4, PB +2, XP 50

## Actions

**Bite**
*Melee Attack Roll:* +6, reach 10 ft. 6 (1d4 + 4) Piercing damage plus 4 (1d8) Poison damage.
