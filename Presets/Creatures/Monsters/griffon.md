---
smType: creature
name: Griffon
size: Large
type: Monstrosity
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '59'
hitDice: 7d10 + 21
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 15
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
    score: 8
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
cr: '2'
xp: '450'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The griffon makes two Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 8 (1d8 + 4) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 14) from both of the griffon''s front claws.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d8
          bonus: 4
          type: Piercing
          average: 8
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 14
            restrictions:
              size: Medium or smaller
      additionalEffects: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 14) from both of the griffon's front claws.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Griffon
*Large, Monstrosity, Unaligned*

**AC** 12
**HP** 59 (7d10 + 21)
**Initiative** +2 (12)
**Speed** 30 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The griffon makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +6, reach 5 ft. 8 (1d8 + 4) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 14) from both of the griffon's front claws.
