---
smType: creature
name: Tough
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '12'
initiative: +1 (11)
hp: '32'
hitDice: 5d8 + 10
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The tough has Advantage on an attack roll against a creature if at least one of the tough's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
  - category: action
    name: Mace
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Bludgeoning
          average: 5
      reach: 5 ft.
  - category: action
    name: Heavy Crossbow
    entryType: attack
    text: '*Ranged Attack Roll:* +3, range 100/400 ft. 6 (1d10 + 1) Piercing damage.'
    attack:
      type: ranged
      bonus: 3
      damage:
        - dice: 1d10
          bonus: 1
          type: Piercing
          average: 6
      range: 100/400 ft.
---

# Tough
*Small, Humanoid, Neutral Neutral*

**AC** 12
**HP** 32 (5d8 + 10)
**Initiative** +1 (11)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common
CR 1/2, PB +2, XP 100

## Traits

**Pack Tactics**
The tough has Advantage on an attack roll against a creature if at least one of the tough's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Mace**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Bludgeoning damage.

**Heavy Crossbow**
*Ranged Attack Roll:* +3, range 100/400 ft. 6 (1d10 + 1) Piercing damage.
