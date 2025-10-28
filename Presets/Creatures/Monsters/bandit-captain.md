---
smType: creature
name: Bandit Captain
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '15'
initiative: +3 (13)
hp: '52'
hitDice: 8d8 + 16
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 15
    saveProf: true
    saveMod: 4
  - key: dex
    score: 16
    saveProf: true
    saveMod: 5
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 14
    saveProf: false
  - key: wis
    score: 11
    saveProf: true
    saveMod: 2
  - key: cha
    score: 14
    saveProf: false
pb: '+2'
skills:
  - skill: Athletics
    value: '4'
  - skill: Deception
    value: '4'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common
  - value: Thieves' cant
cr: '2'
xp: '450'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The bandit makes two attacks, using Scimitar and Pistol in any combination.
  - category: action
    name: Scimitar
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Slashing
          average: 6
      reach: 5 ft.
  - category: action
    name: Pistol
    entryType: attack
    text: '*Ranged Attack Roll:* +5, range 30/90 ft. 8 (1d10 + 3) Piercing damage.'
    attack:
      type: ranged
      bonus: 5
      damage:
        - dice: 1d10
          bonus: 3
          type: Piercing
          average: 8
      range: 30/90 ft.
---

# Bandit Captain
*Small, Humanoid, Neutral Neutral*

**AC** 15
**HP** 52 (8d8 + 16)
**Initiative** +3 (13)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common, Thieves' cant
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The bandit makes two attacks, using Scimitar and Pistol in any combination.

**Scimitar**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Slashing damage.

**Pistol**
*Ranged Attack Roll:* +5, range 30/90 ft. 8 (1d10 + 3) Piercing damage.
