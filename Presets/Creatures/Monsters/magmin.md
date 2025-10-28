---
smType: creature
name: Magmin
size: Small
type: Elemental
alignmentLawChaos: Chaotic
alignmentGoodEvil: Neutral
ac: '14'
initiative: +2 (12)
hp: '13'
hitDice: 3d6 + 3
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 7
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 8
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Primordial (Ignan)
damageImmunitiesList:
  - value: Fire
cr: 1/2
xp: '100'
entries:
  - category: trait
    name: Death Burst
    entryType: save
    text: 'The magmin explodes when it dies. *Dexterity Saving Throw*: DC 11, each creature in a 10-foot Emanation originating from the magmin. *Failure:*  7 (2d6) Fire damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 11
      targeting:
        shape: emanation
        size: 10 ft.
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
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Touch
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 7 (2d4 + 2) Fire damage. If the target is a creature or a flammable object that isn''t being worn or carried, it starts burning.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 2d4
          bonus: 2
          type: Fire
          average: 7
      reach: 5 ft.
      onHit:
        other: If the target is a creature or a flammable object that isn't being worn or carried, it starts burning.
      additionalEffects: If the target is a creature or a flammable object that isn't being worn or carried, it starts burning.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Ignited Illumination
    entryType: special
    text: The magmin sets itself ablaze or extinguishes its flames. While ablaze, the magmin sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Magmin
*Small, Elemental, Chaotic Neutral*

**AC** 14
**HP** 13 (3d6 + 3)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Primordial (Ignan)
CR 1/2, PB +2, XP 100

## Traits

**Death Burst**
The magmin explodes when it dies. *Dexterity Saving Throw*: DC 11, each creature in a 10-foot Emanation originating from the magmin. *Failure:*  7 (2d6) Fire damage. *Success:*  Half damage.

## Actions

**Touch**
*Melee Attack Roll:* +4, reach 5 ft. 7 (2d4 + 2) Fire damage. If the target is a creature or a flammable object that isn't being worn or carried, it starts burning.

## Bonus Actions

**Ignited Illumination**
The magmin sets itself ablaze or extinguishes its flames. While ablaze, the magmin sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.
