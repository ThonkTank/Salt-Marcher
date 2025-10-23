---
smType: creature
name: Giant Spider
size: Large
type: Beast
alignmentOverride: Unaligned
ac: "14"
initiative: +3 (13)
hp: "26"
hitDice: 4d10 + 4
speeds:
  - type: walk
    value: "30"
  - type: climb
    value: "30"
abilities:
  - ability: str
    score: 14
  - ability: dex
    score: 16
  - ability: con
    score: 12
  - ability: int
    score: 2
  - ability: wis
    score: 11
  - ability: cha
    score: 4
pb: "+2"
cr: "1"
xp: "200"
sensesList:
  - type: darkvision
    range: "60"
passivesList:
  - skill: Perception
    value: "14"
entries:
  - category: trait
    name: Spider Climb
    text: The spider can climb difficult surfaces, including along ceilings, without needing to make an ability check.
  - category: trait
    name: Web Walker
    text: The spider ignores movement restrictions caused by webs, and it knows the location of any other creature in contact with the same web.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage plus 7 (2d6) Poison damage."
  - category: action
    name: Web (Recharge 5-6)
    text: "*Dexterity Saving Throw*: DC 13, one creature the spider can see within 60 feet. *Failure:*  The target has the Restrained condition until the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Poison and Psychic damage)."

---

# Giant Spider
*Large, Beast, Unaligned*

**AC** 14
**HP** 26 (4d10 + 4)
**Initiative** +3 (13)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 14 | 16 | 12 | 2 | 11 | 4 |

**Senses** darkvision 60 ft.; Passive Perception 14
CR 1, PB +2, XP 200

## Traits

**Spider Climb**
The spider can climb difficult surfaces, including along ceilings, without needing to make an ability check.

**Web Walker**
The spider ignores movement restrictions caused by webs, and it knows the location of any other creature in contact with the same web.

## Actions

**Bite**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Piercing damage plus 7 (2d6) Poison damage.

**Web (Recharge 5-6)**
*Dexterity Saving Throw*: DC 13, one creature the spider can see within 60 feet. *Failure:*  The target has the Restrained condition until the web is destroyed (AC 10; HP 5; Vulnerability to Fire damage; Immunity to Poison and Psychic damage).
