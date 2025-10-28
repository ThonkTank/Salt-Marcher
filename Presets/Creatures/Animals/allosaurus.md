---
smType: creature
name: Allosaurus
size: Large
type: Beast
typeTags:
  - value: Dinosaur
alignmentOverride: Unaligned
ac: '13'
initiative: +1 (11)
hp: '51'
hitDice: 6d10 + 18
speeds:
  walk:
    distance: 60 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
passivesList:
  - skill: Perception
    value: '15'
cr: '2'
xp: '450'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 15 (2d10 + 4) Piercing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d10
          bonus: 4
          type: Piercing
          average: 15
      reach: 5 ft.
  - category: action
    name: Claws
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 8 (1d8 + 4) Slashing damage. If the target is a Large or smaller creature and the allosaurus moved 30+ feet straight toward it immediately before the hit, the target has the Prone condition, and the allosaurus can make one Bite attack against it.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d8
          bonus: 4
          type: Slashing
          average: 8
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
        other: If the target is a Large or smaller creature and the allosaurus moved 30+ feet straight toward it immediately before the hit, the target has the Prone condition, and the allosaurus can make one Bite attack against it.
      additionalEffects: If the target is a Large or smaller creature and the allosaurus moved 30+ feet straight toward it immediately before the hit, the target has the Prone condition, and the allosaurus can make one Bite attack against it.
---

# Allosaurus
*Large, Beast, Unaligned*

**AC** 13
**HP** 51 (6d10 + 18)
**Initiative** +1 (11)
**Speed** 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 2, PB +2, XP 450

## Actions

**Bite**
*Melee Attack Roll:* +6, reach 5 ft. 15 (2d10 + 4) Piercing damage.

**Claws**
*Melee Attack Roll:* +6, reach 5 ft. 8 (1d8 + 4) Slashing damage. If the target is a Large or smaller creature and the allosaurus moved 30+ feet straight toward it immediately before the hit, the target has the Prone condition, and the allosaurus can make one Bite attack against it.
