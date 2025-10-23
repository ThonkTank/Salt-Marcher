---
smType: creature
name: Ancient White Dragon
size: Gargantuan
type: Dragon
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: "20"
initiative: +4 (14)
hp: "333"
hitDice: 18d20 + 144
speeds:
  - type: walk
    value: "40"
  - type: burrow
    value: "40"
  - type: fly
    value: "80"
  - type: swim
    value: "40"
abilities:
  - ability: str
    score: 26
  - ability: dex
    score: 10
  - ability: con
    score: 26
  - ability: int
    score: 10
  - ability: wis
    score: 13
  - ability: cha
    score: 18
pb: "+6"
cr: "20"
xp: "25000"
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
    value: "23"
damageImmunitiesList:
  - value: Cold
entries:
  - category: trait
    name: Ice Walk
    text: The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.
  - category: trait
    name: Legendary Resistance (4/Day, or 5/Day in Lair)
    text: If the dragon fails a saving throw, it can choose to succeed instead.
  - category: action
    name: Multiattack
    text: The dragon makes three Rend attacks.
  - category: action
    name: Rend
    text: "*Melee Attack Roll:* +14, reach 15 ft. 17 (2d8 + 8) Slashing damage plus 7 (2d6) Cold damage."
  - category: action
    name: Cold Breath (Recharge 5-6)
    text: "*Constitution Saving Throw*: DC 22, each creature in a 90-foot Cone. *Failure:*  63 (14d8) Cold damage. *Success:*  Half damage."
  - category: legendary
    name: Freezing Burst
    text: "*Constitution Saving Throw*: DC 20, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  14 (4d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn."
  - category: legendary
    name: Pounce
    text: The dragon moves up to half its Speed, and it makes one Rend attack.
  - category: legendary
    name: Frightful Presence
    text: The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18). The dragon can't take this action again until the start of its next turn.

---

# Ancient White Dragon
*Gargantuan, Dragon, Chaotic Evil*

**AC** 20
**HP** 333 (18d20 + 144)
**Initiative** +4 (14)
**Speed** 40 ft., swim 40 ft., fly 80 ft., burrow 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 26 | 10 | 26 | 10 | 13 | 18 |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 23
**Languages** Common, Draconic
CR 20, PB +6, XP 25000

## Traits

**Ice Walk**
The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +14, reach 15 ft. 17 (2d8 + 8) Slashing damage plus 7 (2d6) Cold damage.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 22, each creature in a 90-foot Cone. *Failure:*  63 (14d8) Cold damage. *Success:*  Half damage.

## Legendary Actions

**Freezing Burst**
*Constitution Saving Throw*: DC 20, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  14 (4d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.

**Frightful Presence**
The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18). The dragon can't take this action again until the start of its next turn.
