---
smType: creature
name: Elk
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '10'
initiative: +0 (10)
hp: '11'
hitDice: 2d10
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '12'
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Ram
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Bludgeoning damage. If the target is a Large or smaller creature and the elk moved 20+ feet straight toward it immediately before the hit, the target takes an extra 3 (1d6) Bludgeoning damage and has the Prone condition.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Bludgeoning
          average: 6
        - dice: 1d6
          bonus: 0
          type: Bludgeoning
          average: 3
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
        other: If the target is a Large or smaller creature and the elk moved 20+ feet straight toward it immediately before the hit, the target takes an extra 3 (1d6) Bludgeoning damage and has the Prone condition.
      additionalEffects: If the target is a Large or smaller creature and the elk moved 20+ feet straight toward it immediately before the hit, the target takes an extra 3 (1d6) Bludgeoning damage and has the Prone condition.
---

# Elk
*Large, Beast, Unaligned*

**AC** 10
**HP** 11 (2d10)
**Initiative** +0 (10)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 12
CR 1/4, PB +2, XP 50

## Actions

**Ram**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Bludgeoning damage. If the target is a Large or smaller creature and the elk moved 20+ feet straight toward it immediately before the hit, the target takes an extra 3 (1d6) Bludgeoning damage and has the Prone condition.
