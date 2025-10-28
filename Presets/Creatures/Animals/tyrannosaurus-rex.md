---
smType: creature
name: Tyrannosaurus Rex
size: Huge
type: Beast
typeTags:
  - value: Dinosaur
alignmentOverride: Unaligned
ac: '13'
initiative: +3 (13)
hp: '136'
hitDice: 13d12 + 52
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 25
    saveProf: true
    saveMod: 10
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 19
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 12
    saveProf: true
    saveMod: 4
  - key: cha
    score: 9
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '4'
passivesList:
  - skill: Perception
    value: '14'
cr: '8'
xp: '3900'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The tyrannosaurus makes one Bite attack and one Tail attack.
    multiattack:
      attacks:
        - name: Bite
          count: 1
        - name: Bite
          count: 1
        - name: Tail
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 10 ft. 33 (4d12 + 7) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17). While Grappled, the target has the Restrained condition and can''t be targeted by the tyrannosaurus''s Tail.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 4d12
          bonus: 7
          type: Piercing
          average: 33
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 17
            restrictions:
              size: Large or smaller
              while: While Grappled, the target has the Restrained condition
          - condition: Restrained
            escape:
              type: dc
              dc: 17
            restrictions:
              size: Large or smaller
              while: While Grappled, the target has the Restrained condition
        other: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17). While Grappled, the target has the Restrained condition and can't be targeted by the tyrannosaurus's Tail.
      additionalEffects: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17). While Grappled, the target has the Restrained condition and can't be targeted by the tyrannosaurus's Tail.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Tail
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 15 ft. 25 (4d8 + 7) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 4d8
          bonus: 7
          type: Bludgeoning
          average: 25
      reach: 15 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Huge or smaller
        other: If the target is a Huge or smaller creature, it has the Prone condition.
      additionalEffects: If the target is a Huge or smaller creature, it has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Tyrannosaurus Rex
*Huge, Beast, Unaligned*

**AC** 13
**HP** 136 (13d12 + 52)
**Initiative** +3 (13)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 8, PB +3, XP 3900

## Actions

**Multiattack**
The tyrannosaurus makes one Bite attack and one Tail attack.

**Bite**
*Melee Attack Roll:* +10, reach 10 ft. 33 (4d12 + 7) Piercing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17). While Grappled, the target has the Restrained condition and can't be targeted by the tyrannosaurus's Tail.

**Tail**
*Melee Attack Roll:* +10, reach 15 ft. 25 (4d8 + 7) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition.
