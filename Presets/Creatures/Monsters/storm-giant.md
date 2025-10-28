---
smType: creature
name: Storm Giant
size: Huge
type: Giant
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: '16'
initiative: +7 (17)
hp: '230'
hitDice: 20d12 + 100
speeds:
  walk:
    distance: 50 ft.
  fly:
    distance: 25 ft.
    hover: true
  swim:
    distance: 50 ft.
abilities:
  - key: str
    score: 29
    saveProf: true
    saveMod: 14
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 20
    saveProf: true
    saveMod: 10
  - key: int
    score: 16
    saveProf: false
  - key: wis
    score: 20
    saveProf: true
    saveMod: 10
  - key: cha
    score: 18
    saveProf: true
    saveMod: 9
pb: '+5'
skills:
  - skill: Arcana
    value: '8'
  - skill: Athletics
    value: '14'
  - skill: History
    value: '8'
  - skill: Perception
    value: '10'
sensesList:
  - type: darkvision
    range: '120'
  - type: truesight
    range: '30'
passivesList:
  - skill: Perception
    value: '20'
languagesList:
  - value: Common
  - value: Giant
damageResistancesList:
  - value: Cold
damageImmunitiesList:
  - value: Lightning
  - value: Thunder
cr: '13'
xp: '10000'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The giant can breathe air and water.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: special
    text: The giant makes two attacks, using Storm Sword or Thunderbolt in any combination.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Storm Sword
    entryType: attack
    text: '*Melee Attack Roll:* +14, reach 10 ft. 23 (4d6 + 9) Slashing damage plus 13 (3d8) Lightning damage.'
    attack:
      type: melee
      bonus: 14
      damage:
        - dice: 4d6
          bonus: 9
          type: Slashing
          average: 23
        - dice: 3d8
          bonus: 0
          type: Lightning
          average: 13
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Thunderbolt
    entryType: attack
    text: '*Ranged Attack Roll:* +14, range 500 ft. 22 (2d12 + 9) Lightning damage, and the target has the Blinded and Deafened conditions until the start of the giant''s next turn.'
    attack:
      type: ranged
      bonus: 14
      damage:
        - dice: 2d12
          bonus: 9
          type: Lightning
          average: 22
      range: 500 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Lightning Storm (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 18, each creature in a 10-foot-radius, 40-foot-high Cylinder [Area of Effect]|XPHB|Cylinder originating from a point the giant can see within 500 feet. *Failure:*  55 (10d10) Lightning damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 18
      targeting:
        shape: cylinder
        size: 10 ft.
        height: 40 ft.
        origin: self
      onFail:
        effects:
          other: 55 (10d10) Lightning damage.
        damage:
          - dice: 10d10
            bonus: 0
            type: Lightning
            average: 55
        legacyEffects: 55 (10d10) Lightning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: action
    name: Spellcasting
    entryType: spellcasting
    text: 'The giant casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 18): - **At Will:** *Detect Magic*, *Light* - **1/Day Each:** *Control Weather*'
    spellcasting:
      ability: wis
      saveDC: 18
      excludeComponents:
        - M
      spellLists:
        - frequency: at-will
          spells:
            - Detect Magic
            - Light
        - frequency: 1/day
          spells:
            - Control Weather
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Storm Giant
*Huge, Giant, Chaotic Good*

**AC** 16
**HP** 230 (20d12 + 100)
**Initiative** +7 (17)
**Speed** 50 ft., swim 50 ft., fly 25 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft., truesight 30 ft.; Passive Perception 20
**Languages** Common, Giant
CR 13, PB +5, XP 10000

## Traits

**Amphibious**
The giant can breathe air and water.

## Actions

**Multiattack**
The giant makes two attacks, using Storm Sword or Thunderbolt in any combination.

**Storm Sword**
*Melee Attack Roll:* +14, reach 10 ft. 23 (4d6 + 9) Slashing damage plus 13 (3d8) Lightning damage.

**Thunderbolt**
*Ranged Attack Roll:* +14, range 500 ft. 22 (2d12 + 9) Lightning damage, and the target has the Blinded and Deafened conditions until the start of the giant's next turn.

**Lightning Storm (Recharge 5-6)**
*Dexterity Saving Throw*: DC 18, each creature in a 10-foot-radius, 40-foot-high Cylinder [Area of Effect]|XPHB|Cylinder originating from a point the giant can see within 500 feet. *Failure:*  55 (10d10) Lightning damage. *Success:*  Half damage.

**Spellcasting**
The giant casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 18): - **At Will:** *Detect Magic*, *Light* - **1/Day Each:** *Control Weather*
