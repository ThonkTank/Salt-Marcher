---
smType: creature
name: Ghost
size: Medium
type: Undead
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: "11"
initiative: +1 (11)
hp: "45"
hitDice: 10d8
speeds:
  - type: walk
    value: "5"
  - type: fly
    value: "40"
    hover: true
abilities:
  - ability: str
    score: 7
  - ability: dex
    score: 13
  - ability: con
    score: 10
  - ability: int
    score: 10
  - ability: wis
    score: 12
  - ability: cha
    score: 17
pb: "+2"
cr: "4"
xp: "1100"
sensesList:
  - type: darkvision
    range: "60"
languagesList:
  - value: Common plus one other language
passivesList:
  - skill: Perception
    value: "11"
damageResistancesList:
  - value: Acid
  - value: Bludgeoning
  - value: Cold
  - value: Fire
  - value: Lightning
  - value: Piercing
  - value: Slashing
  - value: Thunder
damageImmunitiesList:
  - value: Necrotic
  - value: Poison
  - value: Charmed
  - value: Exhaustion
  - value: Frightened
  - value: Grappled
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
  - value: Prone
  - value: Restrained
entries:
  - category: trait
    name: Ethereal Sight
    text: The ghost can see 60 feet into the Ethereal Plane when it is on the Material Plane.
  - category: trait
    name: Incorporeal Movement
    text: The ghost can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.
  - category: action
    name: Multiattack
    text: The ghost makes two Withering Touch attacks.
  - category: action
    name: Withering Touch
    text: "*Melee Attack Roll:* +5, reach 5 ft. 19 (3d10 + 3) Necrotic damage."
  - category: action
    name: Horrific Visage
    text: "*Wisdom Saving Throw*: DC 13, each creature in a 60-foot Cone that can see the ghost and isn't an Undead. *Failure:*  10 (2d6 + 3) Psychic damage, and the target has the Frightened condition until the start of the ghost's next turn. *Success:*  The target is immune to this ghost's Horrific Visage for 24 hours."
  - category: action
    name: Possession
    recharge: Recharge 6
    text: "*Charisma Saving Throw*: DC 13, one Humanoid the ghost can see within 5 feet. *Failure:*  The target is possessed by the ghost; the ghost disappears, and the target has the Incapacitated condition and loses control of its body. The ghost now controls the body, but the target retains awareness. The ghost can't be targeted by any attack, spell, or other effect, except ones that specifically target Undead. The ghost's game statistics are the same, except it uses the possessed target's Speed, as well as the target's Strength, Dexterity, and Constitution modifiers. The possession lasts until the body drops to 0 Hit Points or the ghost leaves as a Bonus Action. When the possession ends, the ghost appears in an unoccupied space within 5 feet of the target, and the target is immune to this ghost's Possession for 24 hours. *Success:*  The target is immune to this ghost's Possession for 24 hours."
  - category: action
    name: Etherealness
    text: The ghost casts the *Etherealness* spell, requiring no spell components and using Charisma as the spellcasting ability. The ghost is visible on the Material Plane while on the Border Ethereal and vice versa, but it can't affect or be affected by anything on the other plane. - **At Will:** *Etherealness*

---

# Ghost
*Medium, Undead, Neutral Neutral*

**AC** 11
**HP** 45 (10d8)
**Initiative** +1 (11)
**Speed** 5 ft., fly 40 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 7 | 13 | 10 | 10 | 12 | 17 |

**Senses** darkvision 60 ft.; Passive Perception 11
**Languages** Common plus one other language
CR 4, PB +2, XP 1100

## Traits

**Ethereal Sight**
The ghost can see 60 feet into the Ethereal Plane when it is on the Material Plane.

**Incorporeal Movement**
The ghost can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.

## Actions

**Multiattack**
The ghost makes two Withering Touch attacks.

**Withering Touch**
*Melee Attack Roll:* +5, reach 5 ft. 19 (3d10 + 3) Necrotic damage.

**Horrific Visage**
*Wisdom Saving Throw*: DC 13, each creature in a 60-foot Cone that can see the ghost and isn't an Undead. *Failure:*  10 (2d6 + 3) Psychic damage, and the target has the Frightened condition until the start of the ghost's next turn. *Success:*  The target is immune to this ghost's Horrific Visage for 24 hours.

**Possession (Recharge 6)**
*Charisma Saving Throw*: DC 13, one Humanoid the ghost can see within 5 feet. *Failure:*  The target is possessed by the ghost; the ghost disappears, and the target has the Incapacitated condition and loses control of its body. The ghost now controls the body, but the target retains awareness. The ghost can't be targeted by any attack, spell, or other effect, except ones that specifically target Undead. The ghost's game statistics are the same, except it uses the possessed target's Speed, as well as the target's Strength, Dexterity, and Constitution modifiers. The possession lasts until the body drops to 0 Hit Points or the ghost leaves as a Bonus Action. When the possession ends, the ghost appears in an unoccupied space within 5 feet of the target, and the target is immune to this ghost's Possession for 24 hours. *Success:*  The target is immune to this ghost's Possession for 24 hours.

**Etherealness**
The ghost casts the *Etherealness* spell, requiring no spell components and using Charisma as the spellcasting ability. The ghost is visible on the Material Plane while on the Border Ethereal and vice versa, but it can't affect or be affected by anything on the other plane. - **At Will:** *Etherealness*
