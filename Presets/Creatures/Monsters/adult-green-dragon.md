---
smType: creature
name: Adult Green Dragon
size: Huge
type: Dragon
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: "19"
initiative: +5 (15)
hp: "207"
hitDice: 18d12 + 90
speeds:
  - type: walk
    value: "40"
  - type: fly
    value: "80"
  - type: swim
    value: "40"
abilities:
  - ability: str
    score: 23
  - ability: dex
    score: 12
  - ability: con
    score: 21
  - ability: int
    score: 18
  - ability: wis
    score: 15
  - ability: cha
    score: 18
pb: "+5"
cr: "15"
xp: "13000"
sensesList:
  - type: blindsight
    range: "60"
  - type: darkvision
    range: "120"
languagesList:
  - value: Common
  - value: Draconic
passivesList:
  - skill: Perception
    value: "22"
damageImmunitiesList:
  - value: Poison
  - value: Poisoned
entries:
  - category: trait
    name: Amphibious
    text: The dragon can breathe air and water.
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    text: If the dragon fails a saving throw, it can choose to succeed instead.
  - category: action
    name: Multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Mind Spike* (level 3 version).
  - category: action
    name: Rend
    text: "*Melee Attack Roll:* +11, reach 10 ft. 15 (2d8 + 6) Slashing damage plus 7 (2d6) Poison damage."
  - category: action
    name: Poison Breath (Recharge 5-6)
    text: "*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  56 (16d6) Poison damage. *Success:*  Half damage."
  - category: action
    name: Spellcasting
    text: "The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17): - **At Will:** *Detect Magic*, *Mind Spike* - **1/Day Each:** *Geas*"
  - category: legendary
    name: Mind Invasion
    text: The dragon uses Spellcasting to cast *Mind Spike* (level 3 version).
  - category: legendary
    name: Noxious Miasma
    text: "*Constitution Saving Throw*: DC 17, each creature in a 20-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 90 feet. *Failure:*  7 (2d6) Poison damage, and the target takes a -2 penalty to AC until the end of its next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn."
  - category: legendary
    name: Pounce
    text: The dragon moves up to half its Speed, and it makes one Rend attack.

---

# Adult Green Dragon
*Huge, Dragon, Lawful Evil*

**AC** 19
**HP** 207 (18d12 + 90)
**Initiative** +5 (15)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 23 | 12 | 21 | 18 | 15 | 18 |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 22
**Languages** Common, Draconic
CR 15, PB +5, XP 13000

## Traits

**Amphibious**
The dragon can breathe air and water.

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Mind Spike* (level 3 version).

**Rend**
*Melee Attack Roll:* +11, reach 10 ft. 15 (2d8 + 6) Slashing damage plus 7 (2d6) Poison damage.

**Poison Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  56 (16d6) Poison damage. *Success:*  Half damage.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17): - **At Will:** *Detect Magic*, *Mind Spike* - **1/Day Each:** *Geas*

## Legendary Actions

**Mind Invasion**
The dragon uses Spellcasting to cast *Mind Spike* (level 3 version).

**Noxious Miasma**
*Constitution Saving Throw*: DC 17, each creature in a 20-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 90 feet. *Failure:*  7 (2d6) Poison damage, and the target takes a -2 penalty to AC until the end of its next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
