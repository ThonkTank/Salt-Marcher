---
smType: creature
name: Cultist
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '12'
initiative: +1 (11)
hp: '9'
hitDice: 2d8
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
    score: 10
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 11
    saveProf: true
    saveMod: 2
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
skills:
  - skill: Deception
    value: '2'
  - skill: Religion
    value: '2'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common
cr: 1/8
xp: '25'
entries:
  - category: action
    name: Ritual Sickle
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Slashing damage plus 1 Necrotic damage.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 1d4
          bonus: 1
          type: Slashing
          average: 3
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Cultist
*Small, Humanoid, Neutral Neutral*

**AC** 12
**HP** 9 (2d8)
**Initiative** +1 (11)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common
CR 1/8, PB +2, XP 25

## Actions

**Ritual Sickle**
*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Slashing damage plus 1 Necrotic damage.
