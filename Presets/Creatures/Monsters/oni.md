---
smType: creature
name: Oni
size: Large
type: Fiend
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: "17"
initiative: +0 (10)
hp: "119"
hitDice: 14d10 + 42
speeds:
  - type: walk
    value: "30"
  - type: fly
    value: "30"
    hover: true
abilities:
  - ability: str
    score: 19
  - ability: dex
    score: 11
  - ability: con
    score: 16
  - ability: int
    score: 14
  - ability: wis
    score: 12
  - ability: cha
    score: 15
pb: "+3"
cr: "7"
xp: "2900"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Common
  - value: Giant
passivesList:
  - skill: Perception
    value: "14"
damageResistancesList:
  - value: Cold
entries:
  - category: trait
    name: Regeneration
    text: The oni regains 10 Hit Points at the start of each of its turns if it has at least 1 Hit Point.
  - category: action
    name: Multiattack
    text: The oni makes two Claw or Nightmare Ray attacks. It can replace one attack with a use of Spellcasting.
  - category: action
    name: Claw
    text: "*Melee Attack Roll:* +7, reach 10 ft. 10 (1d12 + 4) Slashing damage plus 9 (2d8) Necrotic damage."
  - category: action
    name: Nightmare Ray
    text: "*Ranged Attack Roll:* +5, range 60 ft. 9 (2d6 + 2) Psychic damage, and the target has the Frightened condition until the start of the oni's next turn."
  - category: action
    name: Shape-Shift
    text: The oni shape-shifts into a Small or Medium Humanoid or a Large Giant, or it returns to its true form. Other than its size, its game statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed.
  - category: action
    name: Spellcasting
    text: "The oni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13): - **At Will:** - **1e/Day Each:** *Charm Person*, *Darkness*, *Gaseous Form*, *Sleep*"
  - category: bonus
    name: Invisibility
    text: The oni casts *Invisibility* on itself, requiring no spell components and using the same spellcasting ability as Spellcasting.

---

# Oni
*Large, Fiend, Lawful Evil*

**AC** 17
**HP** 119 (14d10 + 42)
**Initiative** +0 (10)
**Speed** 30 ft., fly 30 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 19 | 11 | 16 | 14 | 12 | 15 |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Common, Giant
CR 7, PB +3, XP 2900

## Traits

**Regeneration**
The oni regains 10 Hit Points at the start of each of its turns if it has at least 1 Hit Point.

## Actions

**Multiattack**
The oni makes two Claw or Nightmare Ray attacks. It can replace one attack with a use of Spellcasting.

**Claw**
*Melee Attack Roll:* +7, reach 10 ft. 10 (1d12 + 4) Slashing damage plus 9 (2d8) Necrotic damage.

**Nightmare Ray**
*Ranged Attack Roll:* +5, range 60 ft. 9 (2d6 + 2) Psychic damage, and the target has the Frightened condition until the start of the oni's next turn.

**Shape-Shift**
The oni shape-shifts into a Small or Medium Humanoid or a Large Giant, or it returns to its true form. Other than its size, its game statistics are the same in each form. Any equipment it is wearing or carrying isn't transformed.

**Spellcasting**
The oni casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 13): - **At Will:** - **1e/Day Each:** *Charm Person*, *Darkness*, *Gaseous Form*, *Sleep*

## Bonus Actions

**Invisibility**
The oni casts *Invisibility* on itself, requiring no spell components and using the same spellcasting ability as Spellcasting.
