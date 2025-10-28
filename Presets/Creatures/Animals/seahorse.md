---
smType: creature
name: Seahorse
size: Small
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +1 (11)
hp: '1'
hitDice: 1d4 - 1
speeds:
  walk:
    distance: 5 ft.
  swim:
    distance: 20 ft.
abilities:
  - key: str
    score: 1
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 8
    saveProf: false
  - key: int
    score: 1
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 2
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '2'
  - skill: Stealth
    value: '5'
passivesList:
  - skill: Perception
    value: '12'
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Water Breathing
    entryType: special
    text: The seahorse can breathe only underwater.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bubble Dash
    entryType: special
    text: While underwater, the seahorse moves up to its Swim Speed without provoking Opportunity Attacks.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Seahorse
*Small, Beast, Unaligned*

**AC** 12
**HP** 1 (1d4 - 1)
**Initiative** +1 (11)
**Speed** 5 ft., swim 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 0, PB +2, XP 0

## Traits

**Water Breathing**
The seahorse can breathe only underwater.

## Actions

**Bubble Dash**
While underwater, the seahorse moves up to its Swim Speed without provoking Opportunity Attacks.
