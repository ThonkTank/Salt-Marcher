---
smType: creature
name: Jackal
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '3'
hitDice: 1d6
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 8
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 11
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
    range: '90'
passivesList:
  - skill: Perception
    value: '15'
cr: '0'
xp: '0'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +1, reach 5 ft. 1 (1d4 - 1) Piercing damage.'
    attack:
      type: melee
      bonus: 1
      damage:
        - dice: 1d4
          bonus: 0
          type: Piercing
          average: 1
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Jackal
*Small, Beast, Unaligned*

**AC** 12
**HP** 3 (1d6)
**Initiative** +2 (12)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 90 ft.; Passive Perception 15
CR 0, PB +2, XP 0

## Actions

**Bite**
*Melee Attack Roll:* +1, reach 5 ft. 1 (1d4 - 1) Piercing damage.
