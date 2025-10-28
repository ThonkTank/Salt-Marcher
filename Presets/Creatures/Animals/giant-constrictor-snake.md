---
smType: creature
name: Giant Constrictor Snake
size: Huge
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: +2 (12)
hp: '60'
hitDice: 8d12 + 8
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 19
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
sensesList:
  - type: blindsight
    range: '10'
passivesList:
  - skill: Perception
    value: '12'
cr: '2'
xp: '450'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The snake makes one Bite attack and uses Constrict.
    multiattack:
      attacks:
        - name: Bite
          count: 1
        - name: Bite
          count: 1
      substitutions: []
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 11 (2d6 + 4) Piercing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d6
          bonus: 4
          type: Piercing
          average: 11
      reach: 10 ft.
  - category: action
    name: Constrict
    entryType: save
    text: '*Strength Saving Throw*: DC 14, one Large or smaller creature the snake can see within 10 feet. *Failure:*  13 (2d8 + 4) Bludgeoning damage, and the target has the Grappled condition (escape DC 14).'
    save:
      ability: str
      dc: 14
      targeting:
        type: single
        range: 10 ft.
        restrictions:
          size:
            - Large
            - smaller
          visibility: true
      area: one Large or smaller creature the snake can see within 10 feet
      onFail:
        damage:
          - dice: 2d8
            bonus: 4
            type: Bludgeoning
            average: 13
        effects:
          conditions:
            - condition: Grappled
              escape:
                type: dc
                dc: 14
          other: 13 (2d8 + 4) Bludgeoning damage, and the target has the Grappled condition (escape DC 14).
        legacyEffects: 13 (2d8 + 4) Bludgeoning damage, and the target has the Grappled condition (escape DC 14).
---

# Giant Constrictor Snake
*Huge, Beast, Unaligned*

**AC** 12
**HP** 60 (8d12 + 8)
**Initiative** +2 (12)
**Speed** 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft.; Passive Perception 12
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The snake makes one Bite attack and uses Constrict.

**Bite**
*Melee Attack Roll:* +6, reach 10 ft. 11 (2d6 + 4) Piercing damage.

**Constrict**
*Strength Saving Throw*: DC 14, one Large or smaller creature the snake can see within 10 feet. *Failure:*  13 (2d8 + 4) Bludgeoning damage, and the target has the Grappled condition (escape DC 14).
