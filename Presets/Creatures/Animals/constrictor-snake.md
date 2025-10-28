---
smType: creature
name: Constrictor Snake
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +2 (12)
hp: '13'
hitDice: 2d10 + 2
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
    score: 14
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 1
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
  - type: blindsight
    range: '10'
passivesList:
  - skill: Perception
    value: '12'
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Piercing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d8
          bonus: 2
          type: Piercing
          average: 6
      reach: 5 ft.
  - category: action
    name: Constrict
    entryType: save
    text: '*Strength Saving Throw*: DC 12, one Medium or smaller creature the snake can see within 5 feet. *Failure:*  7 (3d4) Bludgeoning damage, and the target has the Grappled condition (escape DC 12).'
    save:
      ability: str
      dc: 12
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          size:
            - Medium
            - smaller
          visibility: true
      area: one Medium or smaller creature the snake can see within 5 feet
      onFail:
        damage:
          - dice: 3d4
            bonus: 0
            type: Bludgeoning
            average: 7
        effects:
          conditions:
            - condition: Grappled
              escape:
                type: dc
                dc: 12
          other: 7 (3d4) Bludgeoning damage, and the target has the Grappled condition (escape DC 12).
        legacyEffects: 7 (3d4) Bludgeoning damage, and the target has the Grappled condition (escape DC 12).
---

# Constrictor Snake
*Large, Beast, Unaligned*

**AC** 13
**HP** 13 (2d10 + 2)
**Initiative** +2 (12)
**Speed** 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft.; Passive Perception 12
CR 1/4, PB +2, XP 50

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Piercing damage.

**Constrict**
*Strength Saving Throw*: DC 12, one Medium or smaller creature the snake can see within 5 feet. *Failure:*  7 (3d4) Bludgeoning damage, and the target has the Grappled condition (escape DC 12).
