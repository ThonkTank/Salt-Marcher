---
smType: creature
name: Minotaur of Baphomet
size: Large
type: Monstrosity
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '14'
initiative: +0 (10)
hp: '85'
hitDice: 10d10 + 30
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 16
    saveProf: false
  - key: cha
    score: 9
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '7'
  - skill: Survival
    value: '7'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '17'
languagesList:
  - value: Abyssal
cr: '3'
xp: '700'
entries:
  - category: action
    name: Abyssal Glaive
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 10 (1d12 + 4) Slashing damage plus 10 (3d6) Necrotic damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d12
          bonus: 4
          type: Slashing
          average: 10
        - dice: 3d6
          bonus: 0
          type: Necrotic
          average: 10
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Gore (Recharge 5-6)
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 18 (4d6 + 4) Piercing damage. If the target is a Large or smaller creature and the minotaur moved 10+ feet straight toward it immediately before the hit, the target takes an extra 10 (3d6) Piercing damage and has the Prone condition.'
    recharge: 5-6
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 4d6
          bonus: 4
          type: Piercing
          average: 18
        - dice: 3d6
          bonus: 0
          type: Piercing
          average: 10
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature and the minotaur moved 10+ feet straight toward it immediately before the hit, the target takes an extra 10 (3d6) Piercing damage and has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Minotaur of Baphomet
*Large, Monstrosity, Chaotic Evil*

**AC** 14
**HP** 85 (10d10 + 30)
**Initiative** +0 (10)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 17
**Languages** Abyssal
CR 3, PB +2, XP 700

## Actions

**Abyssal Glaive**
*Melee Attack Roll:* +6, reach 10 ft. 10 (1d12 + 4) Slashing damage plus 10 (3d6) Necrotic damage.

**Gore (Recharge 5-6)**
*Melee Attack Roll:* +6, reach 5 ft. 18 (4d6 + 4) Piercing damage. If the target is a Large or smaller creature and the minotaur moved 10+ feet straight toward it immediately before the hit, the target takes an extra 10 (3d6) Piercing damage and has the Prone condition.
