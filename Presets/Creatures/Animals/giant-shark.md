---
smType: creature
name: Giant Shark
size: Huge
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '92'
hitDice: 8d12 + 40
speeds:
  walk:
    distance: 5 ft.
  swim:
    distance: 60 ft.
abilities:
  - key: str
    score: 23
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 21
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '3'
sensesList:
  - type: blindsight
    range: '60'
passivesList:
  - skill: Perception
    value: '13'
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Water Breathing
    entryType: special
    text: The shark can breathe only underwater.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The shark makes two Bite attacks.
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
    text: '*Melee Attack Roll:* +9 (with Advantage if the target doesn''t have all its Hit Points), reach 5 ft. 22 (3d10 + 6) Piercing damage.'
    attack:
      type: melee
      bonus: 9
      damage:
        - dice: 3d10
          bonus: 6
          type: Piercing
          average: 22
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Shark
*Huge, Beast, Unaligned*

**AC** 13
**HP** 92 (8d12 + 40)
**Initiative** +3 (13)
**Speed** 5 ft., swim 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft.; Passive Perception 13
CR 5, PB +3, XP 1800

## Traits

**Water Breathing**
The shark can breathe only underwater.

## Actions

**Multiattack**
The shark makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +9 (with Advantage if the target doesn't have all its Hit Points), reach 5 ft. 22 (3d10 + 6) Piercing damage.
