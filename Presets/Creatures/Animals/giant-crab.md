---
smType: creature
name: Giant Crab
size: Medium
type: Beast
alignmentOverride: Unaligned
ac: '15'
initiative: +1 (11)
hp: '13'
hitDice: 3d8
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 13
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 9
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '3'
sensesList:
  - type: blindsight
    range: '30'
passivesList:
  - skill: Perception
    value: '9'
cr: 1/8
xp: '25'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The crab can breathe air and water.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 4 (1d6 + 1) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 11) from one of two claws.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 1d6
          bonus: 1
          type: Bludgeoning
          average: 4
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 11
            restrictions:
              size: Medium or smaller
        other: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 11) from one of two claws.
      additionalEffects: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 11) from one of two claws.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Crab
*Medium, Beast, Unaligned*

**AC** 15
**HP** 13 (3d8)
**Initiative** +1 (11)
**Speed** 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft.; Passive Perception 9
CR 1/8, PB +2, XP 25

## Traits

**Amphibious**
The crab can breathe air and water.

## Actions

**Claw**
*Melee Attack Roll:* +3, reach 5 ft. 4 (1d6 + 1) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 11) from one of two claws.
