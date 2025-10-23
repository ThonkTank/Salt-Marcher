---
smType: creature
name: Planetar
size: Large
type: Celestial
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: "19"
initiative: +10 (20)
hp: "262"
hitDice: 21d10 + 147
speeds:
  - type: walk
    value: "40"
  - type: fly
    value: "120"
    hover: true
abilities:
  - ability: str
    score: 24
  - ability: dex
    score: 20
  - ability: con
    score: 24
  - ability: int
    score: 19
  - ability: wis
    score: 22
  - ability: cha
    score: 25
pb: "+5"
cr: "16"
xp: "15000"
sensesList:
  - type: truesight
    range: "120"
languagesList:
  - value: All
  - type: telepathy
    range: "120"
passivesList:
  - skill: Perception
    value: "21"
damageResistancesList:
  - value: Radiant
damageImmunitiesList:
  - value: Charmed
  - value: Exhaustion
  - value: Frightened
entries:
  - category: trait
    name: Divine Awareness
    text: The planetar knows if it hears a lie.
  - category: trait
    name: Exalted Restoration
    text: If the planetar dies outside Mount Celestia, its body disappears, and it gains a new body instantly, reviving with all its Hit Points somewhere in Mount Celestia.
  - category: trait
    name: Magic Resistance
    text: The planetar has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    text: The planetar makes three Radiant Sword attacks or uses Holy Burst twice.
  - category: action
    name: Radiant Sword
    text: "*Melee Attack Roll:* +12, reach 10 ft. 14 (2d6 + 7) Slashing damage plus 18 (4d8) Radiant damage."
  - category: action
    name: Holy Burst
    text: "*Dexterity Saving Throw*: DC 20, each enemy in a 20-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the planetar can see within 120 feet. *Failure:*  24 (7d6) Radiant damage. *Success:*  Half damage."
  - category: action
    name: Spellcasting
    text: "The planetar casts one of the following spells, requiring no Material components and using Charisma as spellcasting ability (spell save DC 20): - **At Will:** *Detect Evil and Good* - **1e/Day Each:** *Commune*, *Control Weather*, *Dispel Evil and Good*, *Raise Dead*"
  - category: bonus
    name: Divine Aid (2/Day)
    text: The planetar casts *Cure Wounds*, *Invisibility*, *Lesser Restoration*, or *Remove Curse*, using the same spellcasting ability as Spellcasting.

---

# Planetar
*Large, Celestial, Lawful Good*

**AC** 19
**HP** 262 (21d10 + 147)
**Initiative** +10 (20)
**Speed** 40 ft., fly 120 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 24 | 20 | 24 | 19 | 22 | 25 |

**Senses** truesight 120 ft.; Passive Perception 21
**Languages** All, telepathy 120 ft.
CR 16, PB +5, XP 15000

## Traits

**Divine Awareness**
The planetar knows if it hears a lie.

**Exalted Restoration**
If the planetar dies outside Mount Celestia, its body disappears, and it gains a new body instantly, reviving with all its Hit Points somewhere in Mount Celestia.

**Magic Resistance**
The planetar has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The planetar makes three Radiant Sword attacks or uses Holy Burst twice.

**Radiant Sword**
*Melee Attack Roll:* +12, reach 10 ft. 14 (2d6 + 7) Slashing damage plus 18 (4d8) Radiant damage.

**Holy Burst**
*Dexterity Saving Throw*: DC 20, each enemy in a 20-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the planetar can see within 120 feet. *Failure:*  24 (7d6) Radiant damage. *Success:*  Half damage.

**Spellcasting**
The planetar casts one of the following spells, requiring no Material components and using Charisma as spellcasting ability (spell save DC 20): - **At Will:** *Detect Evil and Good* - **1e/Day Each:** *Commune*, *Control Weather*, *Dispel Evil and Good*, *Raise Dead*

## Bonus Actions

**Divine Aid (2/Day)**
The planetar casts *Cure Wounds*, *Invisibility*, *Lesser Restoration*, or *Remove Curse*, using the same spellcasting ability as Spellcasting.
