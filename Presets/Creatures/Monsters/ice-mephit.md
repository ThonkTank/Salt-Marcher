---
smType: creature
name: Ice Mephit
size: Small
type: Elemental
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '11'
initiative: +1 (11)
hp: '21'
hitDice: 6d6
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 30 ft.
abilities:
  - key: str
    score: 7
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 9
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 12
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '2'
  - skill: Stealth
    value: '3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Primordial (Aquan
  - value: Auran)
damageVulnerabilitiesList:
  - value: Fire
damageImmunitiesList:
  - value: Cold
  - value: Poison; Exhaustion
conditionImmunitiesList:
  - value: Poisoned
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Death Burst
    entryType: save
    text: 'The mephit explodes when it dies. *Constitution Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Cold damage. *Success:*  Half damage.'
    save:
      ability: con
      dc: 10
      targeting:
        shape: emanation
        size: 5 ft.
        origin: self
      onFail:
        effects:
          other: 5 (2d4) Cold damage.
        damage:
          - dice: 2d4
            bonus: 0
            type: Cold
            average: 5
        legacyEffects: 5 (2d4) Cold damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Slashing damage plus 2 (1d4) Cold damage.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 1d4
          bonus: 1
          type: Slashing
          average: 3
        - dice: 1d4
          bonus: 0
          type: Cold
          average: 2
      reach: 5 ft.
  - category: action
    name: Frost Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  7 (3d4) Cold damage. *Success:*  Half damage.'
    save:
      ability: con
      dc: 10
      targeting:
        shape: cone
        size: 15 ft.
      onFail:
        effects:
          other: 7 (3d4) Cold damage.
        damage:
          - dice: 3d4
            bonus: 0
            type: Cold
            average: 7
        legacyEffects: 7 (3d4) Cold damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
spellcastingEntries:
  - category: action
    name: Fog Cloud (1/Day)
    entryType: spellcasting
    text: The mephit casts *Fog Cloud*, requiring no spell components and using Charisma as the spellcasting ability. - **At Will:** - **1/Day Each:** *Fog Cloud*
    limitedUse:
      count: 1
      reset: day
    spellcasting:
      ability: cha
      spellLists:
        - frequency: at-will
          spells:
            - '- 1/Day Each: Fog Cloud'
        - frequency: 1/day
          spells:
            - Fog Cloud
---

# Ice Mephit
*Small, Elemental, Neutral Evil*

**AC** 11
**HP** 21 (6d6)
**Initiative** +1 (11)
**Speed** 30 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 12
**Languages** Primordial (Aquan, Auran)
CR 1/2, PB +2, XP 100

## Traits

**Death Burst**
The mephit explodes when it dies. *Constitution Saving Throw*: DC 10, each creature in a 5-foot Emanation originating from the mephit. *Failure:*  5 (2d4) Cold damage. *Success:*  Half damage.

## Actions

**Claw**
*Melee Attack Roll:* +3, reach 5 ft. 3 (1d4 + 1) Slashing damage plus 2 (1d4) Cold damage.

**Frost Breath (Recharge 6)**
*Constitution Saving Throw*: DC 10, each creature in a 15-foot Cone. *Failure:*  7 (3d4) Cold damage. *Success:*  Half damage.

**Fog Cloud (1/Day)**
The mephit casts *Fog Cloud*, requiring no spell components and using Charisma as the spellcasting ability. - **At Will:** - **1/Day Each:** *Fog Cloud*
