---
smType: creature
name: Shadow
size: Medium
type: Undead
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: "12"
initiative: +2 (12)
hp: "27"
hitDice: 5d8 + 5
speeds:
  - type: walk
    value: "40"
abilities:
  - ability: str
    score: 6
  - ability: dex
    score: 14
  - ability: con
    score: 13
  - ability: int
    score: 6
  - ability: wis
    score: 10
  - ability: cha
    score: 8
pb: "+2"
cr: 1/2
xp: "100"
sensesList:
  - type: darkvision
    range: "60"
passivesList:
  - skill: Perception
    value: "10"
damageVulnerabilitiesList:
  - value: Radiant
damageResistancesList:
  - value: Acid
  - value: Cold
  - value: Fire
  - value: Lightning
  - value: Thunder
damageImmunitiesList:
  - value: Necrotic
  - value: Poison
  - value: Exhaustion
  - value: Frightened
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
  - value: Prone
  - value: Restrained
  - value: Unconscious
entries:
  - category: trait
    name: Amorphous
    text: The shadow can move through a space as narrow as 1 inch without expending extra movement to do so.
  - category: trait
    name: Sunlight Weakness
    text: While in sunlight, the shadow has Disadvantage on D20 Test.
  - category: action
    name: Draining Swipe
    text: "*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Necrotic damage, and the target's Strength score decreases by 1d4. The target dies if this reduces that score to 0. If a Humanoid is slain by this attack, a Shadow rises from the corpse 1d4 hours later."
  - category: bonus
    name: Shadow Stealth
    text: While in Dim Light or darkness, the shadow takes the Hide action.

---

# Shadow
*Medium, Undead, Chaotic Evil*

**AC** 12
**HP** 27 (5d8 + 5)
**Initiative** +2 (12)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 6 | 14 | 13 | 6 | 10 | 8 |

**Senses** darkvision 60 ft.; Passive Perception 10
CR 1/2, PB +2, XP 100

## Traits

**Amorphous**
The shadow can move through a space as narrow as 1 inch without expending extra movement to do so.

**Sunlight Weakness**
While in sunlight, the shadow has Disadvantage on D20 Test.

## Actions

**Draining Swipe**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Necrotic damage, and the target's Strength score decreases by 1d4. The target dies if this reduces that score to 0. If a Humanoid is slain by this attack, a Shadow rises from the corpse 1d4 hours later.

## Bonus Actions

**Shadow Stealth**
While in Dim Light or darkness, the shadow takes the Hide action.
