---
smType: creature
name: Young Gold Dragon
size: Large
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '18'
initiative: +6 (16)
hp: '178'
hitDice: 17d10 + 85
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
    saveMod: 6
  - key: con
    score: 21
    saveProf: false
  - key: int
    score: 16
    saveProf: false
  - key: wis
    score: 13
    saveProf: true
    saveMod: 5
  - key: cha
    score: 20
    saveProf: false
pb: '+4'
skills:
  - skill: Insight
    value: '5'
  - skill: Perception
    value: '9'
  - skill: Persuasion
    value: '9'
  - skill: Stealth
    value: '6'
sensesList:
  - type: blindsight
    range: '30'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '19'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Fire
cr: '10'
xp: '5900'
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
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Weakening Breath.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Weakening Breath
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 10 ft. 17 (2d10 + 6) Slashing damage.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 2d10
          bonus: 6
          type: Slashing
          average: 17
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 17, each creature in a 30-foot Cone. *Failure:*  55 (10d10) Fire damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 17
      targeting:
        shape: cone
        size: 30 ft.
      onFail:
        effects:
          other: 55 (10d10) Fire damage.
        damage:
          - dice: 10d10
            bonus: 0
            type: Fire
            average: 55
        legacyEffects: 55 (10d10) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Weakening Breath
    entryType: save
    text: '*Strength Saving Throw*: DC 17, each creature that isn''t currently affected by this breath in a 30-foot Cone. *Failure:*  The target has Disadvantage on Strength-based D20 Test and subtracts 3 (1d6) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.'
    save:
      ability: str
      dc: 17
      targeting:
        shape: cone
        size: 30 ft.
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
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Young Gold Dragon
*Large, Dragon, Lawful Good*

**AC** 18
**HP** 178 (17d10 + 85)
**Initiative** +6 (16)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft., darkvision 120 ft.; Passive Perception 19
**Languages** Common, Draconic
CR 10, PB +4, XP 5900

## Traits

**Amphibious**
The dragon can breathe air and water.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Weakening Breath.

**Rend**
*Melee Attack Roll:* +10, reach 10 ft. 17 (2d10 + 6) Slashing damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 17, each creature in a 30-foot Cone. *Failure:*  55 (10d10) Fire damage. *Success:*  Half damage.

**Weakening Breath**
*Strength Saving Throw*: DC 17, each creature that isn't currently affected by this breath in a 30-foot Cone. *Failure:*  The target has Disadvantage on Strength-based D20 Test and subtracts 3 (1d6) from its damage rolls. It repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.
