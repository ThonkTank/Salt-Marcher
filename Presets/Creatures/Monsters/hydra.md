---
smType: creature
name: Hydra
size: Huge
type: Monstrosity
alignmentOverride: Unaligned
ac: '15'
initiative: +4 (14)
hp: '184'
hitDice: 16d12 + 80
speeds:
  walk:
    distance: 40 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 20
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 20
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '6'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '16'
conditionImmunitiesList:
  - value: Blinded
  - value: Charmed
  - value: Deafened
  - value: Frightened
  - value: Stunned
  - value: Unconscious
cr: '8'
xp: '3900'
entries:
  - category: trait
    name: Hold Breath
    entryType: special
    text: The hydra can hold its breath for 1 hour.
  - category: trait
    name: Multiple Heads
    entryType: special
    text: The hydra has five heads. Whenever the hydra takes 25 damage or more on a single turn, one of its heads dies. The hydra dies if all its heads are dead. At the end of each of its turns when it has at least one living head, the hydra grows two heads for each of its heads that died since its last turn, unless it has taken Fire damage since its last turn. The hydra regains 20 Hit Points when it grows new heads.
  - category: trait
    name: Reactive Heads
    entryType: special
    text: For each head the hydra has beyond one, it gets an extra Reaction that can be used only for Opportunity Attacks.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The hydra makes as many Bite attacks as it has heads.
    multiattack:
      attacks:
        - name: Bite
          count: 1
      substitutions: []
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 10 ft. 10 (1d10 + 5) Piercing damage.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 1d10
          bonus: 5
          type: Piercing
          average: 10
      reach: 10 ft.
---

# Hydra
*Huge, Monstrosity, Unaligned*

**AC** 15
**HP** 184 (16d12 + 80)
**Initiative** +4 (14)
**Speed** 40 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 16
CR 8, PB +3, XP 3900

## Traits

**Hold Breath**
The hydra can hold its breath for 1 hour.

**Multiple Heads**
The hydra has five heads. Whenever the hydra takes 25 damage or more on a single turn, one of its heads dies. The hydra dies if all its heads are dead. At the end of each of its turns when it has at least one living head, the hydra grows two heads for each of its heads that died since its last turn, unless it has taken Fire damage since its last turn. The hydra regains 20 Hit Points when it grows new heads.

**Reactive Heads**
For each head the hydra has beyond one, it gets an extra Reaction that can be used only for Opportunity Attacks.

## Actions

**Multiattack**
The hydra makes as many Bite attacks as it has heads.

**Bite**
*Melee Attack Roll:* +8, reach 10 ft. 10 (1d10 + 5) Piercing damage.
