---
smType: creature
name: Scout
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '13'
initiative: +2 (12)
hp: '16'
hitDice: 3d8 + 3
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 11
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+2'
skills:
  - skill: Nature
    value: '4'
  - skill: Perception
    value: '5'
  - skill: Stealth
    value: '6'
  - skill: Survival
    value: '5'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Common plus one other language
cr: 1/2
xp: '100'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The scout makes two attacks, using Shortsword and Longbow in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Shortsword
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Piercing
          average: 5
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Longbow
    entryType: attack
    text: '*Ranged Attack Roll:* +4, range 150/600 ft. 6 (1d8 + 2) Piercing damage.'
    attack:
      type: ranged
      bonus: 4
      damage:
        - dice: 1d8
          bonus: 2
          type: Piercing
          average: 6
      range: 150/600 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Scout
*Small, Humanoid, Neutral Neutral*

**AC** 13
**HP** 16 (3d8 + 3)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common plus one other language
CR 1/2, PB +2, XP 100

## Actions

**Multiattack**
The scout makes two attacks, using Shortsword and Longbow in any combination.

**Shortsword**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage.

**Longbow**
*Ranged Attack Roll:* +4, range 150/600 ft. 6 (1d8 + 2) Piercing damage.
