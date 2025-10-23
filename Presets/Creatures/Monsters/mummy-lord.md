---
smType: creature
name: Mummy Lord
size: Small
type: Undead
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: "17"
initiative: +4 (14)
hp: "187"
hitDice: 25d8 + 75
speeds:
  - type: walk
    value: "30"
abilities:
  - ability: str
    score: 18
  - ability: dex
    score: 10
  - ability: con
    score: 17
  - ability: int
    score: 11
  - ability: wis
    score: 19
  - ability: cha
    score: 16
pb: "+5"
cr: "15"
xp: "13000"
sensesList:
  - type: truesight
    range: "60"
languagesList:
  - value: Common plus three other languages
passivesList:
  - skill: Perception
    value: "19"
damageVulnerabilitiesList:
  - value: Fire
damageImmunitiesList:
  - value: Necrotic
  - value: Poison
  - value: Charmed
  - value: Exhaustion
  - value: Frightened
  - value: Paralyzed
  - value: Poisoned
entries:
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    text: If the mummy fails a saving throw, it can choose to succeed instead.
  - category: trait
    name: Magic Resistance
    text: The mummy has Advantage on saving throws against spells and other magical effects.
  - category: trait
    name: Undead Restoration
    text: If destroyed, the mummy gains a new body in 24 hours if its heart is intact, reviving with all its Hit Points. The new body appears in an unoccupied space within the mummy's lair. The heart is a Tiny object that has AC 17, HP 10, and Immunity to all damage except Fire.
  - category: action
    name: Multiattack
    text: The mummy makes one Rotting Fist or Channel Negative Energy attack, and it uses Dreadful Glare.
  - category: action
    name: Rotting Fist
    text: "*Melee Attack Roll:* +9, reach 5 ft. 15 (2d10 + 4) Bludgeoning damage plus 10 (3d6) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target can't regain Hit Points, it gains no benefit from finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack."
  - category: action
    name: Channel Negative Energy
    text: "*Ranged Attack Roll:* +9, range 60 ft. 25 (6d6 + 4) Necrotic damage."
  - category: action
    name: Dreadful Glare
    text: "*Wisdom Saving Throw*: DC 17, one creature the mummy can see within 60 feet. *Failure:*  25 (6d6 + 4) Psychic damage, and the target has the Paralyzed condition until the end of the mummy's next turn."
  - category: action
    name: Spellcasting
    text: "The mummy casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 17, +9 to hit with spell attacks): - **At Will:** *Dispel Magic*, *Thaumaturgy* - **1e/Day Each:** *Animate Dead*, *Harm*, *Insect Plague*"
  - category: legendary
    name: Glare
    text: The mummy uses Dreadful Glare. The mummy can't take this action again until the start of its next turn.
  - category: legendary
    name: Necrotic Strike
    text: The mummy makes one Rotting Fist or Channel Negative Energy attack.
  - category: legendary
    name: Dread Command
    text: The mummy casts *Command* (level 2 version), using the same spellcasting ability as Spellcasting. The mummy can't take this action again until the start of its next turn.

---

# Mummy Lord
*Small, Undead, Lawful Evil*

**AC** 17
**HP** 187 (25d8 + 75)
**Initiative** +4 (14)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 18 | 10 | 17 | 11 | 19 | 16 |

**Senses** truesight 60 ft.; Passive Perception 19
**Languages** Common plus three other languages
CR 15, PB +5, XP 13000

## Traits

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the mummy fails a saving throw, it can choose to succeed instead.

**Magic Resistance**
The mummy has Advantage on saving throws against spells and other magical effects.

**Undead Restoration**
If destroyed, the mummy gains a new body in 24 hours if its heart is intact, reviving with all its Hit Points. The new body appears in an unoccupied space within the mummy's lair. The heart is a Tiny object that has AC 17, HP 10, and Immunity to all damage except Fire.

## Actions

**Multiattack**
The mummy makes one Rotting Fist or Channel Negative Energy attack, and it uses Dreadful Glare.

**Rotting Fist**
*Melee Attack Roll:* +9, reach 5 ft. 15 (2d10 + 4) Bludgeoning damage plus 10 (3d6) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target can't regain Hit Points, it gains no benefit from finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack.

**Channel Negative Energy**
*Ranged Attack Roll:* +9, range 60 ft. 25 (6d6 + 4) Necrotic damage.

**Dreadful Glare**
*Wisdom Saving Throw*: DC 17, one creature the mummy can see within 60 feet. *Failure:*  25 (6d6 + 4) Psychic damage, and the target has the Paralyzed condition until the end of the mummy's next turn.

**Spellcasting**
The mummy casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 17, +9 to hit with spell attacks): - **At Will:** *Dispel Magic*, *Thaumaturgy* - **1e/Day Each:** *Animate Dead*, *Harm*, *Insect Plague*

## Legendary Actions

**Glare**
The mummy uses Dreadful Glare. The mummy can't take this action again until the start of its next turn.

**Necrotic Strike**
The mummy makes one Rotting Fist or Channel Negative Energy attack.

**Dread Command**
The mummy casts *Command* (level 2 version), using the same spellcasting ability as Spellcasting. The mummy can't take this action again until the start of its next turn.
