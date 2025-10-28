---
smType: creature
name: Phase Spider
size: Large
type: Monstrosity
alignmentOverride: Unaligned
ac: '14'
initiative: +3 (13)
hp: '45'
hitDice: 7d10 + 7
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '7'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Ethereal Sight
    entryType: special
    text: The spider can see 60 feet into the Ethereal Plane while on the Material Plane and vice versa.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Spider Climb
    entryType: special
    text: The spider can climb difficult surfaces, including along ceilings, without needing to make an ability check.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Web Walker
    entryType: special
    text: The spider ignores movement restrictions caused by webs, and the spider knows the location of any other creature in contact with the same web.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The spider makes two Bite attacks.
    multiattack:
      attacks:
        - name: Bite
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Piercing damage plus 9 (2d8) Poison damage. If this damage reduces the target to 0 Hit Points, the target becomes Stable, and it has the Poisoned condition for 1 hour. While Poisoned, the target also has the Paralyzed condition.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d10
          bonus: 3
          type: Piercing
          average: 8
        - dice: 2d8
          bonus: 0
          type: Poison
          average: 9
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Poisoned
            duration:
              type: hours
              count: 1
            restrictions:
              while: While Poisoned, the target also has the Paralyzed condition
          - condition: Paralyzed
            duration:
              type: hours
              count: 1
            restrictions:
              while: While Poisoned, the target also has the Paralyzed condition
      additionalEffects: If this damage reduces the target to 0 Hit Points, the target becomes Stable, and it has the Poisoned condition for 1 hour. While Poisoned, the target also has the Paralyzed condition.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Ethereal Jaunt
    entryType: special
    text: The spider teleports from the Material Plane to the Ethereal Plane or vice versa.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Phase Spider
*Large, Monstrosity, Unaligned*

**AC** 14
**HP** 45 (7d10 + 7)
**Initiative** +3 (13)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
CR 3, PB +2, XP 700

## Traits

**Ethereal Sight**
The spider can see 60 feet into the Ethereal Plane while on the Material Plane and vice versa.

**Spider Climb**
The spider can climb difficult surfaces, including along ceilings, without needing to make an ability check.

**Web Walker**
The spider ignores movement restrictions caused by webs, and the spider knows the location of any other creature in contact with the same web.

## Actions

**Multiattack**
The spider makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Piercing damage plus 9 (2d8) Poison damage. If this damage reduces the target to 0 Hit Points, the target becomes Stable, and it has the Poisoned condition for 1 hour. While Poisoned, the target also has the Paralyzed condition.

## Bonus Actions

**Ethereal Jaunt**
The spider teleports from the Material Plane to the Ethereal Plane or vice versa.
