---
smType: creature
name: Remorhaz
size: Huge
type: Monstrosity
alignmentOverride: Unaligned
ac: "17"
initiative: +5 (15)
hp: "195"
hitDice: 17d12 + 85
speeds:
  - type: walk
    value: "40"
  - type: burrow
    value: "30"
abilities:
  - ability: str
    score: 24
  - ability: dex
    score: 13
  - ability: con
    score: 21
  - ability: int
    score: 4
  - ability: wis
    score: 10
  - ability: cha
    score: 5
pb: "+4"
cr: "11"
xp: "7200"
sensesList:
  - type: darkvision
    range: "60"
  - type: tremorsense
    range: "60"
passivesList:
  - skill: Perception
    value: "10"
damageImmunitiesList:
  - value: Cold
  - value: Fire
entries:
  - category: trait
    name: Heat Aura
    text: At the end of each of the remorhaz's turns, each creature in a 5-foot Emanation originating from the remorhaz takes 16 (3d10) Fire damage.
  - category: action
    name: Bite
    text: "*Melee Attack Roll:* +11, reach 10 ft. 18 (2d10 + 7) Piercing damage plus 14 (4d6) Fire damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17), and it has the Restrained condition until the grapple ends."
  - category: bonus
    name: Swallow
    text: "*Strength Saving Throw*: DC 19, one Large or smaller creature Grappled by the remorhaz (it can have up to two creatures swallowed at a time). *Failure:*  The target is swallowed by the remorhaz, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions, it has Cover|XPHB|Total Cover against attacks and other effects outside the remorhaz, and it takes 10 (3d6) Acid damage plus 10 (3d6) Fire damage at the start of each of the remorhaz's turns. If the remorhaz takes 30 damage or more on a single turn from a creature inside it, the remorhaz must succeed on a DC 15 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 5 feet of the remorhaz and has the Prone condition. If the remorhaz dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse by using 15 feet of movement, exiting Prone."

---

# Remorhaz
*Huge, Monstrosity, Unaligned*

**AC** 17
**HP** 195 (17d12 + 85)
**Initiative** +5 (15)
**Speed** 40 ft., burrow 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 24 | 13 | 21 | 4 | 10 | 5 |

**Senses** darkvision 60 ft., tremorsense 60 ft.; Passive Perception 10
CR 11, PB +4, XP 7200

## Traits

**Heat Aura**
At the end of each of the remorhaz's turns, each creature in a 5-foot Emanation originating from the remorhaz takes 16 (3d10) Fire damage.

## Actions

**Bite**
*Melee Attack Roll:* +11, reach 10 ft. 18 (2d10 + 7) Piercing damage plus 14 (4d6) Fire damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 17), and it has the Restrained condition until the grapple ends.

## Bonus Actions

**Swallow**
*Strength Saving Throw*: DC 19, one Large or smaller creature Grappled by the remorhaz (it can have up to two creatures swallowed at a time). *Failure:*  The target is swallowed by the remorhaz, and the Grappled condition ends. A swallowed creature has the Blinded and Restrained conditions, it has Cover|XPHB|Total Cover against attacks and other effects outside the remorhaz, and it takes 10 (3d6) Acid damage plus 10 (3d6) Fire damage at the start of each of the remorhaz's turns. If the remorhaz takes 30 damage or more on a single turn from a creature inside it, the remorhaz must succeed on a DC 15 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 5 feet of the remorhaz and has the Prone condition. If the remorhaz dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse by using 15 feet of movement, exiting Prone.
