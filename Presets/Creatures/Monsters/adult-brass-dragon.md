---
smType: creature
name: Adult Brass Dragon
size: Huge
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: '18'
initiative: +4 (14)
hp: '172'
hitDice: 15d12 + 75
speeds:
  walk:
    distance: 40 ft.
  burrow:
    distance: 30 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 23
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 5
  - key: con
    score: 21
    saveProf: false
  - key: int
    score: 14
    saveProf: false
  - key: wis
    score: 13
    saveProf: true
    saveMod: 6
  - key: cha
    score: 17
    saveProf: false
pb: '+5'
skills:
  - skill: History
    value: '7'
  - skill: Perception
    value: '11'
  - skill: Persuasion
    value: '8'
  - skill: Stealth
    value: '5'
sensesList:
  - type: blindsight
    range: '60'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '21'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Fire
cr: '13'
xp: '10000'
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
    text: The dragon makes three Rend attacks. It can replace one attack with a use of (A) Sleep Breath or (B) Spellcasting to cast *Scorching Ray*.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            spell: Scorching Ray
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +11, reach 10 ft. 17 (2d10 + 6) Slashing damage plus 4 (1d8) Fire damage.'
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
          type: Fire
          average: 4
      reach: 10 ft.
  - category: action
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 18, each creature in a 60-foot-long, 5-foot-wide Line. *Failure:*  45 (10d8) Fire damage. *Success:*  Half damage.'
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
          other: 45 (10d8) Fire damage.
        damage:
          - dice: 10d8
            bonus: 0
            type: Fire
            average: 45
        legacyEffects: 45 (10d8) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Sleep Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. *Second Failure* The target has the Unconscious condition for 10 minutes. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.'
    save:
      ability: con
      dc: 18
      targeting:
        shape: cone
        size: 60 ft.
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
  - category: legendary
    name: Pounce
    entryType: multiattack
    text: The dragon moves up to half its Speed, and it makes one Rend attack.
    multiattack:
      attacks:
        - name: Rend
          count: 1
      substitutions: []
  - category: legendary
    name: Scorching Sands
    entryType: save
    text: '*Dexterity Saving Throw*: DC 16, one creature the dragon can see within 120 feet. *Failure:*  27 (6d8) Fire damage, and the target''s Speed is halved until the end of its next turn. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: dex
      dc: 16
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
          - dice: 6d8
            bonus: 0
            type: Fire
            average: 27
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16): - **At Will:** *Detect Magic*, *Minor Illusion*, *Scorching Ray*, *Shapechange*, *Speak with Animals* - **1e/Day Each:** *Detect Thoughts*, *Control Weather*'
    spellcasting:
      ability: cha
      saveDC: 16
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
            - Detect Thoughts
            - Control Weather
  - category: legendary
    name: Blazing Light
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Scorching Ray*.
    spellcasting:
      ability: int
      spellLists: []
---

# Adult Brass Dragon
*Huge, Dragon, Chaotic Good*

**AC** 18
**HP** 172 (15d12 + 75)
**Initiative** +4 (14)
**Speed** 40 ft., fly 80 ft., burrow 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 21
**Languages** Common, Draconic
CR 13, PB +5, XP 10000

## Traits

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of (A) Sleep Breath or (B) Spellcasting to cast *Scorching Ray*.

**Rend**
*Melee Attack Roll:* +11, reach 10 ft. 17 (2d10 + 6) Slashing damage plus 4 (1d8) Fire damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 18, each creature in a 60-foot-long, 5-foot-wide Line. *Failure:*  45 (10d8) Fire damage. *Success:*  Half damage.

**Sleep Breath**
*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. *Second Failure* The target has the Unconscious condition for 10 minutes. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16): - **At Will:** *Detect Magic*, *Minor Illusion*, *Scorching Ray*, *Shapechange*, *Speak with Animals* - **1e/Day Each:** *Detect Thoughts*, *Control Weather*

## Legendary Actions

**Blazing Light**
The dragon uses Spellcasting to cast *Scorching Ray*.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.

**Scorching Sands**
*Dexterity Saving Throw*: DC 16, one creature the dragon can see within 120 feet. *Failure:*  27 (6d8) Fire damage, and the target's Speed is halved until the end of its next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.
