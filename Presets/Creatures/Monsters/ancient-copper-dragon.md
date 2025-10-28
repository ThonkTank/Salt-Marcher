---
smType: creature
name: Ancient Copper Dragon
size: Gargantuan
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: '21'
initiative: +5 (15)
hp: '367'
hitDice: 21d20 + 147
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 40 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 27
    saveProf: false
  - key: dex
    score: 12
    saveProf: true
    saveMod: 8
  - key: con
    score: 25
    saveProf: false
  - key: int
    score: 20
    saveProf: false
  - key: wis
    score: 17
    saveProf: true
    saveMod: 10
  - key: cha
    score: 22
    saveProf: false
pb: '+7'
skills:
  - skill: Deception
    value: '13'
  - skill: Perception
    value: '17'
  - skill: Stealth
    value: '8'
sensesList:
  - type: blindsight
    range: '60'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '27'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Acid
cr: '21'
xp: '33000'
entries:
  - category: trait
    name: Legendary Resistance (4/Day, or 5/Day in Lair)
    entryType: special
    text: If the dragon fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 4
      reset: day
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of (A) Slowing Breath or (B) Spellcasting to cast *Mind Spike* (level 5 version).
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
    text: '*Melee Attack Roll:* +15, reach 15 ft. 19 (2d10 + 8) Slashing damage plus 9 (2d8) Acid damage.'
    attack:
      type: melee
      bonus: 15
      damage:
        - dice: 2d10
          bonus: 8
          type: Slashing
          average: 19
        - dice: 2d8
          bonus: 0
          type: Acid
          average: 9
      reach: 15 ft.
  - category: action
    name: Acid Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 22, each creature in an 90-foot-long, 10-foot-wide Line. *Failure:*  63 (14d8) Acid damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 22
      targeting:
        shape: line
        size: 90 ft.
        width: 10 ft.
      onFail:
        effects:
          other: 63 (14d8) Acid damage.
        damage:
          - dice: 14d8
            bonus: 0
            type: Acid
            average: 63
        legacyEffects: 63 (14d8) Acid damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Slowing Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 22, each creature in a 90-foot Cone. *Failure:*  The target can''t take Reactions; its Speed is halved; and it can take either an action or a Bonus Action on its turn, not both. This effect lasts until the end of its next turn.'
    save:
      ability: con
      dc: 22
      targeting:
        shape: cone
        size: 90 ft.
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
    text: '*Charisma Saving Throw*: DC 21, one creature the dragon can see within 120 feet. *Failure:*  31 (9d6) Psychic damage. Until the end of its next turn, the target rolls 1d8 whenever it makes an ability check or attack roll and subtracts the number rolled from the D20 Test. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: cha
      dc: 21
      targeting:
        type: single
        range: 120 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          other: 31 (9d6) Psychic damage. Until the end of its next turn, the target rolls 1d8 whenever it makes an ability check or attack roll and subtracts the number rolled from the D20 Test.
        damage:
          - dice: 9d6
            bonus: 0
            type: Psychic
            average: 31
        legacyEffects: 31 (9d6) Psychic damage. Until the end of its next turn, the target rolls 1d8 whenever it makes an ability check or attack roll and subtracts the number rolled from the D20 Test.
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
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21): - **At Will:** *Detect Magic*, *Mind Spike*, *Minor Illusion*, *Shapechange* - **1e/Day Each:** *Greater Restoration*, *Major Image*, *Project Image*'
    spellcasting:
      ability: cha
      saveDC: 21
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
            - Project Image
  - category: legendary
    name: Mind Jolt
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Mind Spike* (level 5 version). The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
---

# Ancient Copper Dragon
*Gargantuan, Dragon, Chaotic Good*

**AC** 21
**HP** 367 (21d20 + 147)
**Initiative** +5 (15)
**Speed** 40 ft., climb 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 27
**Languages** Common, Draconic
CR 21, PB +7, XP 33000

## Traits

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of (A) Slowing Breath or (B) Spellcasting to cast *Mind Spike* (level 5 version).

**Rend**
*Melee Attack Roll:* +15, reach 15 ft. 19 (2d10 + 8) Slashing damage plus 9 (2d8) Acid damage.

**Acid Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 22, each creature in an 90-foot-long, 10-foot-wide Line. *Failure:*  63 (14d8) Acid damage. *Success:*  Half damage.

**Slowing Breath**
*Constitution Saving Throw*: DC 22, each creature in a 90-foot Cone. *Failure:*  The target can't take Reactions; its Speed is halved; and it can take either an action or a Bonus Action on its turn, not both. This effect lasts until the end of its next turn.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21): - **At Will:** *Detect Magic*, *Mind Spike*, *Minor Illusion*, *Shapechange* - **1e/Day Each:** *Greater Restoration*, *Major Image*, *Project Image*

## Legendary Actions

**Giggling Magic**
*Charisma Saving Throw*: DC 21, one creature the dragon can see within 120 feet. *Failure:*  31 (9d6) Psychic damage. Until the end of its next turn, the target rolls 1d8 whenever it makes an ability check or attack roll and subtracts the number rolled from the D20 Test. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Mind Jolt**
The dragon uses Spellcasting to cast *Mind Spike* (level 5 version). The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
