---
smType: creature
name: Adult Black Dragon
size: Huge
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '19'
initiative: +6 (16)
hp: '195'
hitDice: 17d12 + 85
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 23
    saveProf: false
  - key: dex
    score: 14
    saveProf: true
    saveMod: 7
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
    score: 19
    saveProf: false
pb: '+5'
skills:
  - skill: Perception
    value: '11'
  - skill: Stealth
    value: '7'
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
  - value: Acid
cr: '14'
xp: '11500'
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
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Acid Arrow* (level 3 version).
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            spell: Acid Arrow
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +11, reach 10 ft. 13 (2d6 + 6) Slashing damage plus 4 (1d8) Acid damage.'
    attack:
      type: melee
      bonus: 11
      damage:
        - dice: 2d6
          bonus: 6
          type: Slashing
          average: 13
        - dice: 1d8
          bonus: 0
          type: Acid
          average: 4
      reach: 10 ft.
  - category: action
    name: Acid Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 18, each creature in a 60-foot-long, 5-foot-wide Line. *Failure:*  54 (12d8) Acid damage. *Success:*  Half damage.'
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
  - category: legendary
    name: Cloud of Insects
    entryType: save
    text: '*Dexterity Saving Throw*: DC 17, one creature the dragon can see within 120 feet. *Failure:*  22 (4d10) Poison damage, and the target has Disadvantage on saving throws to maintain  Concentration until the end of its next turn. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: dex
      dc: 17
      targeting:
        type: single
        range: 120 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          mechanical:
            - type: disadvantage
              target: saving throws to maintain  Concentration until the end of its next turn
              description: has Disadvantage on saving throws to maintain  Concentration until the end of its next turn.
            - type: advantage
              target: saving throws to maintain  Concentration until the end of its next turn
              description: advantage on saving throws to maintain  Concentration until the end of its next turn.
        damage:
          - dice: 4d10
            bonus: 0
            type: Poison
            average: 22
  - category: legendary
    name: Pounce
    entryType: multiattack
    text: The dragon can move up to half its Speed, and it makes one Rend attack.
    multiattack:
      attacks:
        - name: Rend
          count: 1
      substitutions: []
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17, +9 to hit with spell attacks): - **At Will:** *Detect Magic*, *Fear*, *Acid Arrow* - **1e/Day Each:** *Speak with Dead*, *Vitriolic Sphere*'
    spellcasting:
      ability: cha
      saveDC: 17
      attackBonus: 9
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Fear
            - Acid Arrow
        - frequency: 1/day
          spells:
            - Speak with Dead
            - Vitriolic Sphere
  - category: legendary
    name: Frightful Presence
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Fear*. The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
---

# Adult Black Dragon
*Huge, Dragon, Chaotic Evil*

**AC** 19
**HP** 195 (17d12 + 85)
**Initiative** +6 (16)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 21
**Languages** Common, Draconic
CR 14, PB +5, XP 11500

## Traits

**Amphibious**
The dragon can breathe air and water.

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Acid Arrow* (level 3 version).

**Rend**
*Melee Attack Roll:* +11, reach 10 ft. 13 (2d6 + 6) Slashing damage plus 4 (1d8) Acid damage.

**Acid Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 18, each creature in a 60-foot-long, 5-foot-wide Line. *Failure:*  54 (12d8) Acid damage. *Success:*  Half damage.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17, +9 to hit with spell attacks): - **At Will:** *Detect Magic*, *Fear*, *Acid Arrow* - **1e/Day Each:** *Speak with Dead*, *Vitriolic Sphere*

## Legendary Actions

**Cloud of Insects**
*Dexterity Saving Throw*: DC 17, one creature the dragon can see within 120 feet. *Failure:*  22 (4d10) Poison damage, and the target has Disadvantage on saving throws to maintain  Concentration until the end of its next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Frightful Presence**
The dragon uses Spellcasting to cast *Fear*. The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon can move up to half its Speed, and it makes one Rend attack.
