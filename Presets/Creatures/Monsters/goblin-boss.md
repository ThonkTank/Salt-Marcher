---
smType: creature
name: Goblin Boss
size: Small
type: Fey
typeTags:
  - value: Goblinoid
alignmentLawChaos: Chaotic
alignmentGoodEvil: Neutral
ac: '17'
initiative: +2 (12)
hp: '21'
hitDice: 6d6
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '6'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '9'
languagesList:
  - value: Common
  - value: Goblin
cr: '1'
xp: '200'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The goblin makes two attacks, using Scimitar or Shortbow in any combination.
  - category: action
    name: Scimitar
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Slashing
          average: 5
        - dice: 1d4
          bonus: 0
          type: Slashing
          average: 2
      reach: 5 ft.
  - category: action
    name: Shortbow
    entryType: attack
    text: '*Ranged Attack Roll:* +4, range 80/320 ft. 5 (1d6 + 2) Piercing damage, plus 2 (1d4) Piercing damage if the attack roll had Advantage.'
    attack:
      type: ranged
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Piercing
          average: 5
        - dice: 1d4
          bonus: 0
          type: Piercing
          average: 2
      range: 80/320 ft.
  - category: bonus
    name: Nimble Escape
    entryType: special
    text: The goblin takes the Disengage or Hide action.
---

# Goblin Boss
*Small, Fey, Chaotic Neutral*

**AC** 17
**HP** 21 (6d6)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 9
**Languages** Common, Goblin
CR 1, PB +2, XP 200

## Actions

**Multiattack**
The goblin makes two attacks, using Scimitar or Shortbow in any combination.

**Scimitar**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Slashing damage, plus 2 (1d4) Slashing damage if the attack roll had Advantage.

**Shortbow**
*Ranged Attack Roll:* +4, range 80/320 ft. 5 (1d6 + 2) Piercing damage, plus 2 (1d4) Piercing damage if the attack roll had Advantage.

## Bonus Actions

**Nimble Escape**
The goblin takes the Disengage or Hide action.
