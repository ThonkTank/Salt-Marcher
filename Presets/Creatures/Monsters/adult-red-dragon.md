---
smType: creature
name: Adult Red Dragon
size: Huge
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '19'
initiative: +4 (14)
hp: '256'
hitDice: 19d12 + 133
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
    score: 13
    saveProf: true
    saveMod: 7
  - key: cha
    score: 23
    saveProf: false
pb: '+6'
skills:
  - skill: Perception
    value: '13'
  - skill: Stealth
    value: '6'
sensesList:
  - type: blindsight
    range: '60'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '23'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Fire
cr: '17'
xp: '18000'
entries:
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    entryType: special
    text: If the dragon fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 3
      reset: day
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Scorching Ray*.
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
    text: '*Melee Attack Roll:* +14, reach 10 ft. 13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire damage.'
    attack:
      type: melee
      bonus: 14
      damage:
        - dice: 1d10
          bonus: 8
          type: Slashing
          average: 13
        - dice: 2d4
          bonus: 0
          type: Fire
          average: 5
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 21, each creature in a 60-foot Cone. *Failure:*  59 (17d6) Fire damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 21
      targeting:
        shape: cone
        size: 60 ft.
      onFail:
        effects:
          other: 59 (17d6) Fire damage.
        damage:
          - dice: 17d6
            bonus: 0
            type: Fire
            average: 59
        legacyEffects: 59 (17d6) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
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
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 20, +12 to hit with spell attacks): - **At Will:** *Command*, *Detect Magic*, *Scorching Ray* - **1/Day Each:** *Fireball*'
    spellcasting:
      ability: cha
      saveDC: 20
      attackBonus: 12
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Command
            - Detect Magic
            - Scorching Ray
        - frequency: 1/day
          spells:
            - Fireball
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Commanding Presence
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Command* (level 2 version). The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
  - category: legendary
    name: Fiery Rays
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Scorching Ray*. The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
---

# Adult Red Dragon
*Huge, Dragon, Chaotic Evil*

**AC** 19
**HP** 256 (19d12 + 133)
**Initiative** +4 (14)
**Speed** 40 ft., climb 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 23
**Languages** Common, Draconic
CR 17, PB +6, XP 18000

## Traits

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Scorching Ray*.

**Rend**
*Melee Attack Roll:* +14, reach 10 ft. 13 (1d10 + 8) Slashing damage plus 5 (2d4) Fire damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 21, each creature in a 60-foot Cone. *Failure:*  59 (17d6) Fire damage. *Success:*  Half damage.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 20, +12 to hit with spell attacks): - **At Will:** *Command*, *Detect Magic*, *Scorching Ray* - **1/Day Each:** *Fireball*

## Legendary Actions

**Commanding Presence**
The dragon uses Spellcasting to cast *Command* (level 2 version). The dragon can't take this action again until the start of its next turn.

**Fiery Rays**
The dragon uses Spellcasting to cast *Scorching Ray*. The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
