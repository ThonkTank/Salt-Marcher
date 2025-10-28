---
smType: creature
name: Ankylosaurus
size: Huge
type: Beast
typeTags:
  - value: Dinosaur
alignmentOverride: Unaligned
ac: '15'
initiative: +0 (10)
hp: '68'
hitDice: 8d12 + 16
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 19
    saveProf: true
    saveMod: 6
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '11'
cr: '3'
xp: '700'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The ankylosaurus makes two Tail attacks.
    multiattack:
      attacks:
        - name: Tail
          count: 2
        - name: Tail
          count: 2
      substitutions: []
  - category: action
    name: Tail
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 9 (1d10 + 4) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d10
          bonus: 4
          type: Bludgeoning
          average: 9
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Huge or smaller
        other: If the target is a Huge or smaller creature, it has the Prone condition.
      additionalEffects: If the target is a Huge or smaller creature, it has the Prone condition.
---

# Ankylosaurus
*Huge, Beast, Unaligned*

**AC** 15
**HP** 68 (8d12 + 16)
**Initiative** +0 (10)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 3, PB +2, XP 700

## Actions

**Multiattack**
The ankylosaurus makes two Tail attacks.

**Tail**
*Melee Attack Roll:* +6, reach 10 ft. 9 (1d10 + 4) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition.
