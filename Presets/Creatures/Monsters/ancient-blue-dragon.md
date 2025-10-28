---
smType: creature
name: Ancient Blue Dragon
size: Gargantuan
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '22'
initiative: +4 (14)
hp: '481'
hitDice: 26d20 + 208
speeds:
  walk:
    distance: 40 ft.
  burrow:
    distance: 40 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 29
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 7
  - key: con
    score: 27
    saveProf: false
  - key: int
    score: 18
    saveProf: false
  - key: wis
    score: 17
    saveProf: true
    saveMod: 10
  - key: cha
    score: 25
    saveProf: false
pb: '+7'
skills:
  - skill: Perception
    value: '17'
  - skill: Stealth
    value: '7'
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
  - value: Lightning
cr: '23'
xp: '50000'
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
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Shatter* (level 3 version).
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: spellcasting
            spell: Shatter
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +16, reach 15 ft. 18 (2d8 + 9) Slashing damage plus 11 (2d10) Lightning damage.'
    attack:
      type: melee
      bonus: 16
      damage:
        - dice: 2d8
          bonus: 9
          type: Slashing
          average: 18
        - dice: 2d10
          bonus: 0
          type: Lightning
          average: 11
      reach: 15 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Lightning Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 23, each creature in a 120-foot-long, 10-foot-wide Line. *Failure:*  88 (16d10) Lightning damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 23
      targeting:
        shape: line
        size: 120 ft.
        width: 10 ft.
      onFail:
        effects:
          other: 88 (16d10) Lightning damage.
        damage:
          - dice: 16d10
            bonus: 0
            type: Lightning
            average: 88
        legacyEffects: 88 (16d10) Lightning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Tail Swipe
    entryType: multiattack
    text: The dragon makes one Rend attack.
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
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 22): - **At Will:** *Detect Magic*, *Invisibility*, *Mage Hand*, *Shatter* - **1e/Day Each:** *Scrying*, *Sending*'
    spellcasting:
      ability: cha
      saveDC: 22
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Invisibility
            - Mage Hand
            - Shatter
        - frequency: 1/day
          spells:
            - Scrying
            - Sending
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Cloaked Flight
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Invisibility* on itself, and it can fly up to half its Fly Speed. The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
  - category: legendary
    name: Sonic Boom
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Shatter* (level 3 version). The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
---

# Ancient Blue Dragon
*Gargantuan, Dragon, Lawful Evil*

**AC** 22
**HP** 481 (26d20 + 208)
**Initiative** +4 (14)
**Speed** 40 ft., fly 80 ft., burrow 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 27
**Languages** Common, Draconic
CR 23, PB +7, XP 50000

## Traits

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Shatter* (level 3 version).

**Rend**
*Melee Attack Roll:* +16, reach 15 ft. 18 (2d8 + 9) Slashing damage plus 11 (2d10) Lightning damage.

**Lightning Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 23, each creature in a 120-foot-long, 10-foot-wide Line. *Failure:*  88 (16d10) Lightning damage. *Success:*  Half damage.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 22): - **At Will:** *Detect Magic*, *Invisibility*, *Mage Hand*, *Shatter* - **1e/Day Each:** *Scrying*, *Sending*

## Legendary Actions

**Cloaked Flight**
The dragon uses Spellcasting to cast *Invisibility* on itself, and it can fly up to half its Fly Speed. The dragon can't take this action again until the start of its next turn.

**Sonic Boom**
The dragon uses Spellcasting to cast *Shatter* (level 3 version). The dragon can't take this action again until the start of its next turn.

**Tail Swipe**
The dragon makes one Rend attack.
