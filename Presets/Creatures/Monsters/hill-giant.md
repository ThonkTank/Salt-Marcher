---
smType: creature
name: Hill Giant
size: Huge
type: Giant
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '13'
initiative: +2 (12)
hp: '105'
hitDice: 10d12 + 40
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 21
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 19
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 9
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '2'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Giant
cr: '5'
xp: '1800'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The giant makes two attacks, using Tree Club or Trash Lob in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Tree Club
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 10 ft. 18 (3d8 + 5) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 3d8
          bonus: 5
          type: Bludgeoning
          average: 18
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, it has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Trash Lob
    entryType: attack
    text: '*Ranged Attack Roll:* +8, range 60/240 ft. 16 (2d10 + 5) Bludgeoning damage, and the target has the Poisoned condition until the end of its next turn.'
    attack:
      type: ranged
      bonus: 8
      damage:
        - dice: 2d10
          bonus: 5
          type: Bludgeoning
          average: 16
      range: 60/240 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Hill Giant
*Huge, Giant, Chaotic Evil*

**AC** 13
**HP** 105 (10d12 + 40)
**Initiative** +2 (12)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Giant
CR 5, PB +3, XP 1800

## Actions

**Multiattack**
The giant makes two attacks, using Tree Club or Trash Lob in any combination.

**Tree Club**
*Melee Attack Roll:* +8, reach 10 ft. 18 (3d8 + 5) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition.

**Trash Lob**
*Ranged Attack Roll:* +8, range 60/240 ft. 16 (2d10 + 5) Bludgeoning damage, and the target has the Poisoned condition until the end of its next turn.
