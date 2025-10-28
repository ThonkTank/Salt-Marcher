---
smType: creature
name: Ancient Red Dragon
size: Gargantuan
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '22'
initiative: +4 (14)
hp: '507'
hitDice: 26d20 + 234
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 40 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 30
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 7
  - key: con
    score: 29
    saveProf: false
  - key: int
    score: 18
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 9
  - key: cha
    score: 27
    saveProf: false
pb: '+7'
skills:
  - skill: Perception
    value: '16'
  - skill: Stealth
    value: '7'
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
  - value: Fire
cr: '24'
xp: '62000'
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
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Scorching Ray* (level 3 version).
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
    text: '*Melee Attack Roll:* +17, reach 15 ft. 19 (2d8 + 10) Slashing damage plus 10 (3d6) Fire damage.'
    attack:
      type: melee
      bonus: 17
      damage:
        - dice: 2d8
          bonus: 10
          type: Slashing
          average: 19
        - dice: 3d6
          bonus: 0
          type: Fire
          average: 10
      reach: 15 ft.
  - category: action
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 24, each creature in a 90-foot Cone. *Failure:*  91 (26d6) Fire damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 24
      targeting:
        shape: cone
        size: 90 ft.
      onFail:
        effects:
          other: 91 (26d6) Fire damage.
        damage:
          - dice: 26d6
            bonus: 0
            type: Fire
            average: 91
        legacyEffects: 91 (26d6) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
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
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23, +15 to hit with spell attacks): - **At Will:** *Command*, *Detect Magic*, *Scorching Ray* - **1e/Day Each:** *Fireball*, *Scrying*'
    spellcasting:
      ability: cha
      saveDC: 23
      attackBonus: 15
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
            - Scrying
  - category: legendary
    name: Commanding Presence
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Command* (level 2 version). The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
  - category: legendary
    name: Fiery Rays
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Scorching Ray* (level 3 version). The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
---

# Ancient Red Dragon
*Gargantuan, Dragon, Chaotic Evil*

**AC** 22
**HP** 507 (26d20 + 234)
**Initiative** +4 (14)
**Speed** 40 ft., climb 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 26
**Languages** Common, Draconic
CR 24, PB +7, XP 62000

## Traits

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Scorching Ray* (level 3 version).

**Rend**
*Melee Attack Roll:* +17, reach 15 ft. 19 (2d8 + 10) Slashing damage plus 10 (3d6) Fire damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 24, each creature in a 90-foot Cone. *Failure:*  91 (26d6) Fire damage. *Success:*  Half damage.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23, +15 to hit with spell attacks): - **At Will:** *Command*, *Detect Magic*, *Scorching Ray* - **1e/Day Each:** *Fireball*, *Scrying*

## Legendary Actions

**Commanding Presence**
The dragon uses Spellcasting to cast *Command* (level 2 version). The dragon can't take this action again until the start of its next turn.

**Fiery Rays**
The dragon uses Spellcasting to cast *Scorching Ray* (level 3 version). The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.
