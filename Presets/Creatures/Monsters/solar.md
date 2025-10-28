---
smType: creature
name: Solar
size: Large
type: Celestial
typeTags:
  - value: Angel
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '21'
initiative: +20 (30)
hp: '297'
hitDice: 22d10 + 176
speeds:
  walk:
    distance: 50 ft.
  fly:
    distance: 150 ft.
    hover: true
abilities:
  - key: str
    score: 26
    saveProf: false
  - key: dex
    score: 22
    saveProf: false
  - key: con
    score: 26
    saveProf: false
  - key: int
    score: 25
    saveProf: false
  - key: wis
    score: 25
    saveProf: false
  - key: cha
    score: 30
    saveProf: false
pb: '+7'
skills:
  - skill: Perception
    value: '14'
sensesList:
  - type: truesight
    range: '120'
passivesList:
  - skill: Perception
    value: '24'
languagesList:
  - value: All
  - value: telepathy 120 ft.
damageImmunitiesList:
  - value: Poison
  - value: Radiant; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Frightened
  - value: Poisoned
cr: '21'
xp: '33000'
entries:
  - category: trait
    name: Divine Awareness
    entryType: special
    text: The solar knows if it hears a lie.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Exalted Restoration
    entryType: special
    text: If the solar dies outside Mount Celestia, its body disappears, and it gains a new body instantly, reviving with all its Hit Points somewhere in Mount Celestia.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Legendary Resistance (4/Day)
    entryType: special
    text: If the solar fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 4
      reset: day
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The solar has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The solar makes two Flying Sword attacks. It can replace one attack with a use of Slaying Bow.
    multiattack:
      attacks:
        - name: Sword
          count: 1
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Slaying Bow
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Flying Sword
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +15, reach 10 ft. or range 120 ft. 22 (4d6 + 8) Slashing damage plus 36 (8d8) Radiant damage. HitomThe sword magically returns to the solar''s hand or hovers within 5 feet of the solar immediately after a ranged attack.'
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Slaying Bow
    entryType: save
    text: '*Dexterity Saving Throw*: DC 21, one creature the solar can see within 600 feet. *Failure:*  If the creature has 100 Hit Points or fewer, it dies. It otherwise takes 24 (4d8 + 6) Piercing damage plus 36 (8d8) Radiant damage.'
    save:
      ability: dex
      dc: 21
      targeting:
        type: single
        range: 600 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          other: If the creature has 100 Hit Points or fewer, it dies. It otherwise takes 24 (4d8 + 6) Piercing damage plus 36 (8d8) Radiant damage.
        damage:
          - dice: 4d8
            bonus: 6
            type: Piercing
            average: 24
          - dice: 8d8
            bonus: 0
            type: Radiant
            average: 36
        legacyEffects: If the creature has 100 Hit Points or fewer, it dies. It otherwise takes 24 (4d8 + 6) Piercing damage plus 36 (8d8) Radiant damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Blinding Gaze
    entryType: save
    text: '*Constitution Saving Throw*: DC 25, one creature the solar can see within 120 feet. *Failure:*  The target has the Blinded condition for 1 minute. *Failure or Success*:  The solar can''t take this action again until the start of its next turn.'
    save:
      ability: con
      dc: 25
      targeting:
        type: single
        range: 120 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Blinded
              duration:
                type: minutes
                count: 1
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
  - category: legendary
    name: Radiant Teleport
    entryType: save
    text: 'The solar teleports up to 60 feet to an unoccupied space it can see. *Dexterity Saving Throw*: DC 25, each creature in a 10-foot Emanation originating from the solar at its destination space. *Failure:*  11 (2d10) Radiant damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 25
      targeting:
        shape: emanation
        size: 10 ft.
        origin: self
      onFail:
        effects:
          other: 11 (2d10) Radiant damage.
        damage:
          - dice: 2d10
            bonus: 0
            type: Radiant
            average: 11
        legacyEffects: 11 (2d10) Radiant damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The solar casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 25): - **At Will:** *Detect Evil and Good* - **1e/Day Each:** *Commune*, *Control Weather*, *Dispel Evil and Good*, *Resurrection*'
    spellcasting:
      ability: cha
      saveDC: 25
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Evil and Good
        - frequency: 1/day
          spells:
            - Commune
            - Control Weather
            - Dispel Evil and Good
            - Resurrection
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Divine Aid (3/Day)
    entryType: spellcasting
    text: The solar casts *Cure Wounds* (level 2 version), *Lesser Restoration*, or *Remove Curse*, using the same spellcasting ability as Spellcasting.
    limitedUse:
      count: 3
      reset: day
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Solar
*Large, Celestial, Lawful Good*

**AC** 21
**HP** 297 (22d10 + 176)
**Initiative** +20 (30)
**Speed** 50 ft., fly 150 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 120 ft.; Passive Perception 24
**Languages** All, telepathy 120 ft.
CR 21, PB +7, XP 33000

## Traits

**Divine Awareness**
The solar knows if it hears a lie.

**Exalted Restoration**
If the solar dies outside Mount Celestia, its body disappears, and it gains a new body instantly, reviving with all its Hit Points somewhere in Mount Celestia.

**Legendary Resistance (4/Day)**
If the solar fails a saving throw, it can choose to succeed instead.

**Magic Resistance**
The solar has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The solar makes two Flying Sword attacks. It can replace one attack with a use of Slaying Bow.

**Flying Sword**
*Melee or Ranged Attack Roll:* +15, reach 10 ft. or range 120 ft. 22 (4d6 + 8) Slashing damage plus 36 (8d8) Radiant damage. HitomThe sword magically returns to the solar's hand or hovers within 5 feet of the solar immediately after a ranged attack.

**Slaying Bow**
*Dexterity Saving Throw*: DC 21, one creature the solar can see within 600 feet. *Failure:*  If the creature has 100 Hit Points or fewer, it dies. It otherwise takes 24 (4d8 + 6) Piercing damage plus 36 (8d8) Radiant damage.

**Spellcasting**
The solar casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 25): - **At Will:** *Detect Evil and Good* - **1e/Day Each:** *Commune*, *Control Weather*, *Dispel Evil and Good*, *Resurrection*

## Bonus Actions

**Divine Aid (3/Day)**
The solar casts *Cure Wounds* (level 2 version), *Lesser Restoration*, or *Remove Curse*, using the same spellcasting ability as Spellcasting.

## Legendary Actions

**Blinding Gaze**
*Constitution Saving Throw*: DC 25, one creature the solar can see within 120 feet. *Failure:*  The target has the Blinded condition for 1 minute. *Failure or Success*:  The solar can't take this action again until the start of its next turn.

**Radiant Teleport**
The solar teleports up to 60 feet to an unoccupied space it can see. *Dexterity Saving Throw*: DC 25, each creature in a 10-foot Emanation originating from the solar at its destination space. *Failure:*  11 (2d10) Radiant damage. *Success:*  Half damage.
