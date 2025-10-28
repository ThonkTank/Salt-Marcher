---
smType: creature
name: Plesiosaurus
size: Large
type: Beast
typeTags:
  - value: Dinosaur
alignmentOverride: Unaligned
ac: '13'
initiative: +2 (12)
hp: '68'
hitDice: 8d10 + 24
speeds:
  walk:
    distance: 20 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 16
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
    value: '3'
  - skill: Stealth
    value: '4'
passivesList:
  - skill: Perception
    value: '13'
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Hold Breath
    entryType: special
    text: The plesiosaurus can hold its breath for 1 hour.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 11 (2d6 + 4) Piercing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d6
          bonus: 4
          type: Piercing
          average: 11
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Plesiosaurus
*Large, Beast, Unaligned*

**AC** 13
**HP** 68 (8d10 + 24)
**Initiative** +2 (12)
**Speed** 20 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 2, PB +2, XP 450

## Traits

**Hold Breath**
The plesiosaurus can hold its breath for 1 hour.

## Actions

**Bite**
*Melee Attack Roll:* +6, reach 10 ft. 11 (2d6 + 4) Piercing damage.
