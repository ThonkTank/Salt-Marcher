---
smType: creature
name: Saber-Toothed Tiger
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '52'
hitDice: 7d10 + 14
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 18
    saveProf: true
    saveMod: 6
  - key: dex
    score: 17
    saveProf: true
    saveMod: 5
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
  - skill: Stealth
    value: '7'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Running Leap
    entryType: special
    text: With a 10-foot running start, the tiger can Long Jump up to 25 feet.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The tiger makes two Rend attacks.
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
    text: '*Melee Attack Roll:* +6, reach 5 ft. 11 (2d6 + 4) Slashing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d6
          bonus: 4
          type: Slashing
          average: 11
      reach: 5 ft.
  - category: bonus
    name: Nimble Escape
    entryType: special
    text: The tiger takes the Disengage or Hide action.
---

# Saber-Toothed Tiger
*Large, Beast, Unaligned*

**AC** 13
**HP** 52 (7d10 + 14)
**Initiative** +3 (13)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
CR 2, PB +2, XP 450

## Traits

**Running Leap**
With a 10-foot running start, the tiger can Long Jump up to 25 feet.

## Actions

**Multiattack**
The tiger makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +6, reach 5 ft. 11 (2d6 + 4) Slashing damage.

## Bonus Actions

**Nimble Escape**
The tiger takes the Disengage or Hide action.
