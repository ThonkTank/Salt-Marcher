---
smType: creature
name: Chuul
size: Large
type: Aberration
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: "16"
initiative: +0 (10)
hp: "76"
hitDice: 9d10 + 27
speeds:
  - type: walk
    value: "30"
  - type: swim
    value: "30"
abilities:
  - ability: str
    score: 19
  - ability: dex
    score: 10
  - ability: con
    score: 16
  - ability: int
    score: 5
  - ability: wis
    score: 11
  - ability: cha
    score: 5
pb: "+2"
cr: "4"
xp: "1100"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Understands Deep Speech but can't speak
passivesList:
  - skill: Perception
    value: "14"
damageImmunitiesList:
  - value: Poison
  - value: Poisoned
entries:
  - category: trait
    name: Amphibious
    text: The chuul can breathe air and water.
  - category: trait
    name: Sense Magic
    text: The chuul senses magic within 120 feet of itself. This trait otherwise works like the *Detect Magic* spell but isn't itself magical.
  - category: action
    name: Multiattack
    text: The chuul makes two Pincer attacks and uses Paralyzing Tentacles.
  - category: action
    name: Pincer
    text: "*Melee Attack Roll:* +6, reach 10 ft. 9 (1d10 + 4) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two pincers."
  - category: action
    name: Paralyzing Tentacles
    text: "*Constitution Saving Throw*: DC 13, one creature Grappled by the chuul. *Failure:*  The target has the Poisoned condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically. While Poisoned, the target has the Paralyzed condition."

---

# Chuul
*Large, Aberration, Chaotic Evil*

**AC** 16
**HP** 76 (9d10 + 27)
**Initiative** +0 (10)
**Speed** 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 19 | 10 | 16 | 5 | 11 | 5 |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Understands Deep Speech but can't speak
CR 4, PB +2, XP 1100

## Traits

**Amphibious**
The chuul can breathe air and water.

**Sense Magic**
The chuul senses magic within 120 feet of itself. This trait otherwise works like the *Detect Magic* spell but isn't itself magical.

## Actions

**Multiattack**
The chuul makes two Pincer attacks and uses Paralyzing Tentacles.

**Pincer**
*Melee Attack Roll:* +6, reach 10 ft. 9 (1d10 + 4) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two pincers.

**Paralyzing Tentacles**
*Constitution Saving Throw*: DC 13, one creature Grappled by the chuul. *Failure:*  The target has the Poisoned condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically. While Poisoned, the target has the Paralyzed condition.
