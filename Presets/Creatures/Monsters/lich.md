---
smType: creature
name: Lich
size: Medium
type: Undead
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: "20"
initiative: +7 (17)
hp: "315"
hitDice: 42d8 + 126
speeds:
  - type: walk
    value: "30"
abilities:
  - ability: str
    score: 11
  - ability: dex
    score: 16
  - ability: con
    score: 16
  - ability: int
    score: 21
  - ability: wis
    score: 14
  - ability: cha
    score: 16
pb: "+7"
cr: "21"
xp: "33000"
sensesList:
  - type: truesight
    range: "120"
languagesList:
  - value: All
passivesList:
  - skill: Perception
    value: "19"
damageResistancesList:
  - value: Cold
  - value: Lightning
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
    name: Legendary Resistance (4/Day, or 5/Day in Lair)
    text: If the lich fails a saving throw, it can choose to succeed instead.
  - category: trait
    name: Spirit Jar
    text: If destroyed, the lich reforms in 1d10 days if it has a spirit jar, reviving with all its Hit Points. The new body appears in an unoccupied space within the lich's lair.
  - category: action
    name: Multiattack
    text: The lich makes three attacks, using Eldritch Burst or Paralyzing Touch in any combination.
  - category: action
    name: Eldritch Burst
    text: "*Melee or Ranged Attack Roll:* +12, reach 5 ft. or range 120 ft. 31 (4d12 + 5) Force damage."
  - category: action
    name: Paralyzing Touch
    text: "*Melee Attack Roll:* +12, reach 5 ft. 15 (3d6 + 5) Cold damage, and the target has the Paralyzed condition until the start of the lich's next turn."
  - category: action
    name: Spellcasting
    text: "The lich casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 20): - **At Will:** *Detect Magic*, *Detect Thoughts*, *Dispel Magic*, *Fireball*, *Invisibility*, *Lightning Bolt*, *Mage Hand*, *Prestidigitation* - **2e/Day Each:** *Animate Dead*, *Dimension Door*, *Plane Shift* - **1e/Day Each:** *Chain Lightning*, *Finger of Death*, *Power Word Kill*, *Scrying*"
  - category: reaction
    name: Protective Magic
    text: The lich casts *Counterspell* or *Shield* in response to the spell's trigger, using the same spellcasting ability as Spellcasting.
  - category: legendary
    name: Deathly Teleport
    text: The lich teleports up to 60 feet to an unoccupied space it can see, and each creature within 10 feet of the space it left takes 11 (2d10) Necrotic damage.
  - category: legendary
    name: Disrupt Life
    text: "*Constitution Saving Throw*: DC 20, each creature that isn't an Undead in a 20-foot Emanation originating from the lich. *Failure:*  31 (9d6) Necrotic damage. *Success:*  Half damage. *Failure or Success*:  The lich can't take this action again until the start of its next turn."
  - category: legendary
    name: Frightening Gaze
    text: The lich casts *Fear*, using the same spellcasting ability as Spellcasting. The lich can't take this action again until the start of its next turn.

---

# Lich
*Medium, Undead, Neutral Evil*

**AC** 20
**HP** 315 (42d8 + 126)
**Initiative** +7 (17)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 11 | 16 | 16 | 21 | 14 | 16 |

**Senses** truesight 120 ft.; Passive Perception 19
**Languages** All
CR 21, PB +7, XP 33000

## Traits

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the lich fails a saving throw, it can choose to succeed instead.

**Spirit Jar**
If destroyed, the lich reforms in 1d10 days if it has a spirit jar, reviving with all its Hit Points. The new body appears in an unoccupied space within the lich's lair.

## Actions

**Multiattack**
The lich makes three attacks, using Eldritch Burst or Paralyzing Touch in any combination.

**Eldritch Burst**
*Melee or Ranged Attack Roll:* +12, reach 5 ft. or range 120 ft. 31 (4d12 + 5) Force damage.

**Paralyzing Touch**
*Melee Attack Roll:* +12, reach 5 ft. 15 (3d6 + 5) Cold damage, and the target has the Paralyzed condition until the start of the lich's next turn.

**Spellcasting**
The lich casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 20): - **At Will:** *Detect Magic*, *Detect Thoughts*, *Dispel Magic*, *Fireball*, *Invisibility*, *Lightning Bolt*, *Mage Hand*, *Prestidigitation* - **2e/Day Each:** *Animate Dead*, *Dimension Door*, *Plane Shift* - **1e/Day Each:** *Chain Lightning*, *Finger of Death*, *Power Word Kill*, *Scrying*

## Reactions

**Protective Magic**
The lich casts *Counterspell* or *Shield* in response to the spell's trigger, using the same spellcasting ability as Spellcasting.

## Legendary Actions

**Deathly Teleport**
The lich teleports up to 60 feet to an unoccupied space it can see, and each creature within 10 feet of the space it left takes 11 (2d10) Necrotic damage.

**Disrupt Life**
*Constitution Saving Throw*: DC 20, each creature that isn't an Undead in a 20-foot Emanation originating from the lich. *Failure:*  31 (9d6) Necrotic damage. *Success:*  Half damage. *Failure or Success*:  The lich can't take this action again until the start of its next turn.

**Frightening Gaze**
The lich casts *Fear*, using the same spellcasting ability as Spellcasting. The lich can't take this action again until the start of its next turn.
