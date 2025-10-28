---
smType: creature
name: Rhinoceros
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: '-1 (9)'
hp: '45'
hitDice: 6d10 + 12
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 21
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '11'
cr: '2'
xp: '450'
entries:
  - category: action
    name: Gore
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 14 (2d8 + 5) Piercing damage. If target is a Large or smaller creature and the rhinoceros moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the Prone condition.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d8
          bonus: 5
          type: Piercing
          average: 14
        - dice: 2d8
          bonus: 0
          type: Piercing
          average: 9
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
        other: If target is a Large or smaller creature and the rhinoceros moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the Prone condition.
      additionalEffects: If target is a Large or smaller creature and the rhinoceros moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the Prone condition.
---

# Rhinoceros
*Large, Beast, Unaligned*

**AC** 13
**HP** 45 (6d10 + 12)
**Initiative** -1 (9)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 2, PB +2, XP 450

## Actions

**Gore**
*Melee Attack Roll:* +7, reach 5 ft. 14 (2d8 + 5) Piercing damage. If target is a Large or smaller creature and the rhinoceros moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the Prone condition.
