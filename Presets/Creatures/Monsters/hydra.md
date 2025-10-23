---
smType: creature
name: Hydra
size: Huge
type: Monstrosity
alignmentOverride: Unaligned
ac: "15"
initiative: +4 (14)
hp: "184"
hitDice: 16d12 + 80
speeds:
  - type: walk
    value: "40"
  - type: swim
    value: "40"
abilities:
  - ability: str
    score: 20
  - ability: dex
    score: 12
  - ability: con
    score: 20
  - ability: int
    score: 2
  - ability: wis
    score: 10
  - ability: cha
    score: 7
pb: "+3"
cr: "8"
xp: "3900"
sensesList:
  - type: darkvision
    range: "60"
passivesList:
  - skill: Perception
    value: "16"
damageImmunitiesList:
  - value: Blinded
  - value: Charmed
  - value: Deafened
  - value: Frightened
  - value: Stunned
  - value: Unconscious
entries:
  - category: trait
    name: Hold Breath
    text: The hydra can hold its breath for 1 hour.
  - category: trait
    name: Multiple Heads
    text: The hydra has five heads. Whenever the hydra takes 25 damage or more on a single turn, one of its heads dies. The hydra dies if all its heads are dead. At the end of each of its turns when it has at least one living head, the hydra grows two heads for each of its heads that died since its last turn, unless it has taken Fire damage since its last turn. The hydra regains 20 Hit Points when it grows new heads.
  - category: trait
    name: Reactive Heads
    text: For each head the hydra has beyond one, it gets an extra Reaction that can be used only for Opportunity Attacks.
  - category: action
    name: Multiattack
    text: The hydra makes as many Bite attacks as it has heads.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +8, reach 10 ft. 10 (1d10 + 5) Piercing damage."

---

# Hydra
*Huge, Monstrosity, Unaligned*

**AC** 15
**HP** 184 (16d12 + 80)
**Initiative** +4 (14)
**Speed** 40 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 20 | 12 | 20 | 2 | 10 | 7 |

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
