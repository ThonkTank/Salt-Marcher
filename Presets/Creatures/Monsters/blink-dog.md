---
smType: creature
name: Blink Dog
size: Medium
type: Fey
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '13'
initiative: +3 (13)
hp: '22'
hitDice: 4d8 + 4
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 12
    saveProf: false
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Understands Elvish and Sylvan but can't speak them
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Piercing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d4
          bonus: 3
          type: Piercing
          average: 5
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Teleport (Recharge 4-6)
    entryType: special
    text: The dog teleports up to 40 feet to an unoccupied space it can see.
    recharge: 4-6
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Blink Dog
*Medium, Fey, Lawful Good*

**AC** 13
**HP** 22 (4d8 + 4)
**Initiative** +3 (13)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
**Languages** Understands Elvish and Sylvan but can't speak them
CR 1/4, PB +2, XP 50

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Piercing damage.

## Bonus Actions

**Teleport (Recharge 4-6)**
The dog teleports up to 40 feet to an unoccupied space it can see.
