---
smType: creature
name: Ancient Brass Dragon
size: Gargantuan
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: '20'
initiative: +4 (14)
hp: '332'
hitDice: 19d20 + 133
speeds:
  walk:
    distance: 40 ft.
  burrow:
    distance: 40 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 27
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 6
  - key: con
    score: 25
    saveProf: false
  - key: int
    score: 16
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 8
  - key: cha
    score: 22
    saveProf: false
pb: '+6'
skills:
  - skill: History
    value: '9'
  - skill: Perception
    value: '14'
  - skill: Persuasion
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
    value: '24'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Fire
cr: '20'
xp: '25000'
entries:
  - category: trait
    name: Legendary Resistance (4/Day, or 5/Day in Lair)
    entryType: special
    text: If the dragon fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 4
      reset: day
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of (A) Sleep Breath or (B) Spellcasting to cast *Scorching Ray* (level 3 version).
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            spell: Scorching Ray
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +14, reach 15 ft. 19 (2d10 + 8) Slashing damage plus 7 (2d6) Fire damage.'
    attack:
      type: melee
      bonus: 14
      damage:
        - dice: 2d10
          bonus: 8
          type: Slashing
          average: 19
        - dice: 2d6
          bonus: 0
          type: Fire
          average: 7
      reach: 15 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 21, each creature in a 90-foot-long, 5-foot-wide Line. *Failure:*  58 (13d8) Fire damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 21
      targeting:
        shape: line
        size: 90 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 58 (13d8) Fire damage.
        damage:
          - dice: 13d8
            bonus: 0
            type: Fire
            average: 58
        legacyEffects: 58 (13d8) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Sleep Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 21, each creature in a 90-foot Cone. *Failure:*  The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. *Second Failure* The target has the Unconscious condition for 10 minutes. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.'
    save:
      ability: con
      dc: 21
      targeting:
        shape: cone
        size: 90 ft.
      onFail:
        effects:
          conditions:
            - condition: Incapacitated
              duration:
                type: until
                trigger: the end of its next turn
              saveToEnd:
                timing: custom
            - condition: Unconscious
              duration:
                type: until
                trigger: the end of its next turn
              saveToEnd:
                timing: custom
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Pounce
    entryType: multiattack
    text: The dragon moves up to half its Speed, and it makes one Rend attack.
    multiattack:
      attacks:
        - name: Rend
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: self
  - category: legendary
    name: Scorching Sands
    entryType: save
    text: '*Dexterity Saving Throw*: DC 20, one creature the dragon can see within 120 feet. *Failure:*  36 (8d8) Fire damage, and the target''s Speed is halved until the end of its next turn. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: dex
      dc: 20
      targeting:
        type: single
        range: 120 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          mechanical:
            - type: penalty
              modifier: half
              target: Speed
              description: Speed is halved
        damage:
          - dice: 8d8
            bonus: 0
            type: Fire
            average: 36
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 20): - **At Will:** *Detect Magic*, *Minor Illusion*, *Scorching Ray*, *Shapechange*, *Speak with Animals* - **1e/Day Each:** *Control Weather*, *Detect Thoughts*'
    spellcasting:
      ability: cha
      saveDC: 20
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Minor Illusion
            - Scorching Ray
            - Shapechange
            - Speak with Animals
        - frequency: 1/day
          spells:
            - Control Weather
            - Detect Thoughts
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Blazing Light
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Scorching Ray* (level 3 version).
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
---

# Ancient Brass Dragon
*Gargantuan, Dragon, Chaotic Good*

**AC** 20
**HP** 332 (19d20 + 133)
**Initiative** +4 (14)
**Speed** 40 ft., fly 80 ft., burrow 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 24
**Languages** Common, Draconic
CR 20, PB +6, XP 25000

## Traits

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of (A) Sleep Breath or (B) Spellcasting to cast *Scorching Ray* (level 3 version).

**Rend**
*Melee Attack Roll:* +14, reach 15 ft. 19 (2d10 + 8) Slashing damage plus 7 (2d6) Fire damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 21, each creature in a 90-foot-long, 5-foot-wide Line. *Failure:*  58 (13d8) Fire damage. *Success:*  Half damage.

**Sleep Breath**
*Constitution Saving Throw*: DC 21, each creature in a 90-foot Cone. *Failure:*  The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. *Second Failure* The target has the Unconscious condition for 10 minutes. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 20): - **At Will:** *Detect Magic*, *Minor Illusion*, *Scorching Ray*, *Shapechange*, *Speak with Animals* - **1e/Day Each:** *Control Weather*, *Detect Thoughts*

## Legendary Actions

**Blazing Light**
The dragon uses Spellcasting to cast *Scorching Ray* (level 3 version).

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.

**Scorching Sands**
*Dexterity Saving Throw*: DC 20, one creature the dragon can see within 120 feet. *Failure:*  36 (8d8) Fire damage, and the target's Speed is halved until the end of its next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.
