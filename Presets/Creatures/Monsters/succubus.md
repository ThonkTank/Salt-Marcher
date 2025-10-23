---
smType: creature
name: Succubus
size: Medium
type: Fiend
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: "15"
initiative: +3 (13)
hp: "71"
hitDice: 13d8 + 13
speeds:
  - type: walk
    value: "30"
  - type: fly
    value: "60"
abilities:
  - ability: str
    score: 8
  - ability: dex
    score: 17
  - ability: con
    score: 13
  - ability: int
    score: 15
  - ability: wis
    score: 12
  - ability: cha
    score: 20
pb: "+2"
cr: "4"
xp: "1100"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Abyssal
  - value: Common
  - value: Infernal
  - type: telepathy
    range: "60"
passivesList:
  - skill: Perception
    value: "15"
damageResistancesList:
  - value: Cold
  - value: Fire
  - value: Poison
  - value: Psychic
entries:
  - category: trait
    name: Incubus Form
    text: When the succubus finishes a Long Rest, it can shape-shift into an Incubus, using that stat block instead of this one.
  - category: action
    name: Multiattack
    text: The succubus makes one Fiendish Touch attack and uses Charm or Draining Kiss.
  - category: action
    name: Fiendish Touch
    text: "*Melee Attack Roll:* +7, reach 5 ft. 16 (2d10 + 5) Psychic damage."
  - category: action
    name: Charm
    text: The succubus casts *Dominate Person* (level 8 version), requiring no spell components and using Charisma as the spellcasting ability (spell save DC 15).
  - category: action
    name: Draining Kiss
    text: "*Constitution Saving Throw*: DC 15, one creature Charmed by the succubus within 5 feet. *Failure:*  13 (3d8) Psychic damage. *Success:*  Half damage. *Failure or Success*:  The target's Hit Point maximum decreases by an amount equal to the damage taken."
  - category: bonus
    name: Shape-Shift
    text: The succubus shape-shifts to resemble a Medium or Small Humanoid or back into its true form. Its game statistics are the same in each form, except its Fly Speed is available only in its true form. Any equipment it's wearing or carrying isn't transformed.

---

# Succubus
*Medium, Fiend, Neutral Evil*

**AC** 15
**HP** 71 (13d8 + 13)
**Initiative** +3 (13)
**Speed** 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 8 | 17 | 13 | 15 | 12 | 20 |

**Senses** darkvision 60 ft.; Passive Perception 15
**Languages** Abyssal, Common, Infernal, telepathy 60 ft.
CR 4, PB +2, XP 1100

## Traits

**Incubus Form**
When the succubus finishes a Long Rest, it can shape-shift into an Incubus, using that stat block instead of this one.

## Actions

**Multiattack**
The succubus makes one Fiendish Touch attack and uses Charm or Draining Kiss.

**Fiendish Touch**
*Melee Attack Roll:* +7, reach 5 ft. 16 (2d10 + 5) Psychic damage.

**Charm**
The succubus casts *Dominate Person* (level 8 version), requiring no spell components and using Charisma as the spellcasting ability (spell save DC 15).

**Draining Kiss**
*Constitution Saving Throw*: DC 15, one creature Charmed by the succubus within 5 feet. *Failure:*  13 (3d8) Psychic damage. *Success:*  Half damage. *Failure or Success*:  The target's Hit Point maximum decreases by an amount equal to the damage taken.

## Bonus Actions

**Shape-Shift**
The succubus shape-shifts to resemble a Medium or Small Humanoid or back into its true form. Its game statistics are the same in each form, except its Fly Speed is available only in its true form. Any equipment it's wearing or carrying isn't transformed.
