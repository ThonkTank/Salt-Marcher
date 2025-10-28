---
smType: creature
name: Hippopotamus
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '14'
initiative: '-2 (8)'
hp: '82'
hitDice: 11d10 + 22
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 21
    saveProf: true
    saveMod: 7
  - key: dex
    score: 7
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 4
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '3'
passivesList:
  - skill: Perception
    value: '13'
cr: '4'
xp: '1100'
entries:
  - category: trait
    name: Hold Breath
    entryType: special
    text: The hippopotamus can hold its breath for 10 minutes.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The hippopotamus makes two Bite attacks.
    multiattack:
      attacks:
        - name: Bite
          count: 2
        - name: Bite
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 16 (2d10 + 5) Piercing damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d10
          bonus: 5
          type: Piercing
          average: 16
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Hippopotamus
*Large, Beast, Unaligned*

**AC** 14
**HP** 82 (11d10 + 22)
**Initiative** -2 (8)
**Speed** 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 4, PB +2, XP 1100

## Traits

**Hold Breath**
The hippopotamus can hold its breath for 10 minutes.

## Actions

**Multiattack**
The hippopotamus makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +7, reach 5 ft. 16 (2d10 + 5) Piercing damage.
