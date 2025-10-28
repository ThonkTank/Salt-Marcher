---
smType: creature
name: Knight
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '18'
initiative: +0 (10)
hp: '52'
hitDice: 8d8 + 16
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 14
    saveProf: true
    saveMod: 4
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 11
    saveProf: true
    saveMod: 2
  - key: cha
    score: 15
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common plus one other language
conditionImmunitiesList:
  - value: Frightened
cr: '3'
xp: '700'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The knight makes two attacks, using Greatsword or Heavy Crossbow in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Greatsword
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage plus 4 (1d8) Radiant damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Slashing
          average: 10
        - dice: 1d8
          bonus: 0
          type: Radiant
          average: 4
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Heavy Crossbow
    entryType: attack
    text: '*Ranged Attack Roll:* +2, range 100/400 ft. 11 (2d10) Piercing damage plus 4 (1d8) Radiant damage.'
    attack:
      type: ranged
      bonus: 2
      damage:
        - dice: 2d10
          bonus: 0
          type: Piercing
          average: 11
        - dice: 1d8
          bonus: 0
          type: Radiant
          average: 4
      range: 100/400 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Knight
*Small, Humanoid, Neutral Neutral*

**AC** 18
**HP** 52 (8d8 + 16)
**Initiative** +0 (10)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common plus one other language
CR 3, PB +2, XP 700

## Actions

**Multiattack**
The knight makes two attacks, using Greatsword or Heavy Crossbow in any combination.

**Greatsword**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage plus 4 (1d8) Radiant damage.

**Heavy Crossbow**
*Ranged Attack Roll:* +2, range 100/400 ft. 11 (2d10) Piercing damage plus 4 (1d8) Radiant damage.
