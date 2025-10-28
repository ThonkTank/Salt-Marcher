---
smType: creature
name: Blood Hawk
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '7'
hitDice: 2d6
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 6
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '6'
passivesList:
  - skill: Perception
    value: '16'
cr: 1/8
xp: '25'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The hawk has Advantage on an attack roll against a creature if at least one of the hawk's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Beak
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Piercing damage, or 6 (1d8 + 2) Piercing damage if the target is Bloodied.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d4
          bonus: 2
          type: Piercing
          average: 4
        - dice: 1d8
          bonus: 2
          type: Piercing
          average: 6
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Blood Hawk
*Small, Beast, Unaligned*

**AC** 12
**HP** 7 (2d6)
**Initiative** +2 (12)
**Speed** 10 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/8, PB +2, XP 25

## Traits

**Pack Tactics**
The hawk has Advantage on an attack roll against a creature if at least one of the hawk's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Beak**
*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Piercing damage, or 6 (1d8 + 2) Piercing damage if the target is Bloodied.
