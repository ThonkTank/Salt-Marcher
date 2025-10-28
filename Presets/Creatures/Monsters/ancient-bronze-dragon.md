---
smType: creature
name: Ancient Bronze Dragon
size: Gargantuan
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '22'
initiative: +4 (14)
hp: '444'
hitDice: 24d20 + 192
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
  swim:
    distance: 40 ft.
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
  - skill: Insight
    value: '10'
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
cr: '22'
xp: '41000'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
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
    text: The dragon makes three Rend attacks. It can replace one attack with a use of (A) Repulsion Breath or (B) Spellcasting to cast *Guiding Bolt* (level 2 version).
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
    text: '*Melee Attack Roll:* +16, reach 15 ft. 18 (2d8 + 9) Slashing damage plus 9 (2d8) Lightning damage.'
    attack:
      type: melee
      bonus: 16
      damage:
        - dice: 2d8
          bonus: 9
          type: Slashing
          average: 18
        - dice: 2d8
          bonus: 0
          type: Lightning
          average: 9
      reach: 15 ft.
  - category: action
    name: Lightning Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 23, each creature in a 120-foot-long, 10-foot-wide Line. *Failure:*  82 (15d10) Lightning damage. *Success:*  Half damage.'
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
          other: 82 (15d10) Lightning damage.
        damage:
          - dice: 15d10
            bonus: 0
            type: Lightning
            average: 82
        legacyEffects: 82 (15d10) Lightning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Repulsion Breath
    entryType: save
    text: '*Strength Saving Throw*: DC 23, each creature in a 30-foot Cone. *Failure:*  The target is pushed up to 60 feet straight away from the dragon and has the Prone condition.'
    save:
      ability: str
      dc: 23
      targeting:
        shape: cone
        size: 30 ft.
      onFail:
        effects:
          conditions:
            - condition: Prone
          movement:
            type: push
            distance: 60 feet
            direction: straight away from the dragon
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
    name: Thunderclap
    entryType: save
    text: '*Constitution Saving Throw*: DC 22, each creature in a 20-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  13 (3d8) Thunder damage, and the target has the Deafened condition until the end of its next turn.'
    save:
      ability: con
      dc: 22
      targeting:
        shape: sphere
        size: 20 ft.
      onFail:
        effects:
          conditions:
            - condition: Deafened
              duration:
                type: until
                trigger: the end of its next turn
        damage:
          - dice: 3d8
            bonus: 0
            type: Thunder
            average: 13
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 22, +14 to hit with spell attacks): - **At Will:** *Detect Magic*, *Guiding Bolt*, *Shapechange*, *Speak with Animals*, *Thaumaturgy* - **1e/Day Each:** *Detect Thoughts*, *Control Water*, *Scrying*, *Water Breathing*'
    spellcasting:
      ability: cha
      saveDC: 22
      attackBonus: 14
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Guiding Bolt
            - Shapechange
            - Speak with Animals
            - Thaumaturgy
        - frequency: 1/day
          spells:
            - Detect Thoughts
            - Control Water
            - Scrying
            - Water Breathing
  - category: legendary
    name: Guiding Light
    entryType: spellcasting
    text: The dragon uses Spellcasting to cast *Guiding Bolt* (level 2 version).
    spellcasting:
      ability: int
      spellLists: []
---

# Ancient Bronze Dragon
*Gargantuan, Dragon, Lawful Good*

**AC** 22
**HP** 444 (24d20 + 192)
**Initiative** +4 (14)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 27
**Languages** Common, Draconic
CR 22, PB +7, XP 41000

## Traits

**Amphibious**
The dragon can breathe air and water.

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of (A) Repulsion Breath or (B) Spellcasting to cast *Guiding Bolt* (level 2 version).

**Rend**
*Melee Attack Roll:* +16, reach 15 ft. 18 (2d8 + 9) Slashing damage plus 9 (2d8) Lightning damage.

**Lightning Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 23, each creature in a 120-foot-long, 10-foot-wide Line. *Failure:*  82 (15d10) Lightning damage. *Success:*  Half damage.

**Repulsion Breath**
*Strength Saving Throw*: DC 23, each creature in a 30-foot Cone. *Failure:*  The target is pushed up to 60 feet straight away from the dragon and has the Prone condition.

**Spellcasting**
The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 22, +14 to hit with spell attacks): - **At Will:** *Detect Magic*, *Guiding Bolt*, *Shapechange*, *Speak with Animals*, *Thaumaturgy* - **1e/Day Each:** *Detect Thoughts*, *Control Water*, *Scrying*, *Water Breathing*

## Legendary Actions

**Guiding Light**
The dragon uses Spellcasting to cast *Guiding Bolt* (level 2 version).

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.

**Thunderclap**
*Constitution Saving Throw*: DC 22, each creature in a 20-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  13 (3d8) Thunder damage, and the target has the Deafened condition until the end of its next turn.
