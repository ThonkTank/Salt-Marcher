---
smType: creature
name: Dire Wolf
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '14'
initiative: +2 (12)
hp: '22'
hitDice: 3d10 + 6
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 15
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
  - skill: Stealth
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The wolf has Advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Piercing damage. If the target is a Large or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d10
          bonus: 3
          type: Piercing
          average: 8
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
        other: If the target is a Large or smaller creature, it has the Prone condition.
      additionalEffects: If the target is a Large or smaller creature, it has the Prone condition.
---

# Dire Wolf
*Large, Beast, Unaligned*

**AC** 14
**HP** 22 (3d10 + 6)
**Initiative** +2 (12)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
CR 1, PB +2, XP 200

## Traits

**Pack Tactics**
The wolf has Advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Piercing damage. If the target is a Large or smaller creature, it has the Prone condition.
