---
smType: creature
name: Chain Devil
size: Medium
type: Fiend
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: "15"
initiative: +5 (15)
hp: "85"
hitDice: 10d8 + 40
speeds:
  - type: walk
    value: "30"
abilities:
  - ability: str
    score: 18
  - ability: dex
    score: 15
  - ability: con
    score: 18
  - ability: int
    score: 11
  - ability: wis
    score: 12
  - ability: cha
    score: 14
pb: "+3"
cr: "8"
xp: "3900"
sensesList:
  - value: darkvision 120 ft. (unimpeded by magical darkness)
languagesList:
  - value: Infernal
  - type: telepathy
    range: "120"
passivesList:
  - skill: Perception
    value: "11"
damageResistancesList:
  - value: Bludgeoning
  - value: Cold
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Fire
  - value: Poison
  - value: Poisoned
entries:
  - category: trait
    name: Diabolical Restoration
    text: If the devil dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.
  - category: trait
    name: Magic Resistance
    text: The devil has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    text: The devil makes two Chain attacks and uses Conjure Infernal Chain.
  - category: action
    name: Chain
    text: "*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Slashing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two chains, and it has the Restrained condition until the grapple ends."
  - category: action
    name: Conjure Infernal Chain
    text: "The devil conjures a fiery chain to bind a creature. *Dexterity Saving Throw*: DC 15, one creature the devil can see within 60 feet. *Failure:*  9 (2d4 + 4) Fire damage, and the target has the Restrained condition until the end of the devil's next turn, at which point the chain disappears. If the target is Large or smaller, the devil moves the target up to 30 feet straight toward itself. *Success:*  The chain disappears."

---

# Chain Devil
*Medium, Fiend, Lawful Evil*

**AC** 15
**HP** 85 (10d8 + 40)
**Initiative** +5 (15)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 18 | 15 | 18 | 11 | 12 | 14 |

**Senses** darkvision 120 ft. (unimpeded by magical darkness); Passive Perception 11
**Languages** Infernal, telepathy 120 ft.
CR 8, PB +3, XP 3900

## Traits

**Diabolical Restoration**
If the devil dies outside the Nine Hells, its body disappears in sulfurous smoke, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells.

**Magic Resistance**
The devil has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The devil makes two Chain attacks and uses Conjure Infernal Chain.

**Chain**
*Melee Attack Roll:* +7, reach 10 ft. 11 (2d6 + 4) Slashing damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two chains, and it has the Restrained condition until the grapple ends.

**Conjure Infernal Chain**
The devil conjures a fiery chain to bind a creature. *Dexterity Saving Throw*: DC 15, one creature the devil can see within 60 feet. *Failure:*  9 (2d4 + 4) Fire damage, and the target has the Restrained condition until the end of the devil's next turn, at which point the chain disappears. If the target is Large or smaller, the devil moves the target up to 30 feet straight toward itself. *Success:*  The chain disappears.
