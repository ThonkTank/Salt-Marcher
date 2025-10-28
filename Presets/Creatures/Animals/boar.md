---
smType: creature
name: Boar
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +0 (10)
hp: '13'
hitDice: 2d8 + 4
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 13
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 9
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '9'
cr: 1/4
xp: '50'
entries:
  - category: trait
    name: Bloodied Fury
    entryType: special
    text: While Bloodied, the boar has Advantage on attack rolls.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Gore
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 4 (1d6 + 1) Piercing damage. If the target is a Medium or smaller creature and the boar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 3 (1d6) Piercing damage and has the Prone condition.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 1d6
          bonus: 1
          type: Piercing
          average: 4
        - dice: 1d6
          bonus: 0
          type: Piercing
          average: 3
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Medium or smaller
        other: If the target is a Medium or smaller creature and the boar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 3 (1d6) Piercing damage and has the Prone condition.
      additionalEffects: If the target is a Medium or smaller creature and the boar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 3 (1d6) Piercing damage and has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Boar
*Medium, Beast, Unaligned*

**AC** 11
**HP** 13 (2d8 + 4)
**Initiative** +0 (10)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/4, PB +2, XP 50

## Traits

**Bloodied Fury**
While Bloodied, the boar has Advantage on attack rolls.

## Actions

**Gore**
*Melee Attack Roll:* +3, reach 5 ft. 4 (1d6 + 1) Piercing damage. If the target is a Medium or smaller creature and the boar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 3 (1d6) Piercing damage and has the Prone condition.
