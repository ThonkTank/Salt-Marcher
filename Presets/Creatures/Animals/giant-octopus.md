---
smType: creature
name: Giant Octopus
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '45'
hitDice: 7d10 + 7
speeds:
  walk:
    distance: 10 ft.
  swim:
    distance: 60 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 4
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Water Breathing
    entryType: special
    text: The octopus can breathe only underwater. It can hold its breath for 1 hour outside water.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Tentacles
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 10 ft. 10 (2d6 + 3) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from all eight tentacles. While Grappled, the target has the Restrained condition.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Bludgeoning
          average: 10
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 13
            restrictions:
              size: Medium or smaller
              while: While Grappled, the target has the Restrained condition
          - condition: Restrained
            escape:
              type: dc
              dc: 13
            restrictions:
              size: Medium or smaller
              while: While Grappled, the target has the Restrained condition
        other: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from all eight tentacles. While Grappled, the target has the Restrained condition.
      additionalEffects: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from all eight tentacles. While Grappled, the target has the Restrained condition.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Octopus
*Large, Beast, Unaligned*

**AC** 11
**HP** 45 (7d10 + 7)
**Initiative** +1 (11)
**Speed** 10 ft., swim 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
CR 1, PB +2, XP 200

## Traits

**Water Breathing**
The octopus can breathe only underwater. It can hold its breath for 1 hour outside water.

## Actions

**Tentacles**
*Melee Attack Roll:* +5, reach 10 ft. 10 (2d6 + 3) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from all eight tentacles. While Grappled, the target has the Restrained condition.
