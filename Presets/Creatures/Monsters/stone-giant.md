---
smType: creature
name: Stone Giant
size: Huge
type: Giant
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '17'
initiative: +5 (15)
hp: '126'
hitDice: 11d12 + 55
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 23
    saveProf: false
  - key: dex
    score: 15
    saveProf: true
    saveMod: 5
  - key: con
    score: 20
    saveProf: true
    saveMod: 8
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 12
    saveProf: true
    saveMod: 4
  - key: cha
    score: 9
    saveProf: false
pb: '+3'
skills:
  - skill: Athletics
    value: '12'
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Giant
cr: '7'
xp: '2900'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The giant makes two attacks, using Stone Club or Boulder in any combination.
  - category: action
    name: Stone Club
    entryType: attack
    text: '*Melee Attack Roll:* +9, reach 15 ft. 22 (3d10 + 6) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 9
      damage:
        - dice: 3d10
          bonus: 6
          type: Bludgeoning
          average: 22
      reach: 15 ft.
  - category: action
    name: Boulder
    entryType: attack
    text: '*Ranged Attack Roll:* +9, range 60/240 ft. 15 (2d8 + 6) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition.'
    attack:
      type: ranged
      bonus: 9
      damage:
        - dice: 2d8
          bonus: 6
          type: Bludgeoning
          average: 15
      range: 60/240 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, it has the Prone condition.
---

# Stone Giant
*Huge, Giant, Neutral Neutral*

**AC** 17
**HP** 126 (11d12 + 55)
**Initiative** +5 (15)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Giant
CR 7, PB +3, XP 2900

## Actions

**Multiattack**
The giant makes two attacks, using Stone Club or Boulder in any combination.

**Stone Club**
*Melee Attack Roll:* +9, reach 15 ft. 22 (3d10 + 6) Bludgeoning damage.

**Boulder**
*Ranged Attack Roll:* +9, range 60/240 ft. 15 (2d8 + 6) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition.
