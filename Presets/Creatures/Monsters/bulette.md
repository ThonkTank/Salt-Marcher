---
smType: creature
name: Bulette
size: Large
type: Monstrosity
alignmentOverride: Unaligned
ac: "17"
initiative: +0 (10)
hp: "94"
hitDice: 9d10 + 45
speeds:
  - type: walk
    value: "40"
  - type: burrow
    value: "40"
abilities:
  - ability: str
    score: 19
  - ability: dex
    score: 11
  - ability: con
    score: 21
  - ability: int
    score: 2
  - ability: wis
    score: 10
  - ability: cha
    score: 5
pb: "+3"
cr: "5"
xp: "1800"
sensesList:
  - type: darkvision
    range: "60"
  - type: tremorsense
    range: "120"
passivesList:
  - skill: Perception
    value: "16"
entries:
  - category: action
    name: Multiattack
    text: The bulette makes two Bite attacks.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +7, reach 5 ft. 17 (2d12 + 4) Piercing damage."
  - category: action
    name: Deadly Leap
    text: "The bulette spends 5 feet of movement to jump to a space within 15 feet that contains one or more Large or smaller creatures. *Dexterity Saving Throw*: DC 15, each creature in the bulette's destination space. *Failure:*  19 (3d12) Bludgeoning damage, and the target has the Prone condition. *Success:*  Half damage, and the target is pushed 5 feet straight away from the bulette."
  - category: bonus
    name: Leap
    text: The bulette jumps up to 30 feet by spending 10 feet of movement.

---

# Bulette
*Large, Monstrosity, Unaligned*

**AC** 17
**HP** 94 (9d10 + 45)
**Initiative** +0 (10)
**Speed** 40 ft., burrow 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 19 | 11 | 21 | 2 | 10 | 5 |

**Senses** darkvision 60 ft., tremorsense 120 ft.; Passive Perception 16
CR 5, PB +3, XP 1800

## Actions

**Multiattack**
The bulette makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +7, reach 5 ft. 17 (2d12 + 4) Piercing damage.

**Deadly Leap**
The bulette spends 5 feet of movement to jump to a space within 15 feet that contains one or more Large or smaller creatures. *Dexterity Saving Throw*: DC 15, each creature in the bulette's destination space. *Failure:*  19 (3d12) Bludgeoning damage, and the target has the Prone condition. *Success:*  Half damage, and the target is pushed 5 feet straight away from the bulette.

## Bonus Actions

**Leap**
The bulette jumps up to 30 feet by spending 10 feet of movement.
