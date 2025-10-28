---
smType: creature
name: Grick
size: Medium
type: Aberration
alignmentOverride: Unaligned
ac: '14'
initiative: +2 (12)
hp: '54'
hitDice: 12d8
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 14
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 11
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '12'
cr: '2'
xp: '450'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The grick makes one Beak attack and one Tentacles attack.
    multiattack:
      attacks:
        - name: Beak
          count: 1
        - name: Tentacles
          count: 1
      substitutions: []
  - category: action
    name: Beak
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 9 (2d6 + 2) Piercing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d6
          bonus: 2
          type: Piercing
          average: 9
      reach: 5 ft.
  - category: action
    name: Tentacles
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 7 (1d10 + 2) Slashing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12) from all four tentacles.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d10
          bonus: 2
          type: Slashing
          average: 7
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 12
            restrictions:
              size: Medium or smaller
      additionalEffects: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12) from all four tentacles.
---

# Grick
*Medium, Aberration, Unaligned*

**AC** 14
**HP** 54 (12d8)
**Initiative** +2 (12)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 12
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The grick makes one Beak attack and one Tentacles attack.

**Beak**
*Melee Attack Roll:* +4, reach 5 ft. 9 (2d6 + 2) Piercing damage.

**Tentacles**
*Melee Attack Roll:* +4, reach 5 ft. 7 (1d10 + 2) Slashing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 12) from all four tentacles.
