---
smType: creature
name: Ochre Jelly
size: Large
type: Ooze
alignmentOverride: Unaligned
ac: '8'
initiative: '-2 (8)'
hp: '52'
hitDice: 7d10 + 14
speeds:
  walk:
    distance: 20 ft.
  climb:
    distance: 20 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 6
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 6
    saveProf: false
  - key: cha
    score: 1
    saveProf: false
pb: '+2'
sensesList:
  - type: blindsight
    range: '60'
passivesList:
  - skill: Perception
    value: '8'
damageResistancesList:
  - value: Acid
damageImmunitiesList:
  - value: Lightning
  - value: Slashing; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Deafened
  - value: Frightened
  - value: Grappled
  - value: Prone
  - value: Restrained
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Amorphous
    entryType: special
    text: The jelly can move through a space as narrow as 1 inch without expending extra movement to do so.
  - category: trait
    name: Spider Climb
    entryType: special
    text: The jelly can climb difficult surfaces, including along ceilings, without needing to make an ability check.
  - category: action
    name: Pseudopod
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 12 (3d6 + 2) Acid damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 3d6
          bonus: 2
          type: Acid
          average: 12
      reach: 5 ft.
---

# Ochre Jelly
*Large, Ooze, Unaligned*

**AC** 8
**HP** 52 (7d10 + 14)
**Initiative** -2 (8)
**Speed** 20 ft., climb 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft.; Passive Perception 8
CR 2, PB +2, XP 450

## Traits

**Amorphous**
The jelly can move through a space as narrow as 1 inch without expending extra movement to do so.

**Spider Climb**
The jelly can climb difficult surfaces, including along ceilings, without needing to make an ability check.

## Actions

**Pseudopod**
*Melee Attack Roll:* +4, reach 5 ft. 12 (3d6 + 2) Acid damage.
