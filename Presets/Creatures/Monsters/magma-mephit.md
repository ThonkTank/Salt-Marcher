---
smType: creature
name: Magma Mephit
size: Small
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '11'
initiative: +1 (11)
hp: '18'
hitDice: 4d6 + 4
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 30 ft.
abilities:
  - key: str
    score: 8
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 7
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Primordial (Ignan
  - value: Terran)
damageVulnerabilitiesList:
  - value: Cold
damageImmunitiesList:
  - value: Fire
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Poisoned
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Death Burst
    entryType: save
    text: 'The mephit explodes when it dies. *Dexterity Saving Throw*: DC 11, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  7 (2d6) Fire damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 11
      targeting:
        shape: emanation
        size: 5 ft.
        origin: self
      onFail:
        effects:
          other: 7 (2d6) Fire damage.
        damage:
          - dice: 2d6
            bonus: 0
            type: Fire
            average: 7
        legacyEffects: 7 (2d6) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Slashing damage plus 3 (1d6) Fire damage.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 1d4
          bonus: 1
          type: Slashing
          average: 3
        - dice: 1d6
          bonus: 0
          type: Fire
          average: 3
      reach: 5 ft.
  - category: action
    name: Fire Breath
    entryType: save
    text: '*Dexterity Saving Throw*: DC 11, each creature in a 15-foot Cone. *Failure:*  7 (2d6) Fire damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 11
      targeting:
        shape: cone
        size: 15 ft.
      onFail:
        effects:
          other: 7 (2d6) Fire damage.
        damage:
          - dice: 2d6
            bonus: 0
            type: Fire
            average: 7
        legacyEffects: 7 (2d6) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
---

# Magma Mephit
*Small, Elemental, Neutral Evil*

**AC** 11
**HP** 18 (4d6 + 4)
**Initiative** +1 (11)
**Speed** 30 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Primordial (Ignan, Terran)
CR 1/2, PB +2, XP 100

## Traits

**Death Burst**
The mephit explodes when it dies. *Dexterity Saving Throw*: DC 11, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  7 (2d6) Fire damage. *Success:*  Half damage.

## Actions

**Claw**
*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Slashing damage plus 3 (1d6) Fire damage.

**Fire Breath (Recharge 6)**
*Dexterity Saving Throw*: DC 11, each creature in a 15-foot Cone. *Failure:*  7 (2d6) Fire damage. *Success:*  Half damage.
