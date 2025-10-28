---
smType: creature
name: Manticore
size: Large
type: Monstrosity
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '14'
initiative: +3 (13)
hp: '68'
hitDice: 8d10 + 24
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 50 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 7
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Common
cr: '3'
xp: '700'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The manticore makes three attacks, using Rend or Tail Spike in any combination.
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Slashing
          average: 7
      reach: 5 ft.
  - category: action
    name: Tail Spike
    entryType: attack
    text: '*Ranged Attack Roll:* +5, range 100/200 ft. 7 (1d8 + 3) Piercing damage.'
    attack:
      type: ranged
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Piercing
          average: 7
      range: 100/200 ft.
---

# Manticore
*Large, Monstrosity, Lawful Evil*

**AC** 14
**HP** 68 (8d10 + 24)
**Initiative** +3 (13)
**Speed** 30 ft., fly 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 11
**Languages** Common
CR 3, PB +2, XP 700

## Actions

**Multiattack**
The manticore makes three attacks, using Rend or Tail Spike in any combination.

**Rend**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Slashing damage.

**Tail Spike**
*Ranged Attack Roll:* +5, range 100/200 ft. 7 (1d8 + 3) Piercing damage.
