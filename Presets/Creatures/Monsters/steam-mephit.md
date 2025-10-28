---
smType: creature
name: Steam Mephit
size: Small
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '10'
initiative: +0 (10)
hp: '17'
hitDice: 5d6
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 30 ft.
abilities:
  - key: str
    score: 5
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 12
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Primordial (Aquan
  - value: Ignan)
damageImmunitiesList:
  - value: Fire
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Poisoned
cr: 1/4
xp: '50'
entries:
  - category: trait
    name: Blurred Form
    entryType: special
    text: Attack rolls against the mephit are made with Disadvantage unless the mephit has the Incapacitated condition.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Death Burst
    entryType: save
    text: 'The mephit explodes when it dies. *Dexterity Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Fire damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 10
      targeting:
        shape: emanation
        size: 5 ft.
        origin: self
      onFail:
        effects:
          other: 5 (2d4) Fire damage.
        damage:
          - dice: 2d4
            bonus: 0
            type: Fire
            average: 5
        legacyEffects: 5 (2d4) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Slashing damage plus 2 (1d4) Fire damage.'
    attack:
      type: melee
      bonus: 2
      damage:
        - dice: 1d4
          bonus: 0
          type: Slashing
          average: 2
        - dice: 1d4
          bonus: 0
          type: Fire
          average: 2
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Steam Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  5 (2d4) Fire damage, and the target''s Speed decreases by 10 feet until the end of the mephit''s next turn. *Success:*  Half damage only. *Failure or Success*:  Being underwater doesn''t grant Resistance to this Fire damage.'
    save:
      ability: con
      dc: 10
      targeting:
        shape: cone
        size: 15 ft.
      onFail:
        effects:
          other: 5 (2d4) Fire damage, and the target's Speed decreases by 10 feet until the end of the mephit's next turn.
        damage:
          - dice: 2d4
            bonus: 0
            type: Fire
            average: 5
        legacyEffects: 5 (2d4) Fire damage, and the target's Speed decreases by 10 feet until the end of the mephit's next turn.
      onSuccess:
        damage: half
        legacyText: Half damage only.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Steam Mephit
*Small, Elemental, Neutral Evil*

**AC** 10
**HP** 17 (5d6)
**Initiative** +0 (10)
**Speed** 30 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Primordial (Aquan, Ignan)
CR 1/4, PB +2, XP 50

## Traits

**Blurred Form**
Attack rolls against the mephit are made with Disadvantage unless the mephit has the Incapacitated condition.

**Death Burst**
The mephit explodes when it dies. *Dexterity Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Fire damage. *Success:*  Half damage.

## Actions

**Claw**
*Melee Attack Roll:* +2, reach 5 ft. 2 (1d4) Slashing damage plus 2 (1d4) Fire damage.

**Steam Breath (Recharge 6)**
*Constitution Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  5 (2d4) Fire damage, and the target's Speed decreases by 10 feet until the end of the mephit's next turn. *Success:*  Half damage only. *Failure or Success*:  Being underwater doesn't grant Resistance to this Fire damage.
