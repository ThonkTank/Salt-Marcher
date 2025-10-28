---
smType: creature
name: Giant Toad
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '39'
hitDice: 6d10 + 6
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
cr: '1'
xp: '200'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The toad can breathe air and water.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Standing Leap
    entryType: special
    text: The toad's Long Jump is up to 20 feet and its High Jump is up to 10 feet with or without a running start.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 5 (2d4) Poison damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12).'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Piercing
          average: 5
        - dice: 2d4
          bonus: 0
          type: Poison
          average: 5
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 12
            restrictions:
              size: Medium or smaller
        other: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12).
      additionalEffects: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12).
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Swallow
    entryType: special
    text: The toad swallows a Medium or smaller target it is grappling. While swallowed, the target isn't Grappled but has the Blinded and Restrained conditions, and it has Cover|XPHB|Total Cover against attacks and other effects outside the toad. In addition, the target takes 10 (3d6) Acid damage at the end of each of the toad's turns. The toad can have only one target swallowed at a time, and it can't use Bite while it has a swallowed target. If the toad dies, a swallowed creature is no longer Restrained and can escape from the corpse using 5 feet of movement, exiting with the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Toad
*Large, Beast, Unaligned*

**AC** 11
**HP** 39 (6d10 + 6)
**Initiative** +1 (11)
**Speed** 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
CR 1, PB +2, XP 200

## Traits

**Amphibious**
The toad can breathe air and water.

**Standing Leap**
The toad's Long Jump is up to 20 feet and its High Jump is up to 10 feet with or without a running start.

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 5 (2d4) Poison damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12).

**Swallow**
The toad swallows a Medium or smaller target it is grappling. While swallowed, the target isn't Grappled but has the Blinded and Restrained conditions, and it has Cover|XPHB|Total Cover against attacks and other effects outside the toad. In addition, the target takes 10 (3d6) Acid damage at the end of each of the toad's turns. The toad can have only one target swallowed at a time, and it can't use Bite while it has a swallowed target. If the toad dies, a swallowed creature is no longer Restrained and can escape from the corpse using 5 feet of movement, exiting with the Prone condition.
