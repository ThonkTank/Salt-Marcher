---
smType: creature
name: Will-o'-Wisp
size: Small
type: Undead
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: "19"
initiative: +9 (19)
hp: "27"
hitDice: 11d4
speeds:
  - type: walk
    value: "5"
  - type: fly
    value: "50"
    hover: true
abilities:
  - ability: str
    score: 1
  - ability: dex
    score: 28
  - ability: con
    score: 10
  - ability: int
    score: 13
  - ability: wis
    score: 14
  - ability: cha
    score: 11
pb: "+2"
cr: "2"
xp: "450"
sensesList:
  - type: darkvision
    range: "120"
languagesList:
  - value: Common plus one other language
passivesList:
  - skill: Perception
    value: "12"
damageResistancesList:
  - value: Acid
  - value: Bludgeoning
  - value: Cold
  - value: Fire
  - value: Necrotic
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Lightning
  - value: Poison
  - value: Exhaustion
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
  - value: Prone
  - value: Restrained
  - value: Unconscious
entries:
  - category: trait
    name: Ephemeral
    text: The wisp can't wear or carry anything.
  - category: trait
    name: Illumination
    text: The wisp sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet.
  - category: trait
    name: Incorporeal Movement
    text: The wisp can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.
  - category: action
    name: Shock
    text: "*Melee Attack Roll:* +4, reach 5 ft. 11 (2d8 + 2) Lightning damage."
  - category: bonus
    name: Consume Life
    text: "*Constitution Saving Throw*: DC 10, one living creature the wisp can see within 5 feet that has 0 Hit Points. *Failure:*  The target dies, and the wisp regains 10 (3d6) Hit Points."
  - category: bonus
    name: Vanish
    text: The wisp and its light have the Invisible condition until the wisp's  Concentration ends on this effect, which ends early immediately after the wisp makes an attack roll or uses Consume Life.

---

# Will-o'-Wisp
*Small, Undead, Chaotic Evil*

**AC** 19
**HP** 27 (11d4)
**Initiative** +9 (19)
**Speed** 5 ft., fly 50 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 1 | 28 | 10 | 13 | 14 | 11 |

**Senses** darkvision 120 ft.; Passive Perception 12
**Languages** Common plus one other language
CR 2, PB +2, XP 450

## Traits

**Ephemeral**
The wisp can't wear or carry anything.

**Illumination**
The wisp sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet.

**Incorporeal Movement**
The wisp can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.

## Actions

**Shock**
*Melee Attack Roll:* +4, reach 5 ft. 11 (2d8 + 2) Lightning damage.

## Bonus Actions

**Consume Life**
*Constitution Saving Throw*: DC 10, one living creature the wisp can see within 5 feet that has 0 Hit Points. *Failure:*  The target dies, and the wisp regains 10 (3d6) Hit Points.

**Vanish**
The wisp and its light have the Invisible condition until the wisp's  Concentration ends on this effect, which ends early immediately after the wisp makes an attack roll or uses Consume Life.
