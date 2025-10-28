---
smType: creature
name: Minotaur Skeleton
size: Large
type: Undead
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '12'
initiative: +0 (10)
hp: '45'
hitDice: 6d10 + 12
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
    score: 15
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '9'
languagesList:
  - value: Understands Abyssal but can't speak
damageVulnerabilitiesList:
  - value: Bludgeoning
damageImmunitiesList:
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Poisoned
cr: '2'
xp: '450'
entries:
  - category: action
    name: Gore
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 11 (2d6 + 4) Piercing damage. If the target is a Large or smaller creature and the skeleton moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the Prone condition.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d6
          bonus: 4
          type: Piercing
          average: 11
        - dice: 2d8
          bonus: 0
          type: Piercing
          average: 9
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature and the skeleton moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Slam
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 15 (2d10 + 4) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d10
          bonus: 4
          type: Bludgeoning
          average: 15
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Minotaur Skeleton
*Large, Undead, Lawful Evil*

**AC** 12
**HP** 45 (6d10 + 12)
**Initiative** +0 (10)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 9
**Languages** Understands Abyssal but can't speak
CR 2, PB +2, XP 450

## Actions

**Gore**
*Melee Attack Roll:* +6, reach 5 ft. 11 (2d6 + 4) Piercing damage. If the target is a Large or smaller creature and the skeleton moved 20+ feet straight toward it immediately before the hit, the target takes an extra 9 (2d8) Piercing damage and has the Prone condition.

**Slam**
*Melee Attack Roll:* +6, reach 5 ft. 15 (2d10 + 4) Bludgeoning damage.
