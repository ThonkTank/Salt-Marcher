---
smType: creature
name: Crocodile
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +0 (10)
hp: '13'
hitDice: 2d10 + 2
speeds:
  walk:
    distance: 20 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 13
    saveProf: true
    saveMod: 3
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '2'
passivesList:
  - skill: Perception
    value: '10'
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Hold Breath
    entryType: special
    text: The crocodile can hold its breath for 1 hour.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12). While Grappled, the target has the Restrained condition.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d8
          bonus: 2
          type: Piercing
          average: 6
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 12
            restrictions:
              size: Medium or smaller
              while: While Grappled, the target has the Restrained condition
          - condition: Restrained
            escape:
              type: dc
              dc: 12
            restrictions:
              size: Medium or smaller
              while: While Grappled, the target has the Restrained condition
        other: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12). While Grappled, the target has the Restrained condition.
      additionalEffects: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12). While Grappled, the target has the Restrained condition.
---

# Crocodile
*Large, Beast, Unaligned*

**AC** 12
**HP** 13 (2d10 + 2)
**Initiative** +0 (10)
**Speed** 20 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 1/2, PB +2, XP 100

## Traits

**Hold Breath**
The crocodile can hold its breath for 1 hour.

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12). While Grappled, the target has the Restrained condition.
