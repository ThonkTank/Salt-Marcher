---
smType: creature
name: Adult Gold Dragon
size: Huge
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '19'
initiative: +6 (16)
hp: '243'
hitDice: 18d12 + 126
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 27
    saveProf: false
  - key: dex
    score: 14
    saveProf: true
    saveMod: 8
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
    score: 24
    saveProf: false
pb: '+6'
skills:
  - skill: Insight
    value: '8'
  - skill: Perception
    value: '14'
  - skill: Persuasion
    value: '13'
  - skill: Stealth
    value: '8'
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
cr: '17'
xp: '18000'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
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
    text: The dragon makes three Rend attacks. It can replace one attack with a use of (A) Spellcasting to cast *Guiding Bolt* (level 2 version) or (B) Weakening Breath.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            spell: Guiding Bolt
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +14, reach 10 ft. 17 (2d8 + 8) Slashing damage plus 4 (1d8) Fire damage.'
    attack:
      type: melee
      bonus: 14
      damage:
        - dice: 2d8
          bonus: 8
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
    text: '*Dexterity Saving Throw*: DC 21, each creature in a 60-foot Cone. *Failure:*  66 (12d10) Fire damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 21
      targeting:
        shape: cone
        size: 60 ft.
      onFail:
        effects:
          other: 66 (12d10) Fire damage.
        damage:
          - dice: 12d10
            bonus: 0
            type: Fire
            average: 66
        legacyEffects: 66 (12d10) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Weakening Breath
    entryType: save
    text: '*Strength Saving Throw*: DC 21, each creature that isn''t currently affected by this breath in a 60-foot Cone. *Failure:*  The target has Disadvantage on Strength-based D20 Test and subtracts 3 (1d6) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.'
    save:
      ability: str
      dc: 21
      targeting:
        shape: cone
        size: 60 ft.
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
              modifier: -3
              target: damage rolls
              description: subtracts 3 (1d6) from its damage rolls.
  - category: legendary
    name: Banish
    entryType: save
    text: '*Charisma Saving Throw*: DC 21, one creature the dragon can see within 120 feet. *Failure:*  10 (3d6) Force damage, and the target has the Incapacitated condition and is transported to a harmless demiplane until the start of the dragon''s next turn, at which point it reappears in an unoccupied space of the dragon''s choice within 120 feet of the dragon. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
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
          conditions:
            - condition: Incapacitated
              duration:
                type: until
                trigger: the start of the dragon's next turn
        damage:
          - dice: 3d6
            bonus: 0
            type: Force
            average: 10
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
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21, +13 to hit with spell attacks): - **At Will:** *Detect Magic*, *Guiding Bolt*, *Shapechange* - **1e/Day Each:** *Flame Strike*, *Zone of Truth*'
    spellcasting:
      ability: cha
      saveDC: 21
      attackBonus: 13
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
            - Zone of Truth
  - category: legendary
    name: Guiding Light
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Guiding Bolt* (level 2 version).
    spellcasting:
      ability: int
      spellLists: []
---

# Adult Gold Dragon
*Huge, Dragon, Lawful Good*

**AC** 19
**HP** 243 (18d12 + 126)
**Initiative** +6 (16)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 24
**Languages** Common, Draconic
CR 17, PB +6, XP 18000

## Traits

**Amphibious**
The dragon can breathe air and water.

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of (A) Spellcasting to cast *Guiding Bolt* (level 2 version) or (B) Weakening Breath.

**Rend**
*Melee Attack Roll:* +14, reach 10 ft. 17 (2d8 + 8) Slashing damage plus 4 (1d8) Fire damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 21, each creature in a 60-foot Cone. *Failure:*  66 (12d10) Fire damage. *Success:*  Half damage.

**Weakening Breath**
*Strength Saving Throw*: DC 21, each creature that isn't currently affected by this breath in a 60-foot Cone. *Failure:*  The target has Disadvantage on Strength-based D20 Test and subtracts 3 (1d6) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21, +13 to hit with spell attacks): - **At Will:** *Detect Magic*, *Guiding Bolt*, *Shapechange* - **1e/Day Each:** *Flame Strike*, *Zone of Truth*

## Legendary Actions

**Banish**
*Charisma Saving Throw*: DC 21, one creature the dragon can see within 120 feet. *Failure:*  10 (3d6) Force damage, and the target has the Incapacitated condition and is transported to a harmless demiplane until the start of the dragon's next turn, at which point it reappears in an unoccupied space of the dragon's choice within 120 feet of the dragon. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Guiding Light**
The dragon uses Spellcasting to cast *Guiding Bolt* (level 2 version).

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
