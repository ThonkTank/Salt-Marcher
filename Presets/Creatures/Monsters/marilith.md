---
smType: creature
name: Marilith
size: Large
type: Fiend
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: "16"
initiative: +10 (20)
hp: "220"
hitDice: 21d10 + 105
speeds:
  - type: walk
    value: "40"
  - type: climb
    value: "40"
abilities:
  - ability: str
    score: 18
  - ability: dex
    score: 20
  - ability: con
    score: 20
  - ability: int
    score: 18
  - ability: wis
    score: 16
  - ability: cha
    score: 20
pb: "+5"
cr: "16"
xp: "15000"
sensesList:
  - type: truesight
    range: "120"
languagesList:
  - value: Abyssal
  - type: telepathy
    range: "120"
passivesList:
  - skill: Perception
    value: "18"
damageResistancesList:
  - value: Cold
  - value: Fire
  - value: Lightning
damageImmunitiesList:
  - value: Poison
  - value: Poisoned
entries:
  - category: trait
    name: Demonic Restoration
    text: If the marilith dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.
  - category: trait
    name: Magic Resistance
    text: The marilith has Advantage on saving throws against spells and other magical effects.
  - category: trait
    name: Reactive
    text: The marilith can take one Reaction on every turn of combat.
  - category: action
    name: Multiattack
    text: The marilith makes six Pact Blade attacks and uses Constrict.
  - category: action
    name: Pact Blade
    text: "*Melee Attack Roll:* +10, reach 5 ft. 10 (1d10 + 5) Slashing damage plus 7 (2d6) Necrotic damage."
  - category: action
    name: Constrict
    text: "*Strength Saving Throw*: DC 17, one Medium or smaller creature the marilith can see within 5 feet. *Failure:*  15 (2d10 + 4) Bludgeoning damage. The target has the Grappled condition (escape DC 14), and it has the Restrained condition until the grapple ends."
  - category: bonus
    name: Teleport (Recharge 5-6)
    text: The marilith teleports up to 120 feet to an unoccupied space it can see.

---

# Marilith
*Large, Fiend, Chaotic Evil*

**AC** 16
**HP** 220 (21d10 + 105)
**Initiative** +10 (20)
**Speed** 40 ft., climb 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 18 | 20 | 20 | 18 | 16 | 20 |

**Senses** truesight 120 ft.; Passive Perception 18
**Languages** Abyssal, telepathy 120 ft.
CR 16, PB +5, XP 15000

## Traits

**Demonic Restoration**
If the marilith dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.

**Magic Resistance**
The marilith has Advantage on saving throws against spells and other magical effects.

**Reactive**
The marilith can take one Reaction on every turn of combat.

## Actions

**Multiattack**
The marilith makes six Pact Blade attacks and uses Constrict.

**Pact Blade**
*Melee Attack Roll:* +10, reach 5 ft. 10 (1d10 + 5) Slashing damage plus 7 (2d6) Necrotic damage.

**Constrict**
*Strength Saving Throw*: DC 17, one Medium or smaller creature the marilith can see within 5 feet. *Failure:*  15 (2d10 + 4) Bludgeoning damage. The target has the Grappled condition (escape DC 14), and it has the Restrained condition until the grapple ends.

## Bonus Actions

**Teleport (Recharge 5-6)**
The marilith teleports up to 120 feet to an unoccupied space it can see.
