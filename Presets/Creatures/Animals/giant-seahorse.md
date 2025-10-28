---
smType: creature
name: Giant Seahorse
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '14'
initiative: +1 (11)
hp: '16'
hitDice: 3d10
speeds:
  walk:
    distance: 5 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '11'
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Water Breathing
    entryType: special
    text: The seahorse can breathe only underwater.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Ram
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 9 (2d6 + 2) Bludgeoning damage, or 11 (2d8 + 2) Bludgeoning damage if the seahorse moved 20+ feet straight toward the target immediately before the hit.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d6
          bonus: 2
          type: Bludgeoning
          average: 9
        - dice: 2d8
          bonus: 2
          type: Bludgeoning
          average: 11
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Bubble Dash
    entryType: special
    text: While underwater, the seahorse moves up to half its Swim Speed without provoking Opportunity Attacks.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Giant Seahorse
*Large, Beast, Unaligned*

**AC** 14
**HP** 16 (3d10)
**Initiative** +1 (11)
**Speed** 5 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/2, PB +2, XP 100

## Traits

**Water Breathing**
The seahorse can breathe only underwater.

## Actions

**Ram**
*Melee Attack Roll:* +4, reach 5 ft. 9 (2d6 + 2) Bludgeoning damage, or 11 (2d8 + 2) Bludgeoning damage if the seahorse moved 20+ feet straight toward the target immediately before the hit.

## Bonus Actions

**Bubble Dash**
While underwater, the seahorse moves up to half its Swim Speed without provoking Opportunity Attacks.
