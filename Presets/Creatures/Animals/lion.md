---
smType: creature
name: Lion
size: Large
type: Beast
alignmentOverride: Unaligned
ac: "12"
initiative: +2 (12)
hp: "22"
hitDice: 4d10
speeds:
  - type: walk
    value: "50"
abilities:
  - ability: str
    score: 17
  - ability: dex
    score: 15
  - ability: con
    score: 11
  - ability: int
    score: 3
  - ability: wis
    score: 12
  - ability: cha
    score: 8
pb: "+2"
cr: "1"
xp: "200"
sensesList:
  - type: darkvision
    range: "60"
passivesList:
  - skill: Perception
    value: "13"
entries:
  - category: trait
    name: Pack Tactics
    text: The lion has Advantage on an attack roll against a creature if at least one of the lion's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
  - category: trait
    name: Running Leap
    text: With a 10-foot running start, the lion can Long Jump up to 25 feet.
  - category: action
    name: Multiattack
    text: The lion makes two Rend attacks. It can replace one attack with a use of Roar.
  - category: action
    name: Rend
    text: "*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Slashing damage."
  - category: action
    name: Roar
    text: "*Wisdom Saving Throw*: DC 11, one creature within 15 feet. *Failure:*  The target has the Frightened condition until the start of the lion's next turn."

---

# Lion
*Large, Beast, Unaligned*

**AC** 12
**HP** 22 (4d10)
**Initiative** +2 (12)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 17 | 15 | 11 | 3 | 12 | 8 |

**Senses** darkvision 60 ft.; Passive Perception 13
CR 1, PB +2, XP 200

## Traits

**Pack Tactics**
The lion has Advantage on an attack roll against a creature if at least one of the lion's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

**Running Leap**
With a 10-foot running start, the lion can Long Jump up to 25 feet.

## Actions

**Multiattack**
The lion makes two Rend attacks. It can replace one attack with a use of Roar.

**Rend**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Slashing damage.

**Roar**
*Wisdom Saving Throw*: DC 11, one creature within 15 feet. *Failure:*  The target has the Frightened condition until the start of the lion's next turn.
