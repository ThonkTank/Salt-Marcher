---
smType: creature
name: Warhorse Skeleton
size: Large
type: Undead
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '13'
initiative: +1 (11)
hp: '22'
hitDice: 3d10 + 6
speeds:
  walk:
    distance: 60 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 2
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
damageVulnerabilitiesList:
  - value: Bludgeoning
damageImmunitiesList:
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Poisoned
cr: 1/2
xp: '100'
entries:
  - category: action
    name: Hooves
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 7 (1d6 + 4) Bludgeoning damage. If the target is a Large or smaller creature and the skeleton moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d6
          bonus: 4
          type: Bludgeoning
          average: 7
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature and the skeleton moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Warhorse Skeleton
*Large, Undead, Lawful Evil*

**AC** 13
**HP** 22 (3d10 + 6)
**Initiative** +1 (11)
**Speed** 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 9
CR 1/2, PB +2, XP 100

## Actions

**Hooves**
*Melee Attack Roll:* +6, reach 5 ft. 7 (1d6 + 4) Bludgeoning damage. If the target is a Large or smaller creature and the skeleton moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.
