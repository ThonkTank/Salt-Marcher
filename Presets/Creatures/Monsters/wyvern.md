---
smType: creature
name: Wyvern
size: Large
type: Dragon
alignmentOverride: Unaligned
ac: '14'
initiative: +0 (10)
hp: '127'
hitDice: 15d10 + 45
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '4'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '14'
cr: '6'
xp: '2300'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The wyvern makes one Bite attack and one Sting attack.
    multiattack:
      attacks:
        - name: Bite
          count: 1
        - name: Sting
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Piercing damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d8
          bonus: 4
          type: Piercing
          average: 13
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Sting
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Piercing damage plus 24 (7d6) Poison damage, and the target has the Poisoned condition until the start of the wyvern''s next turn.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d6
          bonus: 4
          type: Piercing
          average: 11
        - dice: 7d6
          bonus: 0
          type: Poison
          average: 24
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Wyvern
*Large, Dragon, Unaligned*

**AC** 14
**HP** 127 (15d10 + 45)
**Initiative** +0 (10)
**Speed** 30 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 14
CR 6, PB +3, XP 2300

## Actions

**Multiattack**
The wyvern makes one Bite attack and one Sting attack.

**Bite**
*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Piercing damage.

**Sting**
*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Piercing damage plus 24 (7d6) Poison damage, and the target has the Poisoned condition until the start of the wyvern's next turn.
