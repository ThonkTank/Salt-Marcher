---
smType: creature
name: Giant Scorpion
size: Large
type: Beast
alignmentOverride: Unaligned
ac: '15'
initiative: +1 (11)
hp: '52'
hitDice: 7d10 + 14
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 15
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
sensesList:
  - type: blindsight
    range: '60'
passivesList:
  - skill: Perception
    value: '9'
cr: '3'
xp: '700'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The scorpion makes two Claw attacks and one Sting attack.
    multiattack:
      attacks:
        - name: Claw
          count: 2
        - name: Claw
          count: 2
        - name: Sting
          count: 1
      substitutions: []
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13) from one of two claws.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Bludgeoning
          average: 6
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 13
            restrictions:
              size: Large or smaller
        other: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13) from one of two claws.
      additionalEffects: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13) from one of two claws.
  - category: action
    name: Sting
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage plus 11 (2d10) Poison damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Piercing
          average: 7
        - dice: 2d10
          bonus: 0
          type: Poison
          average: 11
      reach: 5 ft.
---

# Giant Scorpion
*Large, Beast, Unaligned*

**AC** 15
**HP** 52 (7d10 + 14)
**Initiative** +1 (11)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft.; Passive Perception 9
CR 3, PB +2, XP 700

## Actions

**Multiattack**
The scorpion makes two Claw attacks and one Sting attack.

**Claw**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 13) from one of two claws.

**Sting**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage plus 11 (2d10) Poison damage.
