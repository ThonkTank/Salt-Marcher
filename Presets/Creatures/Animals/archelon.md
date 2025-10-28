---
smType: creature
name: Archelon
size: Huge
type: Beast
typeTags:
  - value: Dinosaur
alignmentOverride: Unaligned
ac: '17'
initiative: +3 (13)
hp: '90'
hitDice: 12d12 + 12
speeds:
  walk:
    distance: 20 ft.
  swim:
    distance: 80 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 4
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '5'
passivesList:
  - skill: Perception
    value: '12'
cr: '4'
xp: '1100'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The archelon can breathe air and water.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The archelon makes two Bite attacks.
    multiattack:
      attacks:
        - name: Bite
          count: 2
        - name: Bite
          count: 2
      substitutions: []
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 14 (3d6 + 4) Piercing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 3d6
          bonus: 4
          type: Piercing
          average: 14
      reach: 5 ft.
---

# Archelon
*Huge, Beast, Unaligned*

**AC** 17
**HP** 90 (12d12 + 12)
**Initiative** +3 (13)
**Speed** 20 ft., swim 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 4, PB +2, XP 1100

## Traits

**Amphibious**
The archelon can breathe air and water.

## Actions

**Multiattack**
The archelon makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +6, reach 5 ft. 14 (3d6 + 4) Piercing damage.
