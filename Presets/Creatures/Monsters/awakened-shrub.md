---
smType: creature
name: Awakened Shrub
size: Small
type: Plant
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '9'
initiative: '-1 (9)'
hp: '10'
hitDice: 3d6
speeds:
  walk:
    distance: 20 ft.
abilities:
  - key: str
    score: 3
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common plus one other language
damageVulnerabilitiesList:
  - value: Fire
damageResistancesList:
  - value: Piercing
cr: '0'
xp: '0'
entries:
  - category: action
    name: Rake
    entryType: attack
    text: '*Melee Attack Roll:* +1, reach 5 ft. 1 Slashing damage.'
    attack:
      type: melee
      bonus: 1
      damage: []
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Awakened Shrub
*Small, Plant, Neutral Neutral*

**AC** 9
**HP** 10 (3d6)
**Initiative** -1 (9)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common plus one other language
CR 0, PB +2, XP 0

## Actions

**Rake**
*Melee Attack Roll:* +1, reach 5 ft. 1 Slashing damage.
