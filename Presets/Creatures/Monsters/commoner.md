---
smType: creature
name: Commoner
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '10'
initiative: +0 (10)
hp: '4'
hitDice: 1d8
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 10
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
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Training
    entryType: special
    text: The commoner has proficiency in one skill of the DM's choice and has Advantage whenever it makes an ability check using that skill.
  - category: action
    name: Club
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 2
      damage:
        - dice: 1d4
          bonus: 0
          type: Bludgeoning
          average: 2
      reach: 5 ft.
---

# Commoner
*Small, Humanoid, Neutral Neutral*

**AC** 10
**HP** 4 (1d8)
**Initiative** +0 (10)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common
CR 0, PB +2, XP 0

## Traits

**Training**
The commoner has proficiency in one skill of the DM's choice and has Advantage whenever it makes an ability check using that skill.

## Actions

**Club**
*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Bludgeoning damage.
