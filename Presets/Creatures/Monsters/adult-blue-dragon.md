---
smType: creature
name: Adult Blue Dragon
size: Huge
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '19'
initiative: +4 (14)
hp: '212'
hitDice: 17d12 + 102
speeds:
  walk:
    distance: 40 ft.
  burrow:
    distance: 30 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 25
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 5
  - key: con
    score: 23
    saveProf: false
  - key: int
    score: 16
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 7
  - key: cha
    score: 20
    saveProf: false
pb: '+5'
skills:
  - skill: Perception
    value: '12'
  - skill: Stealth
    value: '5'
sensesList:
  - type: blindsight
    range: '60'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '22'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Lightning
cr: '16'
xp: '15000'
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
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Shatter*.
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
    text: '*Melee Attack Roll:* +12, reach 10 ft. 16 (2d8 + 7) Slashing damage plus 5 (1d10) Lightning damage.'
    attack:
      type: melee
      bonus: 12
      damage:
        - dice: 2d8
          bonus: 7
          type: Slashing
          average: 16
        - dice: 1d10
          bonus: 0
          type: Lightning
          average: 5
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Lightning Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 19, each creature in a 90-foot-long, 5-foot-wide Line. *Failure:*  60 (11d10) Lightning damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 19
      targeting:
        shape: line
        size: 90 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 60 (11d10) Lightning damage.
        damage:
          - dice: 11d10
            bonus: 0
            type: Lightning
            average: 60
        legacyEffects: 60 (11d10) Lightning damage.
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
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18): - **At Will:** *Detect Magic*, *Invisibility*, *Mage Hand*, *Shatter* - **1e/Day Each:** *Scrying*, *Sending*'
    spellcasting:
      ability: cha
      saveDC: 18
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
    text: The dragon uses Spellcasting to cast *Shatter*. The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: int
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
---

# Adult Blue Dragon
*Huge, Dragon, Lawful Evil*

**AC** 19
**HP** 212 (17d12 + 102)
**Initiative** +4 (14)
**Speed** 40 ft., fly 80 ft., burrow 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 22
**Languages** Common, Draconic
CR 16, PB +5, XP 15000

## Traits

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast *Shatter*.

**Rend**
*Melee Attack Roll:* +12, reach 10 ft. 16 (2d8 + 7) Slashing damage plus 5 (1d10) Lightning damage.

**Lightning Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 19, each creature in a 90-foot-long, 5-foot-wide Line. *Failure:*  60 (11d10) Lightning damage. *Success:*  Half damage.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18): - **At Will:** *Detect Magic*, *Invisibility*, *Mage Hand*, *Shatter* - **1e/Day Each:** *Scrying*, *Sending*

## Legendary Actions

**Cloaked Flight**
The dragon uses Spellcasting to cast *Invisibility* on itself, and it can fly up to half its Fly Speed. The dragon can't take this action again until the start of its next turn.

**Sonic Boom**
The dragon uses Spellcasting to cast *Shatter*. The dragon can't take this action again until the start of its next turn.

**Tail Swipe**
The dragon makes one Rend attack.
