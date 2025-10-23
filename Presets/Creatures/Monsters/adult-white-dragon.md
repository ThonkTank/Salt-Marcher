---
smType: creature
name: Adult White Dragon
size: Huge
type: Dragon
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: "18"
initiative: +4 (14)
hp: "200"
hitDice: 16d12 + 96
speeds:
  - type: walk
    value: "40"
  - type: burrow
    value: "30"
  - type: fly
    value: "80"
  - type: swim
    value: "40"
abilities:
  - ability: str
    score: 22
  - ability: dex
    score: 10
  - ability: con
    score: 22
  - ability: int
    score: 8
  - ability: wis
    score: 12
  - ability: cha
    score: 12
pb: "+5"
cr: "13"
xp: "10000"
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
    value: "21"
damageImmunitiesList:
  - value: Cold
entries:
  - category: trait
    name: Ice Walk
    text: The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    text: If the dragon fails a saving throw, it can choose to succeed instead.
  - category: action
    name: Multiattack
    text: The dragon makes three Rend attacks.
  - category: action
    name: Rend
    text: "*Melee Attack Roll:* +11, reach 10 ft. 13 (2d6 + 6) Slashing damage plus 4 (1d8) Cold damage."
  - category: action
    name: Cold Breath (Recharge 5-6)
    text: "*Constitution Saving Throw*: DC 19, each creature in a 60-foot Cone. *Failure:*  54 (12d8) Cold damage. *Success:*  Half damage."
  - category: legendary
    name: Freezing Burst
    text: "*Constitution Saving Throw*: DC 14, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  7 (2d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn."
  - category: legendary
    name: Pounce
    text: The dragon moves up to half its Speed, and it makes one Rend attack.
  - category: legendary
    name: Frightful Presence
    text: The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14). The dragon can't take this action again until the start of its next turn.

---

# Adult White Dragon
*Huge, Dragon, Chaotic Evil*

**AC** 18
**HP** 200 (16d12 + 96)
**Initiative** +4 (14)
**Speed** 40 ft., swim 40 ft., fly 80 ft., burrow 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 22 | 10 | 22 | 8 | 12 | 12 |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 21
**Languages** Common, Draconic
CR 13, PB +5, XP 10000

## Traits

**Ice Walk**
The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +11, reach 10 ft. 13 (2d6 + 6) Slashing damage plus 4 (1d8) Cold damage.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 19, each creature in a 60-foot Cone. *Failure:*  54 (12d8) Cold damage. *Success:*  Half damage.

## Legendary Actions

**Freezing Burst**
*Constitution Saving Throw*: DC 14, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  7 (2d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.

**Frightful Presence**
The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14). The dragon can't take this action again until the start of its next turn.
