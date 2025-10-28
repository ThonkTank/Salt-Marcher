---
smType: creature
name: Will-o'-Wisp
size: Small
type: Undead
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '19'
initiative: +9 (19)
hp: '27'
hitDice: 11d4
speeds:
  walk:
    distance: 5 ft.
  fly:
    distance: 50 ft.
    hover: true
abilities:
  - key: str
    score: 1
    saveProf: false
  - key: dex
    score: 28
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 13
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Common plus one other language
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
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
  - value: Prone
  - value: Restrained
  - value: Unconscious
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Ephemeral
    entryType: special
    text: The wisp can't wear or carry anything.
  - category: trait
    name: Illumination
    entryType: special
    text: The wisp sheds Bright Light in a 20-foot radius and Dim Light for an additional 20 feet.
  - category: trait
    name: Incorporeal Movement
    entryType: special
    text: The wisp can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.
  - category: action
    name: Shock
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 11 (2d8 + 2) Lightning damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d8
          bonus: 2
          type: Lightning
          average: 11
      reach: 5 ft.
  - category: bonus
    name: Consume Life
    entryType: save
    text: '*Constitution Saving Throw*: DC 10, one living creature the wisp can see within 5 feet that has 0 Hit Points. *Failure:*  The target dies, and the wisp regains 10 (3d6) Hit Points.'
    save:
      ability: con
      dc: 10
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          other: The target dies, and the wisp regains 10 (3d6) Hit Points.
        legacyEffects: The target dies, and the wisp regains 10 (3d6) Hit Points.
  - category: bonus
    name: Vanish
    entryType: special
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
| - | - | - | - | - | - |

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
