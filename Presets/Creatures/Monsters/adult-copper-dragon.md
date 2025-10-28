---
smType: creature
name: Adult Copper Dragon
size: Huge
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: '18'
initiative: +5 (15)
hp: '184'
hitDice: 16d12 + 80
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 40 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 23
    saveProf: false
  - key: dex
    score: 12
    saveProf: true
    saveMod: 6
  - key: con
    score: 21
    saveProf: false
  - key: int
    score: 18
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 7
  - key: cha
    score: 18
    saveProf: false
pb: '+5'
skills:
  - skill: Deception
    value: '9'
  - skill: Perception
    value: '12'
  - skill: Stealth
    value: '6'
sensesList:
  - type: blindsight
    range: '60'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '22'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Acid
cr: '14'
xp: '11500'
entries:
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    entryType: special
    text: If the dragon fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 3
      reset: day
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of (A) Slowing Breath or (B) Spellcasting to cast *Mind Spike* (level 4 version).
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            spell: Mind Spike
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +11, reach 10 ft. 17 (2d10 + 6) Slashing damage plus 4 (1d8) Acid damage.'
    attack:
      type: melee
      bonus: 11
      damage:
        - dice: 2d10
          bonus: 6
          type: Slashing
          average: 17
        - dice: 1d8
          bonus: 0
          type: Acid
          average: 4
      reach: 10 ft.
  - category: action
    name: Acid Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 18, each creature in an 60-foot-long, 5-foot-wide Line. *Failure:*  54 (12d8) Acid damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 18
      targeting:
        shape: line
        size: 60 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 54 (12d8) Acid damage.
        damage:
          - dice: 12d8
            bonus: 0
            type: Acid
            average: 54
        legacyEffects: 54 (12d8) Acid damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Slowing Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  The target can''t take Reactions; its Speed is halved; and it can take either an action or a Bonus Action on its turn, not both. This effect lasts until the end of its next turn.'
    save:
      ability: con
      dc: 18
      targeting:
        shape: cone
        size: 60 ft.
      onFail:
        effects:
          mechanical:
            - type: penalty
              modifier: half
              target: Speed
              description: Speed is halved
            - type: other
              target: Reactions
              description: can't take Reactions
  - category: legendary
    name: Giggling Magic
    entryType: save
    text: '*Charisma Saving Throw*: DC 17, one creature the dragon can see within 90 feet. *Failure:*  24 (7d6) Psychic damage. Until the end of its next turn, the target rolls 1d6 whenever it makes an ability check or attack roll and subtracts the number rolled from the D20 Test. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: cha
      dc: 17
      targeting:
        type: single
        range: 90 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          other: 24 (7d6) Psychic damage. Until the end of its next turn, the target rolls 1d6 whenever it makes an ability check or attack roll and subtracts the number rolled from the D20 Test.
        damage:
          - dice: 7d6
            bonus: 0
            type: Psychic
            average: 24
        legacyEffects: 24 (7d6) Psychic damage. Until the end of its next turn, the target rolls 1d6 whenever it makes an ability check or attack roll and subtracts the number rolled from the D20 Test.
  - category: legendary
    name: Pounce
    entryType: multiattack
    text: The dragon moves up to half its Speed, and it makes one Rend attack.
    multiattack:
      attacks:
        - name: Rend
          count: 1
      substitutions: []
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17): - **At Will:** *Detect Magic*, *Mind Spike*, *Minor Illusion*, *Shapechange* - **1e/Day Each:** *Greater Restoration*, *Major Image*'
    spellcasting:
      ability: cha
      saveDC: 17
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Mind Spike
            - Minor Illusion
            - Shapechange
        - frequency: 1/day
          spells:
            - Greater Restoration
            - Major Image
  - category: legendary
    name: Mind Jolt
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Mind Spike* (level 4 version). The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
---

# Adult Copper Dragon
*Huge, Dragon, Chaotic Good*

**AC** 18
**HP** 184 (16d12 + 80)
**Initiative** +5 (15)
**Speed** 40 ft., climb 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 22
**Languages** Common, Draconic
CR 14, PB +5, XP 11500

## Traits

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of (A) Slowing Breath or (B) Spellcasting to cast *Mind Spike* (level 4 version).

**Rend**
*Melee Attack Roll:* +11, reach 10 ft. 17 (2d10 + 6) Slashing damage plus 4 (1d8) Acid damage.

**Acid Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 18, each creature in an 60-foot-long, 5-foot-wide Line. *Failure:*  54 (12d8) Acid damage. *Success:*  Half damage.

**Slowing Breath**
*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  The target can't take Reactions; its Speed is halved; and it can take either an action or a Bonus Action on its turn, not both. This effect lasts until the end of its next turn.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17): - **At Will:** *Detect Magic*, *Mind Spike*, *Minor Illusion*, *Shapechange* - **1e/Day Each:** *Greater Restoration*, *Major Image*

## Legendary Actions

**Giggling Magic**
*Charisma Saving Throw*: DC 17, one creature the dragon can see within 90 feet. *Failure:*  24 (7d6) Psychic damage. Until the end of its next turn, the target rolls 1d6 whenever it makes an ability check or attack roll and subtracts the number rolled from the D20 Test. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Mind Jolt**
The dragon uses Spellcasting to cast *Mind Spike* (level 4 version). The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
