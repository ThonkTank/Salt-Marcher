---
smType: creature
name: Bandit
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '12'
initiative: +1 (11)
hp: '11'
hitDice: 2d8 + 2
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 11
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common
  - value: Thieves' cant
cr: 1/8
xp: '25'
entries:
  - category: action
    name: Scimitar
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 4 (1d6 + 1) Slashing damage.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 1d6
          bonus: 1
          type: Slashing
          average: 4
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Light Crossbow
    entryType: attack
    text: '*Ranged Attack Roll:* +3, range 80/320 ft. 5 (1d8 + 1) Piercing damage.'
    attack:
      type: ranged
      bonus: 3
      damage:
        - dice: 1d8
          bonus: 1
          type: Piercing
          average: 5
      range: 80/320 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Bandit
*Small, Humanoid, Neutral Neutral*

**AC** 12
**HP** 11 (2d8 + 2)
**Initiative** +1 (11)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common, Thieves' cant
CR 1/8, PB +2, XP 25

## Actions

**Scimitar**
*Melee Attack Roll:* +3, reach 5 ft. 4 (1d6 + 1) Slashing damage.

**Light Crossbow**
*Ranged Attack Roll:* +3, range 80/320 ft. 5 (1d8 + 1) Piercing damage.
