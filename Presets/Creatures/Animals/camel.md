---
smType: creature
name: Camel
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '10'
initiative: '-1 (9)'
hp: '17'
hitDice: 2d10 + 6
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 17
    saveProf: true
    saveMod: 5
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
cr: 1/8
xp: '25'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d4
          bonus: 2
          type: Bludgeoning
          average: 4
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Camel
*Large, Beast, Unaligned*

**AC** 10
**HP** 17 (2d10 + 6)
**Initiative** -1 (9)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
CR 1/8, PB +2, XP 25

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Bludgeoning damage.
