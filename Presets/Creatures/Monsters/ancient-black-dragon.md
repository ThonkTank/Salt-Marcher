---
smType: creature
name: Ancient Black Dragon
size: Gargantuan
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '22'
initiative: +6 (16)
hp: '367'
hitDice: 21d20 + 147
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
    saveMod: 9
  - key: con
    score: 25
    saveProf: false
  - key: int
    score: 16
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 9
  - key: cha
    score: 22
    saveProf: false
pb: '+7'
skills:
  - skill: Perception
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
    value: '26'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Acid
cr: '21'
xp: '33000'
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
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Acid Arrow* (level 4 version).
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            spell: Acid Arrow
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +15, reach 15 ft. 17 (2d8 + 8) Slashing damage plus 9 (2d8) Acid damage.'
    attack:
      type: melee
      bonus: 15
      damage:
        - dice: 2d8
          bonus: 8
          type: Slashing
          average: 17
        - dice: 2d8
          bonus: 0
          type: Acid
          average: 9
      reach: 15 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Acid Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 22, each creature in a 90-foot-long, 10-foot-wide Line. *Failure:*  67 (15d8) Acid damage. *Success:*  Half damage.'
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
          other: 67 (15d8) Acid damage.
        damage:
          - dice: 15d8
            bonus: 0
            type: Acid
            average: 67
        legacyEffects: 67 (15d8) Acid damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Cloud of Insects
    entryType: save
    text: '*Dexterity Saving Throw*: DC 21, one creature the dragon can see within 120 feet. *Failure:*  33 (6d10) Poison damage, and the target has Disadvantage on saving throws to maintain  Concentration until the end of its next turn. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: dex
      dc: 21
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
          - dice: 6d10
            bonus: 0
            type: Poison
            average: 33
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
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21, +13 to hit with spell attacks): - **At Will:** *Detect Magic*, *Fear*, *Acid Arrow* - **1e/Day Each:** *Create Undead*, *Speak with Dead*, *Vitriolic Sphere*'
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
            - Fear
            - Acid Arrow
        - frequency: 1/day
          spells:
            - Create Undead
            - Speak with Dead
            - Vitriolic Sphere
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Frightful Presence
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Fear*. The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
---

# Ancient Black Dragon
*Gargantuan, Dragon, Chaotic Evil*

**AC** 22
**HP** 367 (21d20 + 147)
**Initiative** +6 (16)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 26
**Languages** Common, Draconic
CR 21, PB +7, XP 33000

## Traits

**Amphibious**
The dragon can breathe air and water.

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Acid Arrow* (level 4 version).

**Rend**
*Melee Attack Roll:* +15, reach 15 ft. 17 (2d8 + 8) Slashing damage plus 9 (2d8) Acid damage.

**Acid Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 22, each creature in a 90-foot-long, 10-foot-wide Line. *Failure:*  67 (15d8) Acid damage. *Success:*  Half damage.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 21, +13 to hit with spell attacks): - **At Will:** *Detect Magic*, *Fear*, *Acid Arrow* - **1e/Day Each:** *Create Undead*, *Speak with Dead*, *Vitriolic Sphere*

## Legendary Actions

**Cloud of Insects**
*Dexterity Saving Throw*: DC 21, one creature the dragon can see within 120 feet. *Failure:*  33 (6d10) Poison damage, and the target has Disadvantage on saving throws to maintain  Concentration until the end of its next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Frightful Presence**
The dragon uses Spellcasting to cast *Fear*. The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
