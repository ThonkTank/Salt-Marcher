---
smType: creature
name: Giant Boar
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +0 (10)
hp: '42'
hitDice: 5d10 + 15
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 17
    saveProf: true
    saveMod: 5
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 7
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '8'
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Bloodied Fury
    entryType: special
    text: The boar has Advantage on melee attack rolls while it is Bloodied.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Gore
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage. If the target is a Large or smaller creature and the boar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 7 (2d6) Piercing damage and has the Prone condition.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Piercing
          average: 10
        - dice: 2d6
          bonus: 0
          type: Piercing
          average: 7
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
        other: If the target is a Large or smaller creature and the boar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 7 (2d6) Piercing damage and has the Prone condition.
      additionalEffects: If the target is a Large or smaller creature and the boar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 7 (2d6) Piercing damage and has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Boar
*Large, Beast, Unaligned*

**AC** 13
**HP** 42 (5d10 + 15)
**Initiative** +0 (10)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 2, PB +2, XP 450

## Traits

**Bloodied Fury**
The boar has Advantage on melee attack rolls while it is Bloodied.

## Actions

**Gore**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage. If the target is a Large or smaller creature and the boar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 7 (2d6) Piercing damage and has the Prone condition.
