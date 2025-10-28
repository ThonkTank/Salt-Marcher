---
smType: creature
name: Gold Dragon Wyrmling
size: Medium
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '17'
initiative: +4 (14)
hp: '60'
hitDice: 8d8 + 24
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 60 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 14
    saveProf: true
    saveMod: 4
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 14
    saveProf: false
  - key: wis
    score: 11
    saveProf: true
    saveMod: 2
  - key: cha
    score: 16
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '4'
sensesList:
  - type: blindsight
    range: '10'
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Draconic
damageImmunitiesList:
  - value: Fire
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes two Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 9 (1d10 + 4) Slashing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d10
          bonus: 4
          type: Slashing
          average: 9
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 13, each creature in a 15-foot Cone. *Failure:*  22 (4d10) Fire damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 13
      targeting:
        shape: cone
        size: 15 ft.
      onFail:
        effects:
          other: 22 (4d10) Fire damage.
        damage:
          - dice: 4d10
            bonus: 0
            type: Fire
            average: 22
        legacyEffects: 22 (4d10) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Weakening Breath
    entryType: save
    text: '*Strength Saving Throw*: DC 13, each creature that isn''t currently affected by this breath in a 15-foot Cone. *Failure:*  The target has Disadvantage on Strength-based D20 Test and subtracts 2 (1d4) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.'
    save:
      ability: str
      dc: 13
      targeting:
        shape: cone
        size: 15 ft.
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
              modifier: -2
              target: damage rolls
              description: subtracts 2 (1d4) from its damage rolls.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Gold Dragon Wyrmling
*Medium, Dragon, Lawful Good*

**AC** 17
**HP** 60 (8d8 + 24)
**Initiative** +4 (14)
**Speed** 30 ft., swim 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 14
**Languages** Draconic
CR 3, PB +2, XP 700

## Traits

**Amphibious**
The dragon can breathe air and water.

## Actions

**Multiattack**
The dragon makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +6, reach 5 ft. 9 (1d10 + 4) Slashing damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 13, each creature in a 15-foot Cone. *Failure:*  22 (4d10) Fire damage. *Success:*  Half damage.

**Weakening Breath**
*Strength Saving Throw*: DC 13, each creature that isn't currently affected by this breath in a 15-foot Cone. *Failure:*  The target has Disadvantage on Strength-based D20 Test and subtracts 2 (1d4) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.
