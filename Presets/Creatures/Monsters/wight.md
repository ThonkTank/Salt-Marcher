---
smType: creature
name: Wight
size: Medium
type: Undead
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: "14"
initiative: +4 (14)
hp: "82"
hitDice: 11d8 + 33
speeds:
  - type: walk
    value: "30"
abilities:
  - ability: str
    score: 15
  - ability: dex
    score: 14
  - ability: con
    score: 16
  - ability: int
    score: 10
  - ability: wis
    score: 13
  - ability: cha
    score: 15
pb: "+2"
cr: "3"
xp: "700"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Common plus one other language
passivesList:
  - skill: Perception
    value: "13"
damageResistancesList:
  - value: Necrotic
damageImmunitiesList:
  - value: Poison
  - value: Exhaustion
  - value: Poisoned
entries:
  - category: trait
    name: Sunlight Sensitivity
    text: While in sunlight, the wight has Disadvantage on ability checks and attack rolls.
  - category: action
    name: Multiattack
    text: The wight makes two attacks, using Necrotic Sword or Necrotic Bow in any combination. It can replace one attack with a use of Life Drain.
  - category: action
    name: Necrotic Sword
    text: "*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Slashing damage plus 4 (1d8) Necrotic damage."
  - category: action
    name: Necrotic Bow
    text: "*Ranged Attack Roll:* +4, range 150/600 ft. 6 (1d8 + 2) Piercing damage plus 4 (1d8) Necrotic damage."
  - category: action
    name: Life Drain
    text: "*Constitution Saving Throw*: DC 13, one creature within 5 feet. *Failure:*  6 (1d8 + 2) Necrotic damage, and the target's Hit Point maximum decreases by an amount equal to the damage taken. A Humanoid slain by this attack rises 24 hours later as a Zombie under the wight's control, unless the Humanoid is restored to life or its body is destroyed. The wight can have no more than twelve zombies under its control at a time."

---

# Wight
*Medium, Undead, Neutral Evil*

**AC** 14
**HP** 82 (11d8 + 33)
**Initiative** +4 (14)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 15 | 14 | 16 | 10 | 13 | 15 |

**Senses** darkvision 60 ft.; Passive Perception 13
**Languages** Common plus one other language
CR 3, PB +2, XP 700

## Traits

**Sunlight Sensitivity**
While in sunlight, the wight has Disadvantage on ability checks and attack rolls.

## Actions

**Multiattack**
The wight makes two attacks, using Necrotic Sword or Necrotic Bow in any combination. It can replace one attack with a use of Life Drain.

**Necrotic Sword**
*Melee Attack Roll:* +4, reach 5 ft. 6 (1d8 + 2) Slashing damage plus 4 (1d8) Necrotic damage.

**Necrotic Bow**
*Ranged Attack Roll:* +4, range 150/600 ft. 6 (1d8 + 2) Piercing damage plus 4 (1d8) Necrotic damage.

**Life Drain**
*Constitution Saving Throw*: DC 13, one creature within 5 feet. *Failure:*  6 (1d8 + 2) Necrotic damage, and the target's Hit Point maximum decreases by an amount equal to the damage taken. A Humanoid slain by this attack rises 24 hours later as a Zombie under the wight's control, unless the Humanoid is restored to life or its body is destroyed. The wight can have no more than twelve zombies under its control at a time.
