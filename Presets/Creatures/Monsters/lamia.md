---
smType: creature
name: Lamia
size: Large
type: Fiend
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: "13"
initiative: +1 (11)
hp: "97"
hitDice: 13d10 + 26
speeds:
  - type: walk
    value: "40"
abilities:
  - ability: str
    score: 16
  - ability: dex
    score: 13
  - ability: con
    score: 15
  - ability: int
    score: 14
  - ability: wis
    score: 15
  - ability: cha
    score: 16
pb: "+2"
cr: "4"
xp: "1100"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Abyssal
  - value: Common
passivesList:
  - skill: Perception
    value: "12"
entries:
  - category: action
    name: Multiattack
    text: The lamia makes two Claw attacks. It can replace one attack with a use of Corrupting Touch.
  - category: action
    name: Claw
    text: "*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Slashing damage plus 7 (2d6) Psychic damage."
  - category: action
    name: Corrupting Touch
    text: "*Wisdom Saving Throw*: DC 13, one creature the lamia can see within 5 feet. *Failure:*  13 (3d8) Psychic damage, and the target is cursed for 1 hour. Until the curse ends, the target has the Charmed and Poisoned conditions."
  - category: action
    name: Spellcasting
    text: "The lamia casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13): - **At Will:** *Disguise Self*, *Minor Illusion* - **1e/Day Each:** *Geas*, *Major Image*, *Scrying*"
  - category: bonus
    name: Leap
    text: The lamia jumps up to 30 feet by spending 10 feet of movement.

---

# Lamia
*Large, Fiend, Chaotic Evil*

**AC** 13
**HP** 97 (13d10 + 26)
**Initiative** +1 (11)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 16 | 13 | 15 | 14 | 15 | 16 |

**Senses** darkvision 60 ft.; Passive Perception 12
**Languages** Abyssal, Common
CR 4, PB +2, XP 1100

## Actions

**Multiattack**
The lamia makes two Claw attacks. It can replace one attack with a use of Corrupting Touch.

**Claw**
*Melee Attack Roll:* +5, reach 5 ft. 7 (1d8 + 3) Slashing damage plus 7 (2d6) Psychic damage.

**Corrupting Touch**
*Wisdom Saving Throw*: DC 13, one creature the lamia can see within 5 feet. *Failure:*  13 (3d8) Psychic damage, and the target is cursed for 1 hour. Until the curse ends, the target has the Charmed and Poisoned conditions.

**Spellcasting**
The lamia casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13): - **At Will:** *Disguise Self*, *Minor Illusion* - **1e/Day Each:** *Geas*, *Major Image*, *Scrying*

## Bonus Actions

**Leap**
The lamia jumps up to 30 feet by spending 10 feet of movement.
