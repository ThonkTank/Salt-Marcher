---
smType: creature
name: Warhorse
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '19'
hitDice: 3d10 + 3
speeds:
  walk:
    distance: 60 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: true
    saveMod: 3
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '11'
cr: 1/2
xp: '100'
entries:
  - category: action
    name: Hooves
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 9 (2d4 + 4) Bludgeoning damage. If the target is a Large or smaller creature and the horse moved 20+ feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the Prone condition.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d4
          bonus: 4
          type: Bludgeoning
          average: 9
        - dice: 2d4
          bonus: 0
          type: Bludgeoning
          average: 5
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
        other: If the target is a Large or smaller creature and the horse moved 20+ feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the Prone condition.
      additionalEffects: If the target is a Large or smaller creature and the horse moved 20+ feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the Prone condition.
---

# Warhorse
*Large, Beast, Unaligned*

**AC** 11
**HP** 19 (3d10 + 3)
**Initiative** +1 (11)
**Speed** 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/2, PB +2, XP 100

## Actions

**Hooves**
*Melee Attack Roll:* +6, reach 5 ft. 9 (2d4 + 4) Bludgeoning damage. If the target is a Large or smaller creature and the horse moved 20+ feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the Prone condition.
