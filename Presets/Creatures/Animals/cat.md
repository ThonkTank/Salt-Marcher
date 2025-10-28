---
smType: creature
name: Cat
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '2'
hitDice: 1d4
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 40 ft.
abilities:
  - key: str
    score: 3
    saveProf: false
  - key: dex
    score: 15
    saveProf: true
    saveMod: 4
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '3'
  - skill: Stealth
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '13'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Jumper
    entryType: special
    text: The cat's jump distance is determined using its Dexterity rather than its Strength.
  - category: action
    name: Scratch
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 1 Slashing damage.'
    attack:
      type: melee
      bonus: 4
      damage: []
      reach: 5 ft.
---

# Cat
*Small, Beast, Unaligned*

**AC** 12
**HP** 2 (1d4)
**Initiative** +2 (12)
**Speed** 40 ft., climb 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 0, PB +2, XP 0

## Traits

**Jumper**
The cat's jump distance is determined using its Dexterity rather than its Strength.

## Actions

**Scratch**
*Melee Attack Roll:* +4, reach 5 ft. 1 Slashing damage.
