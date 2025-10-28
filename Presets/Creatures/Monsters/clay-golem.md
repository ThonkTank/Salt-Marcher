---
smType: creature
name: Clay Golem
size: Large
type: Construct
alignmentOverride: Unaligned
ac: '14'
initiative: +3 (13)
hp: '123'
hitDice: 13d10 + 52
speeds:
  walk:
    distance: 20 ft.
abilities:
  - key: str
    score: 20
    saveProf: false
  - key: dex
    score: 9
    saveProf: false
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 1
    saveProf: false
pb: '+4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '9'
languagesList:
  - value: Common plus one other language
damageResistancesList:
  - value: Bludgeoning
  - value: Piercing
  - value: Slashing
damageImmunitiesList:
  - value: Acid
  - value: Poison
  - value: Psychic; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Frightened
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
cr: '9'
xp: '5000'
entries:
  - category: trait
    name: Acid Absorption
    entryType: special
    text: Whenever the golem is subjected to Acid damage, it takes no damage and instead regains a number of Hit Points equal to the Acid damage dealt.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Berserk
    entryType: special
    text: Whenever the golem starts its turn Bloodied, roll 1d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object. Once the golem goes berserk, it continues to be berserk until it is destroyed or it is no longer Bloodied.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Immutable Form
    entryType: special
    text: The golem can't shape-shift.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The golem has Advantage on saving throws against spells and other magical effects.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The golem makes two Slam attacks, or it makes three Slam attacks if it used Hasten this turn.
    multiattack:
      attacks:
        - name: Slam
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Slam
    entryType: attack
    text: '*Melee Attack Roll:* +9, reach 5 ft. 10 (1d10 + 5) Bludgeoning damage plus 6 (1d12) Acid damage, and the target''s Hit Point maximum decreases by an amount equal to the Acid damage taken.'
    attack:
      type: melee
      bonus: 9
      damage:
        - dice: 1d10
          bonus: 5
          type: Bludgeoning
          average: 10
        - dice: 1d12
          bonus: 0
          type: Acid
          average: 6
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Hasten (Recharge 5-6)
    entryType: special
    text: The golem takes the Dash and Disengage actions.
    recharge: 5-6
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Clay Golem
*Large, Construct, Unaligned*

**AC** 14
**HP** 123 (13d10 + 52)
**Initiative** +3 (13)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 9
**Languages** Common plus one other language
CR 9, PB +4, XP 5000

## Traits

**Acid Absorption**
Whenever the golem is subjected to Acid damage, it takes no damage and instead regains a number of Hit Points equal to the Acid damage dealt.

**Berserk**
Whenever the golem starts its turn Bloodied, roll 1d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object. Once the golem goes berserk, it continues to be berserk until it is destroyed or it is no longer Bloodied.

**Immutable Form**
The golem can't shape-shift.

**Magic Resistance**
The golem has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The golem makes two Slam attacks, or it makes three Slam attacks if it used Hasten this turn.

**Slam**
*Melee Attack Roll:* +9, reach 5 ft. 10 (1d10 + 5) Bludgeoning damage plus 6 (1d12) Acid damage, and the target's Hit Point maximum decreases by an amount equal to the Acid damage taken.

## Bonus Actions

**Hasten (Recharge 5-6)**
The golem takes the Dash and Disengage actions.
