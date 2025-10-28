---
smType: creature
name: Killer Whale
size: Huge
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '90'
hitDice: 12d12 + 12
speeds:
  walk:
    distance: 5 ft.
  swim:
    distance: 60 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '3'
  - skill: Stealth
    value: '4'
sensesList:
  - type: blindsight
    range: '120'
passivesList:
  - skill: Perception
    value: '13'
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Hold Breath
    entryType: special
    text: The whale can hold its breath for 30 minutes.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 21 (5d6 + 4) Piercing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 5d6
          bonus: 4
          type: Piercing
          average: 21
      reach: 5 ft.
---

# Killer Whale
*Huge, Beast, Unaligned*

**AC** 12
**HP** 90 (12d12 + 12)
**Initiative** +2 (12)
**Speed** 5 ft., swim 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 120 ft.; Passive Perception 13
CR 3, PB +2, XP 700

## Traits

**Hold Breath**
The whale can hold its breath for 30 minutes.

## Actions

**Bite**
*Melee Attack Roll:* +6, reach 5 ft. 21 (5d6 + 4) Piercing damage.
