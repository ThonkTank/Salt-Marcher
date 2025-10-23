---
smType: creature
name: Incubus
size: Medium
type: Fiend
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: "15"
initiative: +3 (13)
hp: "66"
hitDice: 12d8 + 12
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
    name: Succubus Form
    text: When the incubus finishes a Long Rest, it can shape-shift into a Succubus, using that stat block instead of this one. Any equipment it's wearing or carrying isn't transformed.
  - category: action
    name: Multiattack
    text: The incubus makes two Restless Touch attacks.
  - category: action
    name: Restless Touch
    text: "*Melee Attack Roll:* +7, reach 5 ft. 15 (3d6 + 5) Psychic damage, and the target is cursed for 24 hours or until the incubus dies. Until the curse ends, the target gains no benefit from finishing Short Rests."
  - category: action
    name: Spellcasting
    text: "The incubus casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15): - **At Will:** *Disguise Self*, *Etherealness* - **1e/Day Each:** *Dream*, *Hypnotic Pattern*"
  - category: bonus
    name: Nightmare
    recharge: Recharge 6
    text: "*Wisdom Saving Throw*: DC 15, one creature the incubus can see within 60 feet. *Failure:*  If the target has 20 Hit Points or fewer, it has the Unconscious condition for 1 hour, until it takes damage, or until a creature within 5 feet of it takes an action to wake it. Otherwise, the target takes 18 (4d8) Psychic damage."

---

# Incubus
*Medium, Fiend, Neutral Evil*

**AC** 15
**HP** 66 (12d8 + 12)
**Initiative** +3 (13)
**Speed** 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 8 | 17 | 13 | 15 | 12 | 20 |

**Senses** darkvision 60 ft.; Passive Perception 15
**Languages** Abyssal, Common, Infernal, telepathy 60 ft.
CR 4, PB +2, XP 1100

## Traits

**Succubus Form**
When the incubus finishes a Long Rest, it can shape-shift into a Succubus, using that stat block instead of this one. Any equipment it's wearing or carrying isn't transformed.

## Actions

**Multiattack**
The incubus makes two Restless Touch attacks.

**Restless Touch**
*Melee Attack Roll:* +7, reach 5 ft. 15 (3d6 + 5) Psychic damage, and the target is cursed for 24 hours or until the incubus dies. Until the curse ends, the target gains no benefit from finishing Short Rests.

**Spellcasting**
The incubus casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15): - **At Will:** *Disguise Self*, *Etherealness* - **1e/Day Each:** *Dream*, *Hypnotic Pattern*

## Bonus Actions

**Nightmare (Recharge 6)**
*Wisdom Saving Throw*: DC 15, one creature the incubus can see within 60 feet. *Failure:*  If the target has 20 Hit Points or fewer, it has the Unconscious condition for 1 hour, until it takes damage, or until a creature within 5 feet of it takes an action to wake it. Otherwise, the target takes 18 (4d8) Psychic damage.
