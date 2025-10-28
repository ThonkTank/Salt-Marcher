---
smType: creature
name: Giant Elk
size: Huge
type: Celestial
alignmentLawChaos: Neutral
alignmentGoodEvil: Good
ac: '14'
initiative: +6 (16)
hp: '42'
hitDice: 5d12 + 10
speeds:
  walk:
    distance: 60 ft.
abilities:
  - key: str
    score: 19
    saveProf: true
    saveMod: 6
  - key: dex
    score: 18
    saveProf: true
    saveMod: 6
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 7
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
    value: '4'
sensesList:
  - type: darkvision
    range: '90'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Celestial
  - value: understands Common
  - value: Elvish
  - value: And Sylvan but can't speak them
damageResistancesList:
  - value: Necrotic
  - value: Radiant
cr: '2'
xp: '450'
entries:
  - category: action
    name: Ram
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 11 (2d6 + 4) Bludgeoning damage plus 5 (2d4) Radiant damage. If the target is a Huge or smaller creature and the elk moved 20+ feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the Prone condition.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d6
          bonus: 4
          type: Bludgeoning
          average: 11
        - dice: 2d4
          bonus: 0
          type: Radiant
          average: 5
        - dice: 2d4
          bonus: 0
          type: Bludgeoning
          average: 5
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Huge or smaller
        other: If the target is a Huge or smaller creature and the elk moved 20+ feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the Prone condition.
      additionalEffects: If the target is a Huge or smaller creature and the elk moved 20+ feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the Prone condition.
---

# Giant Elk
*Huge, Celestial, Neutral Good*

**AC** 14
**HP** 42 (5d12 + 10)
**Initiative** +6 (16)
**Speed** 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 90 ft.; Passive Perception 14
**Languages** Celestial, understands Common, Elvish, And Sylvan but can't speak them
CR 2, PB +2, XP 450

## Actions

**Ram**
*Melee Attack Roll:* +6, reach 10 ft. 11 (2d6 + 4) Bludgeoning damage plus 5 (2d4) Radiant damage. If the target is a Huge or smaller creature and the elk moved 20+ feet straight toward it immediately before the hit, the target takes an extra 5 (2d4) Bludgeoning damage and has the Prone condition.
