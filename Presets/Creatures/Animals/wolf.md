---
smType: creature
name: Wolf
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '11'
hitDice: 2d8 + 2
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 15
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
    score: 6
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
  - skill: Stealth
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
cr: 1/4
xp: '50'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The wolf has Advantage on attack rolls against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage. If the target is a Medium or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Piercing
          average: 5
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Medium or smaller
        other: If the target is a Medium or smaller creature, it has the Prone condition.
      additionalEffects: If the target is a Medium or smaller creature, it has the Prone condition.
---

# Wolf
*Medium, Beast, Unaligned*

**AC** 12
**HP** 11 (2d8 + 2)
**Initiative** +2 (12)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
CR 1/4, PB +2, XP 50

## Traits

**Pack Tactics**
The wolf has Advantage on attack rolls against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage. If the target is a Medium or smaller creature, it has the Prone condition.
