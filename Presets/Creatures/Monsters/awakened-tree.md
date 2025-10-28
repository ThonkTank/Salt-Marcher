---
smType: creature
name: Awakened Tree
size: Huge
type: Plant
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '13'
initiative: '-2 (8)'
hp: '59'
hitDice: 7d12 + 14
speeds:
  walk:
    distance: 20 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 6
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 7
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
  - value: Bludgeoning
  - value: Piercing
cr: '2'
xp: '450'
entries:
  - category: action
    name: Slam
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 13 (2d8 + 4) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d8
          bonus: 4
          type: Bludgeoning
          average: 13
      reach: 10 ft.
---

# Awakened Tree
*Huge, Plant, Neutral Neutral*

**AC** 13
**HP** 59 (7d12 + 14)
**Initiative** -2 (8)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common plus one other language
CR 2, PB +2, XP 450

## Actions

**Slam**
*Melee Attack Roll:* +6, reach 10 ft. 13 (2d8 + 4) Bludgeoning damage.
