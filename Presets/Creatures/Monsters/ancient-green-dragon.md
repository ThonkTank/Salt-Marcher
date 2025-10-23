---
smType: creature
name: Ancient Green Dragon
size: Gargantuan
type: Dragon
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: "21"
initiative: +5 (15)
hp: "402"
hitDice: 23d20 + 161
speeds:
  - type: walk
    value: "40"
  - type: fly
    value: "80"
  - type: swim
    value: "40"
abilities:
  - ability: str
    score: 27
  - ability: dex
    score: 12
  - ability: con
    score: 25
  - ability: int
    score: 20
  - ability: wis
    score: 17
  - ability: cha
    score: 22
pb: "+7"
cr: "22"
xp: "41000"
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
    value: "27"
damageImmunitiesList:
  - value: Poison
  - value: Poisoned
entries:
  - category: trait
    name: Amphibious
    text: The dragon can breathe air and water.
  - category: trait
    name: Legendary Resistance (4/Day, or 5/Day in Lair)
    text: If the dragon fails a saving throw, it can choose to succeed instead.
  - category: action
    name: Multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Mind Spike* (level 5 version).
  - category: action
    name: Rend
    text: "*Melee Attack Roll:* +15, reach 15 ft. 17 (2d8 + 8) Slashing damage plus 10 (3d6) Poison damage."
  - category: action
    name: Poison Breath (Recharge 5-6)
    text: "*Constitution Saving Throw*: DC 22, each creature in a 90-foot Cone. *Failure:*  77 (22d6) Poison damage. *Success:*  Half damage."
  - category: action
    name: Spellcasting
    text: "The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21): - **At Will:** *Detect Magic*, *Mind Spike* - **1e/Day Each:** *Geas*, *Modify Memory*"
  - category: legendary
    name: Mind Invasion
    text: The dragon uses Spellcasting to cast *Mind Spike* (level 5 version).
  - category: legendary
    name: Noxious Miasma
    text: "*Constitution Saving Throw*: DC 21, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 90 feet. *Failure:*  17 (5d6) Poison damage, and the target takes a -2 penalty to AC until the end of its next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn."
  - category: legendary
    name: Pounce
    text: The dragon moves up to half its Speed, and it makes one Rend attack.

---

# Ancient Green Dragon
*Gargantuan, Dragon, Lawful Evil*

**AC** 21
**HP** 402 (23d20 + 161)
**Initiative** +5 (15)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 27 | 12 | 25 | 20 | 17 | 22 |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 27
**Languages** Common, Draconic
CR 22, PB +7, XP 41000

## Traits

**Amphibious**
The dragon can breathe air and water.

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Mind Spike* (level 5 version).

**Rend**
*Melee Attack Roll:* +15, reach 15 ft. 17 (2d8 + 8) Slashing damage plus 10 (3d6) Poison damage.

**Poison Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 22, each creature in a 90-foot Cone. *Failure:*  77 (22d6) Poison damage. *Success:*  Half damage.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21): - **At Will:** *Detect Magic*, *Mind Spike* - **1e/Day Each:** *Geas*, *Modify Memory*

## Legendary Actions

**Mind Invasion**
The dragon uses Spellcasting to cast *Mind Spike* (level 5 version).

**Noxious Miasma**
*Constitution Saving Throw*: DC 21, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 90 feet. *Failure:*  17 (5d6) Poison damage, and the target takes a -2 penalty to AC until the end of its next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
