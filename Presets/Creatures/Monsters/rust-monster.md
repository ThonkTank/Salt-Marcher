---
smType: creature
name: Rust Monster
size: Medium
type: Monstrosity
alignmentOverride: Unaligned
ac: "14"
initiative: +1 (11)
hp: "33"
hitDice: 6d8 + 6
speeds:
  - type: walk
    value: "40"
abilities:
  - ability: str
    score: 13
  - ability: dex
    score: 12
  - ability: con
    score: 13
  - ability: int
    score: 2
  - ability: wis
    score: 13
  - ability: cha
    score: 6
pb: "+2"
cr: 1/2
xp: "100"
sensesList:
  - type: darkvision
    range: "60"
passivesList:
  - skill: Perception
    value: "11"
entries:
  - category: trait
    name: Iron Scent
    text: The rust monster can pinpoint the location of ferrous metal within 30 feet of itself.
  - category: action
    name: Multiattack
    text: The rust monster makes one Bite attack and uses Antennae twice.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +3, reach 5 ft. 5 (1d8 + 1) Piercing damage."
  - category: action
    name: Antennae
    text: "The rust monster targets one nonmagical metal object—armor or a weapon—worn or carried by a creature within 5 feet of itself. *Dexterity Saving Throw*: DC 11, the creature with the object. *Failure:*  The object takes a -1 penalty to the AC it offers (armor) or to its attack rolls (weapon). Armor is destroyed if the penalty reduces its AC to 10, and a weapon is destroyed if its penalty reaches -5. The penalty can be removed by casting the *Mending* spell on the armor or weapon."
  - category: action
    name: Destroy Metal
    text: The rust monster touches a nonmagical metal object within 5 feet of itself that isn't being worn or carried. The touch destroys a 1-foot Cube [Area of Effect]|XPHB|Cube of the object.

---

# Rust Monster
*Medium, Monstrosity, Unaligned*

**AC** 14
**HP** 33 (6d8 + 6)
**Initiative** +1 (11)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 13 | 12 | 13 | 2 | 13 | 6 |

**Senses** darkvision 60 ft.; Passive Perception 11
CR 1/2, PB +2, XP 100

## Traits

**Iron Scent**
The rust monster can pinpoint the location of ferrous metal within 30 feet of itself.

## Actions

**Multiattack**
The rust monster makes one Bite attack and uses Antennae twice.

**Bite**
*Melee Attack Roll:* +3, reach 5 ft. 5 (1d8 + 1) Piercing damage.

**Antennae**
The rust monster targets one nonmagical metal object—armor or a weapon—worn or carried by a creature within 5 feet of itself. *Dexterity Saving Throw*: DC 11, the creature with the object. *Failure:*  The object takes a -1 penalty to the AC it offers (armor) or to its attack rolls (weapon). Armor is destroyed if the penalty reduces its AC to 10, and a weapon is destroyed if its penalty reaches -5. The penalty can be removed by casting the *Mending* spell on the armor or weapon.

**Destroy Metal**
The rust monster touches a nonmagical metal object within 5 feet of itself that isn't being worn or carried. The touch destroys a 1-foot Cube [Area of Effect]|XPHB|Cube of the object.
