---
smType: creature
name: Ancient Gold Dragon
size: Gargantuan
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '22'
initiative: +6 (16)
hp: '546'
hitDice: 28d20 + 252
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 30
    saveProf: false
  - key: dex
    score: 14
    saveProf: true
    saveMod: 9
  - key: con
    score: 29
    saveProf: false
  - key: int
    score: 18
    saveProf: false
  - key: wis
    score: 17
    saveProf: true
    saveMod: 10
  - key: cha
    score: 28
    saveProf: false
pb: '+7'
skills:
  - skill: Insight
    value: '10'
  - skill: Perception
    value: '17'
  - skill: Persuasion
    value: '16'
  - skill: Stealth
    value: '9'
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
  - value: Fire
cr: '24'
xp: '62000'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
    trigger.activation: passive
    trigger.targeting:
      type: single
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
    text: The dragon makes three Rend attacks. It can replace one attack with a use of (A) Spellcasting to cast *Guiding Bolt* (level 4 version) or (B) Weakening Breath.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            spell: Guiding Bolt
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +17 to hit, reach 15 ft. 19 (2d8 + 10) Slashing damage plus 9 (2d8) Fire damage.'
    attack:
      type: melee
      bonus: 17
      damage:
        - dice: 2d8
          bonus: 10
          type: Slashing
          average: 19
        - dice: 2d8
          bonus: 0
          type: Fire
          average: 9
      reach: 15 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 24, each creature in a 90-foot Cone. *Failure:*  71 (13d10) Fire damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 24
      targeting:
        shape: cone
        size: 90 ft.
      onFail:
        effects:
          other: 71 (13d10) Fire damage.
        damage:
          - dice: 13d10
            bonus: 0
            type: Fire
            average: 71
        legacyEffects: 71 (13d10) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Weakening Breath
    entryType: save
    text: '*Strength Saving Throw*: DC 24, each creature that isn''t currently affected by this breath in a 90-foot Cone. *Failure:*  The target has Disadvantage on Strength-based D20 Test and subtracts 5 (1d10) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.'
    save:
      ability: str
      dc: 24
      targeting:
        shape: cone
        size: 90 ft.
      onFail:
        effects:
          mechanical:
            - type: disadvantage
              target: Strength-based D20 Test
              description: has Disadvantage on Strength-based D20 Test and
            - type: advantage
              target: Strength-based D20 Test
              description: advantage on Strength-based D20 Test and
            - type: penalty
              modifier: -5
              target: damage rolls
              description: subtracts 5 (1d10) from its damage rolls.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Banish
    entryType: save
    text: '*Charisma Saving Throw*: DC 24, one creature the dragon can see within 120 feet. *Failure:*  24 (7d6) Force damage, and the target has the Incapacitated condition and is transported to a harmless demiplane until the start of the dragon''s next turn, at which point it reappears in an unoccupied space of the dragon''s choice within 120 feet of the dragon. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: cha
      dc: 24
      targeting:
        type: single
        range: 120 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Incapacitated
              duration:
                type: until
                trigger: the start of the dragon's next turn
        damage:
          - dice: 7d6
            bonus: 0
            type: Force
            average: 24
    trigger.activation: action
    trigger.legendaryCost: 1
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
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 24, +16 to hit with spell attacks): - **At Will:** *Detect Magic*, *Guiding Bolt*, *Shapechange* - **1e/Day Each:** *Flame Strike*, *Word of Recall*, *Zone of Truth*'
    spellcasting:
      ability: cha
      saveDC: 24
      attackBonus: 16
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Guiding Bolt
            - Shapechange
        - frequency: 1/day
          spells:
            - Flame Strike
            - Word of Recall
            - Zone of Truth
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Guiding Light
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Guiding Bolt* (level 4 version).
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
---

# Ancient Gold Dragon
*Gargantuan, Dragon, Lawful Good*

**AC** 22
**HP** 546 (28d20 + 252)
**Initiative** +6 (16)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 27
**Languages** Common, Draconic
CR 24, PB +7, XP 62000

## Traits

**Amphibious**
The dragon can breathe air and water.

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of (A) Spellcasting to cast *Guiding Bolt* (level 4 version) or (B) Weakening Breath.

**Rend**
*Melee Attack Roll:* +17 to hit, reach 15 ft. 19 (2d8 + 10) Slashing damage plus 9 (2d8) Fire damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 24, each creature in a 90-foot Cone. *Failure:*  71 (13d10) Fire damage. *Success:*  Half damage.

**Weakening Breath**
*Strength Saving Throw*: DC 24, each creature that isn't currently affected by this breath in a 90-foot Cone. *Failure:*  The target has Disadvantage on Strength-based D20 Test and subtracts 5 (1d10) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 24, +16 to hit with spell attacks): - **At Will:** *Detect Magic*, *Guiding Bolt*, *Shapechange* - **1e/Day Each:** *Flame Strike*, *Word of Recall*, *Zone of Truth*

## Legendary Actions

**Banish**
*Charisma Saving Throw*: DC 24, one creature the dragon can see within 120 feet. *Failure:*  24 (7d6) Force damage, and the target has the Incapacitated condition and is transported to a harmless demiplane until the start of the dragon's next turn, at which point it reappears in an unoccupied space of the dragon's choice within 120 feet of the dragon. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Guiding Light**
The dragon uses Spellcasting to cast *Guiding Bolt* (level 4 version).

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
