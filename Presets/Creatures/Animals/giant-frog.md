---
smType: creature
name: Giant Frog
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '11'
initiative: +1 (11)
hp: '18'
hitDice: 4d8
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 12
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 11
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
skills:
  - skill: Perception
    value: '2'
  - skill: Stealth
    value: '4'
sensesList:
  - type: darkvision
    range: '30'
passivesList:
  - skill: Perception
    value: '12'
cr: 1/4
xp: '50'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The frog can breathe air and water.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Standing Leap
    entryType: special
    text: The frog's Long Jump is up to 20 feet and its High Jump is up to 10 feet with or without a running start.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 5 (1d6 + 2) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 11).'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 1d6
          bonus: 2
          type: Piercing
          average: 5
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 11
            restrictions:
              size: Medium or smaller
        other: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 11).
      additionalEffects: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 11).
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Swallow
    entryType: special
    text: The frog swallows a Small or smaller target it is grappling. While swallowed, the target isn't Grappled but has the Blinded and Restrained conditions, and it has Cover|XPHB|Total Cover against attacks and other effects outside the frog. While swallowing the target, the frog can't use Bite, and if the frog dies, the swallowed target is no longer Restrained and can escape from the corpse using 5 feet of movement, exiting with the Prone condition. At the end of the frog's next turn, the swallowed target takes 5 (2d4) Acid damage. If that damage doesn't kill it, the frog disgorges it, causing it to exit Prone.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Frog
*Medium, Beast, Unaligned*

**AC** 11
**HP** 18 (4d8)
**Initiative** +1 (11)
**Speed** 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 30 ft.; Passive Perception 12
CR 1/4, PB +2, XP 50

## Traits

**Amphibious**
The frog can breathe air and water.

**Standing Leap**
The frog's Long Jump is up to 20 feet and its High Jump is up to 10 feet with or without a running start.

## Actions

**Bite**
*Melee Attack Roll:* +3, reach 5 ft. 5 (1d6 + 2) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 11).

**Swallow**
The frog swallows a Small or smaller target it is grappling. While swallowed, the target isn't Grappled but has the Blinded and Restrained conditions, and it has Cover|XPHB|Total Cover against attacks and other effects outside the frog. While swallowing the target, the frog can't use Bite, and if the frog dies, the swallowed target is no longer Restrained and can escape from the corpse using 5 feet of movement, exiting with the Prone condition. At the end of the frog's next turn, the swallowed target takes 5 (2d4) Acid damage. If that damage doesn't kill it, the frog disgorges it, causing it to exit Prone.
