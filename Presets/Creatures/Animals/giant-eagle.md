---
smType: creature
name: Giant Eagle
size: Large
type: Celestial
alignmentLawChaos: Neutral
alignmentGoodEvil: Good
ac: '13'
initiative: +3 (13)
hp: '26'
hitDice: 4d10 + 4
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 17
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 8
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '6'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Celestial
  - value: understands Common and Primordial (Auran) but can't speak them
damageResistancesList:
  - value: Necrotic
  - value: Radiant
cr: '1'
xp: '200'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The eagle makes two Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 2
        - name: Rend
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Slashing damage plus 3 (1d6) Radiant damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d4
          bonus: 3
          type: Slashing
          average: 5
        - dice: 1d6
          bonus: 0
          type: Radiant
          average: 3
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Giant Eagle
*Large, Celestial, Neutral Good*

**AC** 13
**HP** 26 (4d10 + 4)
**Initiative** +3 (13)
**Speed** 10 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Celestial, understands Common and Primordial (Auran) but can't speak them
CR 1, PB +2, XP 200

## Actions

**Multiattack**
The eagle makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +5, reach 5 ft. 5 (1d4 + 3) Slashing damage plus 3 (1d6) Radiant damage.
