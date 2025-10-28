---
smType: creature
name: Spider
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '1'
hitDice: 1d4 - 1
speeds:
  walk:
    distance: 20 ft.
  climb:
    distance: 20 ft.
abilities:
  - key: str
    score: 2
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 8
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 2
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '4'
sensesList:
  - type: darkvision
    range: '30'
passivesList:
  - skill: Perception
    value: '10'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Spider Climb
    entryType: special
    text: The spider can climb difficult surfaces, including along ceilings, without needing to make an ability check.
  - category: trait
    name: Web Walker
    entryType: special
    text: The spider ignores movement restrictions caused by webs, and the spider knows the location of any other creature in contact with the same web.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 1 Piercing damage plus 2 (1d4) Poison damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d4
          bonus: 0
          type: Poison
          average: 2
      reach: 5 ft.
---

# Spider
*Small, Beast, Unaligned*

**AC** 12
**HP** 1 (1d4 - 1)
**Initiative** +2 (12)
**Speed** 20 ft., climb 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 30 ft.; Passive Perception 10
CR 0, PB +2, XP 0

## Traits

**Spider Climb**
The spider can climb difficult surfaces, including along ceilings, without needing to make an ability check.

**Web Walker**
The spider ignores movement restrictions caused by webs, and the spider knows the location of any other creature in contact with the same web.

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 1 Piercing damage plus 2 (1d4) Poison damage.
