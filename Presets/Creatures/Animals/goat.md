---
smType: creature
name: Goat
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '10'
initiative: +0 (10)
hp: '4'
hitDice: 1d8
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 11
    saveProf: true
    saveMod: 2
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '12'
cr: '0'
xp: '0'
entries:
  - category: action
    name: Ram
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 1 Bludgeoning damage, or 2 (1d4) Bludgeoning damage if the goat moved 20+ feet straight toward the target immediately before the hit.'
    attack:
      type: melee
      bonus: 2
      damage:
        - dice: 1d4
          bonus: 0
          type: Bludgeoning
          average: 2
      reach: 5 ft.
---

# Goat
*Medium, Beast, Unaligned*

**AC** 10
**HP** 4 (1d8)
**Initiative** +0 (10)
**Speed** 40 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 12
CR 0, PB +2, XP 0

## Actions

**Ram**
*Melee Attack Roll:* +2, reach 5 ft. 1 Bludgeoning damage, or 2 (1d4) Bludgeoning damage if the goat moved 20+ feet straight toward the target immediately before the hit.
