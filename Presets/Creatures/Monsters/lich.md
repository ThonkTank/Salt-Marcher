---
smType: creature
name: Lich
size: Medium
type: Undead
typeTags:
  - value: Wizard
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '20'
initiative: +7 (17)
hp: '315'
hitDice: 42d8 + 126
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 11
    saveProf: false
  - key: dex
    score: 16
    saveProf: true
    saveMod: 10
  - key: con
    score: 16
    saveProf: true
    saveMod: 10
  - key: int
    score: 21
    saveProf: true
    saveMod: 12
  - key: wis
    score: 14
    saveProf: true
    saveMod: 9
  - key: cha
    score: 16
    saveProf: false
pb: '+7'
skills:
  - skill: Arcana
    value: '19'
  - skill: History
    value: '12'
  - skill: Insight
    value: '9'
  - skill: Perception
    value: '9'
sensesList:
  - type: truesight
    range: '120'
passivesList:
  - skill: Perception
    value: '19'
languagesList:
  - value: All
damageResistancesList:
  - value: Cold
  - value: Lightning
damageImmunitiesList:
  - value: Necrotic
  - value: Poison; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Frightened
  - value: Paralyzed
  - value: Poisoned
cr: '21'
xp: '33000'
entries:
  - category: trait
    name: Legendary Resistance (4/Day, or 5/Day in Lair)
    entryType: special
    text: If the lich fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 4
      reset: day
  - category: trait
    name: Spirit Jar
    entryType: special
    text: If destroyed, the lich reforms in 1d10 days if it has a spirit jar, reviving with all its Hit Points. The new body appears in an unoccupied space within the lich's lair.
  - category: action
    name: Multiattack
    entryType: special
    text: The lich makes three attacks, using Eldritch Burst or Paralyzing Touch in any combination.
  - category: action
    name: Eldritch Burst
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +12, reach 5 ft. or range 120 ft. 31 (4d12 + 5) Force damage.'
  - category: action
    name: Paralyzing Touch
    entryType: attack
    text: '*Melee Attack Roll:* +12, reach 5 ft. 15 (3d6 + 5) Cold damage, and the target has the Paralyzed condition until the start of the lich''s next turn.'
    attack:
      type: melee
      bonus: 12
      damage:
        - dice: 3d6
          bonus: 5
          type: Cold
          average: 15
      reach: 5 ft.
  - category: legendary
    name: Deathly Teleport
    entryType: special
    text: The lich teleports up to 60 feet to an unoccupied space it can see, and each creature within 10 feet of the space it left takes 11 (2d10) Necrotic damage.
  - category: legendary
    name: Disrupt Life
    entryType: save
    text: '*Constitution Saving Throw*: DC 20, each creature that isn''t an Undead in a 20-foot Emanation originating from the lich. *Failure:*  31 (9d6) Necrotic damage. *Success:*  Half damage. *Failure or Success*:  The lich can''t take this action again until the start of its next turn.'
    save:
      ability: con
      dc: 20
      targeting:
        shape: emanation
        size: 20 ft.
        origin: self
      onFail:
        effects:
          other: 31 (9d6) Necrotic damage.
        damage:
          - dice: 9d6
            bonus: 0
            type: Necrotic
            average: 31
        legacyEffects: 31 (9d6) Necrotic damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The lich casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 20): - **At Will:** *Detect Magic*, *Detect Thoughts*, *Dispel Magic*, *Fireball*, *Invisibility*, *Lightning Bolt*, *Mage Hand*, *Prestidigitation* - **2e/Day Each:** *Animate Dead*, *Dimension Door*, *Plane Shift* - **1e/Day Each:** *Chain Lightning*, *Finger of Death*, *Power Word Kill*, *Scrying*'
    spellcasting:
      ability: int
      saveDC: 20
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Detect Thoughts
            - Dispel Magic
            - Fireball
            - Invisibility
            - Lightning Bolt
            - Mage Hand
            - Prestidigitation
        - frequency: 2/day
          spells:
            - Animate Dead
            - Dimension Door
            - Plane Shift
        - frequency: 1/day
          spells:
            - Chain Lightning
            - Finger of Death
            - Power Word Kill
            - Scrying
  - category: reaction
    name: Protective Magic
    entryType: spellcasting
    text: The lich casts *Counterspell* or *Shield* in response to the spell's trigger, using the same spellcasting ability as Spellcasting.
    spellcasting:
      ability: int
      spellLists: []
  - category: legendary
    name: Frightening Gaze
    entryType: spellcasting
    text: The lich casts *Fear*, using the same spellcasting ability as Spellcasting. The lich can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
---

# Lich
*Medium, Undead, Neutral Evil*

**AC** 20
**HP** 315 (42d8 + 126)
**Initiative** +7 (17)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

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
