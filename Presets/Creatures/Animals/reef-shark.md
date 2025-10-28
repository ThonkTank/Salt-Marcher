---
smType: creature
name: Reef Shark
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '22'
hitDice: 4d8 + 4
speeds:
  walk:
    distance: 5 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 4
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '2'
sensesList:
  - type: blindsight
    range: '30'
passivesList:
  - skill: Perception
    value: '12'
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The shark has Advantage on an attack roll against a creature if at least one of the shark's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
  - category: trait
    name: Water Breathing
    entryType: special
    text: The shark can breathe only underwater.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 7 (2d4 + 2) Piercing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d4
          bonus: 2
          type: Piercing
          average: 7
      reach: 5 ft.
---

# Reef Shark
*Medium, Beast, Unaligned*

**AC** 12
**HP** 22 (4d8 + 4)
**Initiative** +2 (12)
**Speed** 5 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft.; Passive Perception 12
CR 1/2, PB +2, XP 100

## Traits

**Pack Tactics**
The shark has Advantage on an attack roll against a creature if at least one of the shark's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

**Water Breathing**
The shark can breathe only underwater.

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 7 (2d4 + 2) Piercing damage.
