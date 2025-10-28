---
smType: creature
name: Roper
size: Large
type: Aberration
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '20'
initiative: +5 (15)
hp: '93'
hitDice: 11d10 + 33
speeds:
  walk:
    distance: 10 ft.
  climb:
    distance: 20 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 7
    saveProf: false
  - key: wis
    score: 16
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '6'
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '16'
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Spider Climb
    entryType: special
    text: The roper can climb difficult surfaces, including along ceilings, without needing to make an ability check.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The roper makes two Tentacle attacks, uses Reel, and makes two Bite attacks.
    multiattack:
      attacks:
        - name: Tentacle
          count: 2
        - name: Bite
          count: 2
      substitutions: []
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 17 (3d8 + 4) Piercing damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 3d8
          bonus: 4
          type: Piercing
          average: 17
      reach: 5 ft.
  - category: action
    name: Tentacle
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 60 ft. The target has the Grappled condition (escape DC 14) from one of six tentacles, and the target has the Poisoned condition until the grapple ends. The tentacle can be damaged, freeing a creature it has Grappled when destroyed (AC 20, HP 10, Immunity to Poison and Psychic damage). Damaging the tentacle deals no damage to the roper, and a destroyed tentacle regrows at the start of the roper''s next turn.'
    attack:
      type: melee
      bonus: 7
      damage: []
      reach: 60 ft.
  - category: action
    name: Reel
    entryType: special
    text: The roper pulls each creature Grappled by it up to 30 feet straight toward it.
---

# Roper
*Large, Aberration, Neutral Evil*

**AC** 20
**HP** 93 (11d10 + 33)
**Initiative** +5 (15)
**Speed** 10 ft., climb 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 16
CR 5, PB +3, XP 1800

## Traits

**Spider Climb**
The roper can climb difficult surfaces, including along ceilings, without needing to make an ability check.

## Actions

**Multiattack**
The roper makes two Tentacle attacks, uses Reel, and makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +7, reach 5 ft. 17 (3d8 + 4) Piercing damage.

**Tentacle**
*Melee Attack Roll:* +7, reach 60 ft. The target has the Grappled condition (escape DC 14) from one of six tentacles, and the target has the Poisoned condition until the grapple ends. The tentacle can be damaged, freeing a creature it has Grappled when destroyed (AC 20, HP 10, Immunity to Poison and Psychic damage). Damaging the tentacle deals no damage to the roper, and a destroyed tentacle regrows at the start of the roper's next turn.

**Reel**
The roper pulls each creature Grappled by it up to 30 feet straight toward it.
