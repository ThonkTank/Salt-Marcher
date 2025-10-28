---
smType: creature
name: Polar Bear
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '42'
hitDice: 5d10 + 15
speeds:
  walk:
    distance: 40 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 20
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
  - skill: Stealth
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
damageResistancesList:
  - value: Cold
cr: '2'
xp: '450'
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
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 9 (1d8 + 5) Slashing damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 1d8
          bonus: 5
          type: Slashing
          average: 9
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Polar Bear
*Large, Beast, Unaligned*

**AC** 12
**HP** 42 (5d10 + 15)
**Initiative** +2 (12)
**Speed** 40 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The bear makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +7, reach 5 ft. 9 (1d8 + 5) Slashing damage.
