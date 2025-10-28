---
smType: creature
name: Guard Captain
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '18'
initiative: +4 (14)
hp: '75'
hitDice: 10d8 + 30
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 13
    saveProf: false
pb: '+2'
skills:
  - skill: Athletics
    value: '6'
  - skill: Perception
    value: '4'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Common
cr: '4'
xp: '1100'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The guard makes two attacks, using Javelin or Longsword in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Javelin
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +6, reach 5 ft. or range 30/120 ft. 14 (3d6 + 4) Piercing damage.'
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Longsword
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 15 (2d10 + 4) Slashing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d10
          bonus: 4
          type: Slashing
          average: 15
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Guard Captain
*Small, Humanoid, Neutral Neutral*

**AC** 18
**HP** 75 (10d8 + 30)
**Initiative** +4 (14)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common
CR 4, PB +2, XP 1100

## Actions

**Multiattack**
The guard makes two attacks, using Javelin or Longsword in any combination.

**Javelin**
*Melee or Ranged Attack Roll:* +6, reach 5 ft. or range 30/120 ft. 14 (3d6 + 4) Piercing damage.

**Longsword**
*Melee Attack Roll:* +6, reach 5 ft. 15 (2d10 + 4) Slashing damage.
