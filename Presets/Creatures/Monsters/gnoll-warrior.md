---
smType: creature
name: Gnoll Warrior
size: Medium
type: Fiend
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '15'
initiative: +1 (11)
hp: '27'
hitDice: 6d8
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Gnoll
cr: 1/2
xp: '100'
entries:
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Piercing
          average: 5
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Bone Bow
    entryType: attack
    text: '*Ranged Attack Roll:* +3, range 150/600 ft. 6 (1d10 + 1) Piercing damage.'
    attack:
      type: ranged
      bonus: 3
      damage:
        - dice: 1d10
          bonus: 1
          type: Piercing
          average: 6
      range: 150/600 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Rampage (1/Day)
    entryType: multiattack
    text: Immediately after dealing damage to a creature that is already Bloodied, the gnoll moves up to half its Speed, and it makes one Rend attack.
    limitedUse:
      count: 1
      reset: day
    multiattack:
      attacks:
        - name: Rend
          count: 1
      substitutions: []
    trigger.activation: bonus
    trigger.targeting:
      type: self
---

# Gnoll Warrior
*Medium, Fiend, Chaotic Evil*

**AC** 15
**HP** 27 (6d8)
**Initiative** +1 (11)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Gnoll
CR 1/2, PB +2, XP 100

## Actions

**Rend**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage.

**Bone Bow**
*Ranged Attack Roll:* +3, range 150/600 ft. 6 (1d10 + 1) Piercing damage.

## Bonus Actions

**Rampage (1/Day)**
Immediately after dealing damage to a creature that is already Bloodied, the gnoll moves up to half its Speed, and it makes one Rend attack.
