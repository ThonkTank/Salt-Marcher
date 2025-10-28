---
smType: creature
name: Black Bear
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '19'
hitDice: 3d8 + 6
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 2
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
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
cr: 1/2
xp: '100'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The bear makes two Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 2
        - name: Rend
          count: 2
      substitutions: []
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Slashing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Slashing
          average: 5
      reach: 5 ft.
---

# Black Bear
*Medium, Beast, Unaligned*

**AC** 11
**HP** 19 (3d8 + 6)
**Initiative** +1 (11)
**Speed** 30 ft., climb 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
CR 1/2, PB +2, XP 100

## Actions

**Multiattack**
The bear makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Slashing damage.
