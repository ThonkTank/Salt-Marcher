---
smType: creature
name: Mastiff
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '5'
hitDice: 1d8 + 1
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 13
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
cr: 1/8
xp: '25'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 4 (1d6 + 1) Piercing damage. If the target is a Medium or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 1d6
          bonus: 1
          type: Piercing
          average: 4
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Medium or smaller
        other: If the target is a Medium or smaller creature, it has the Prone condition.
      additionalEffects: If the target is a Medium or smaller creature, it has the Prone condition.
---

# Mastiff
*Medium, Beast, Unaligned*

**AC** 12
**HP** 5 (1d8 + 1)
**Initiative** +2 (12)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
CR 1/8, PB +2, XP 25

## Actions

**Bite**
*Melee Attack Roll:* +3, reach 5 ft. 4 (1d6 + 1) Piercing damage. If the target is a Medium or smaller creature, it has the Prone condition.
