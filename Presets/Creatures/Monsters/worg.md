---
smType: creature
name: Worg
size: Large
type: Fey
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '13'
initiative: +1 (11)
hp: '26'
hitDice: 4d10 + 4
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 7
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Goblin
  - value: Worg
cr: 1/2
xp: '100'
entries:
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage, and the next attack roll made against the target before the start of the worg''s next turn has Advantage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d8
          bonus: 3
          type: Piercing
          average: 7
      reach: 5 ft.
---

# Worg
*Large, Fey, Neutral Evil*

**AC** 13
**HP** 26 (4d10 + 4)
**Initiative** +1 (11)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Goblin, Worg
CR 1/2, PB +2, XP 100

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage, and the next attack roll made against the target before the start of the worg's next turn has Advantage.
