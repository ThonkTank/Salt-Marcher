---
smType: creature
name: Ogre
size: Large
type: Giant
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '11'
initiative: '-1 (9)'
hp: '68'
hitDice: 8d10 + 24
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 7
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '8'
languagesList:
  - value: Common
  - value: Giant
cr: '2'
xp: '450'
entries:
  - category: action
    name: Greatclub
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 13 (2d8 + 4) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d8
          bonus: 4
          type: Bludgeoning
          average: 13
      reach: 5 ft.
  - category: action
    name: Javelin
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +6, reach 5 ft. or range 30/120 ft. 11 (2d6 + 4) Piercing damage.'
---

# Ogre
*Large, Giant, Chaotic Evil*

**AC** 11
**HP** 68 (8d10 + 24)
**Initiative** -1 (9)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 8
**Languages** Common, Giant
CR 2, PB +2, XP 450

## Actions

**Greatclub**
*Melee Attack Roll:* +6, reach 5 ft. 13 (2d8 + 4) Bludgeoning damage.

**Javelin**
*Melee or Ranged Attack Roll:* +6, reach 5 ft. or range 30/120 ft. 11 (2d6 + 4) Piercing damage.
