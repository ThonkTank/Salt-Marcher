---
smType: creature
name: Giant Centipede
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '14'
initiative: +2 (12)
hp: '9'
hitDice: 2d6 + 2
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 5
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 7
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '30'
passivesList:
  - skill: Perception
    value: '8'
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Piercing damage, and the target has the Poisoned condition until the start of the centipede''s next turn.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d4
          bonus: 2
          type: Piercing
          average: 4
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Centipede
*Small, Beast, Unaligned*

**AC** 14
**HP** 9 (2d6 + 2)
**Initiative** +2 (12)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft.; Passive Perception 8
CR 1/4, PB +2, XP 50

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Piercing damage, and the target has the Poisoned condition until the start of the centipede's next turn.
