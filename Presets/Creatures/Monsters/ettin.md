---
smType: creature
name: Ettin
size: Large
type: Giant
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '12'
initiative: '-1 (9)'
hp: '85'
hitDice: 10d10 + 30
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 21
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 10
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
  - value: Giant
conditionImmunitiesList:
  - value: Blinded
  - value: Charmed
  - value: Deafened
  - value: Frightened
  - value: Stunned
  - value: Unconscious
cr: '4'
xp: '1100'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The ettin makes one Battleaxe attack and one Morningstar attack.
    multiattack:
      attacks:
        - name: Battleaxe
          count: 1
        - name: Morningstar
          count: 1
      substitutions: []
  - category: action
    name: Battleaxe
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 14 (2d8 + 5) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d8
          bonus: 5
          type: Slashing
          average: 14
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, it has the Prone condition.
  - category: action
    name: Morningstar
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 14 (2d8 + 5) Piercing damage, and the target has Disadvantage on the next attack roll it makes before the end of its next turn.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d8
          bonus: 5
          type: Piercing
          average: 14
      reach: 5 ft.
---

# Ettin
*Large, Giant, Chaotic Evil*

**AC** 12
**HP** 85 (10d10 + 30)
**Initiative** -1 (9)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Giant
CR 4, PB +2, XP 1100

## Actions

**Multiattack**
The ettin makes one Battleaxe attack and one Morningstar attack.

**Battleaxe**
*Melee Attack Roll:* +7, reach 5 ft. 14 (2d8 + 5) Slashing damage. If the target is a Large or smaller creature, it has the Prone condition.

**Morningstar**
*Melee Attack Roll:* +7, reach 5 ft. 14 (2d8 + 5) Piercing damage, and the target has Disadvantage on the next attack roll it makes before the end of its next turn.
