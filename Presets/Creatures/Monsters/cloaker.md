---
smType: creature
name: Cloaker
size: Large
type: Aberration
alignmentLawChaos: Chaotic
alignmentGoodEvil: Neutral
ac: '14'
initiative: +5 (15)
hp: '91'
hitDice: 14d10 + 14
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 40 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 13
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 7
    saveProf: false
pb: '+3'
skills:
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Deep Speech
  - value: Undercommon
conditionImmunitiesList:
  - value: Frightened
cr: '8'
xp: '3900'
entries:
  - category: trait
    name: Light Sensitivity
    entryType: special
    text: While in Bright Light, the cloaker has Disadvantage on attack rolls.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The cloaker makes one Attach attack and two Tail attacks.
    multiattack:
      attacks:
        - name: Attach
          count: 1
        - name: Tail
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Attach
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 13 (3d6 + 3) Piercing damage. If the target is a Large or smaller creature, the cloaker attaches to it. While the cloaker is attached, the target has the Blinded condition, and the cloaker can''t make Attach attacks against other targets. In addition, the cloaker halves the damage it takes (round down), and the target takes the same amount of damage. The cloaker can detach itself by spending 5 feet of movement. The target or a creature within 5 feet of it can take an action to try to detach the cloaker, doing so by succeeding on a DC 14 Strength (Athletics) check.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 3d6
          bonus: 3
          type: Piercing
          average: 13
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Blinded
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, the cloaker attaches to it. While the cloaker is attached, the target has the Blinded condition, and the cloaker can't make Attach attacks against other targets. In addition, the cloaker halves the damage it takes (round down), and the target takes the same amount of damage. The cloaker can detach itself by spending 5 feet of movement. The target or a creature within 5 feet of it can take an action to try to detach the cloaker, doing so by succeeding on a DC 14 Strength (Athletics) check.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Tail
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 8 (1d10 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d10
          bonus: 3
          type: Slashing
          average: 8
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Moan
    entryType: save
    text: '*Wisdom Saving Throw*: DC 13, each creature in a 60-foot Emanation originating from the cloaker. *Failure:*  The target has the Frightened condition until the end of the cloaker''s next turn. *Success:*  The target is immune to this cloaker''s Moan for the next 24 hours.'
    save:
      ability: wis
      dc: 13
      targeting:
        shape: emanation
        size: 60 ft.
        origin: self
      onFail:
        effects:
          conditions:
            - condition: Frightened
              duration:
                type: until
                trigger: the end of the cloaker's next turn
      onSuccess: The target is immune to this cloaker's Moan for the next 24 hours.
    trigger.activation: bonus
    trigger.targeting:
      type: single
spellcastingEntries:
  - category: bonus
    name: Phantasms (Recharge after a Short or Long Rest)
    entryType: spellcasting
    text: The cloaker casts the *Mirror Image* spell, requiring no spell components and using Wisdom as the spellcasting ability. The spell ends early if the cloaker starts or ends its turn in Bright Light.
    spellcasting:
      ability: wis
      spellLists: []
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Cloaker
*Large, Aberration, Chaotic Neutral*

**AC** 14
**HP** 91 (14d10 + 14)
**Initiative** +5 (15)
**Speed** 10 ft., fly 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 12
**Languages** Deep Speech, Undercommon
CR 8, PB +3, XP 3900

## Traits

**Light Sensitivity**
While in Bright Light, the cloaker has Disadvantage on attack rolls.

## Actions

**Multiattack**
The cloaker makes one Attach attack and two Tail attacks.

**Attach**
*Melee Attack Roll:* +6, reach 5 ft. 13 (3d6 + 3) Piercing damage. If the target is a Large or smaller creature, the cloaker attaches to it. While the cloaker is attached, the target has the Blinded condition, and the cloaker can't make Attach attacks against other targets. In addition, the cloaker halves the damage it takes (round down), and the target takes the same amount of damage. The cloaker can detach itself by spending 5 feet of movement. The target or a creature within 5 feet of it can take an action to try to detach the cloaker, doing so by succeeding on a DC 14 Strength (Athletics) check.

**Tail**
*Melee Attack Roll:* +6, reach 10 ft. 8 (1d10 + 3) Slashing damage.

## Bonus Actions

**Moan**
*Wisdom Saving Throw*: DC 13, each creature in a 60-foot Emanation originating from the cloaker. *Failure:*  The target has the Frightened condition until the end of the cloaker's next turn. *Success:*  The target is immune to this cloaker's Moan for the next 24 hours.

**Phantasms (Recharge after a Short or Long Rest)**
The cloaker casts the *Mirror Image* spell, requiring no spell components and using Wisdom as the spellcasting ability. The spell ends early if the cloaker starts or ends its turn in Bright Light.
