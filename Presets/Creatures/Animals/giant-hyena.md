---
smType: creature
name: Giant Hyena
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '45'
hitDice: 6d10 + 12
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 14
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
    value: '3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '13'
cr: '1'
xp: '200'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Piercing
          average: 10
      reach: 5 ft.
  - category: bonus
    name: Rampage (1/Day)
    entryType: multiattack
    text: Immediately after dealing damage to a creature that was already Bloodied, the hyena can move up to half its Speed, and it makes one Bite attack.
    limitedUse:
      count: 1
      reset: day
    multiattack:
      attacks:
        - name: Bite
          count: 1
        - name: Bite
          count: 1
      substitutions: []
---

# Giant Hyena
*Large, Beast, Unaligned*

**AC** 12
**HP** 45 (6d10 + 12)
**Initiative** +2 (12)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 1, PB +2, XP 200

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage.

## Bonus Actions

**Rampage (1/Day)**
Immediately after dealing damage to a creature that was already Bloodied, the hyena can move up to half its Speed, and it makes one Bite attack.
