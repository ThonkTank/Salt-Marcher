---
smType: creature
name: Triceratops
size: Huge
type: Beast
typeTags:
  - value: Dinosaur
alignmentOverride: Unaligned
ac: '14'
initiative: '-1 (9)'
hp: '114'
hitDice: 12d12 + 36
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 22
    saveProf: false
  - key: dex
    score: 9
    saveProf: false
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+3'
passivesList:
  - skill: Perception
    value: '10'
cr: '5'
xp: '1800'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The triceratops makes two Gore attacks.
    multiattack:
      attacks:
        - name: Gore
          count: 2
        - name: Gore
          count: 2
      substitutions: []
  - category: action
    name: Gore
    entryType: attack
    text: '*Melee Attack Roll:* +9, reach 5 ft. 19 (2d12 + 6) Piercing damage. If the target is Huge or smaller and the triceratops moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the Prone condition.'
    attack:
      type: melee
      bonus: 9
      damage:
        - dice: 2d12
          bonus: 6
          type: Piercing
          average: 19
        - dice: 2d8
          bonus: 0
          type: Piercing
          average: 9
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Huge or smaller
        other: If the target is Huge or smaller and the triceratops moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the Prone condition.
      additionalEffects: If the target is Huge or smaller and the triceratops moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the Prone condition.
---

# Triceratops
*Huge, Beast, Unaligned*

**AC** 14
**HP** 114 (12d12 + 36)
**Initiative** -1 (9)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 5, PB +3, XP 1800

## Actions

**Multiattack**
The triceratops makes two Gore attacks.

**Gore**
*Melee Attack Roll:* +9, reach 5 ft. 19 (2d12 + 6) Piercing damage. If the target is Huge or smaller and the triceratops moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the Prone condition.
