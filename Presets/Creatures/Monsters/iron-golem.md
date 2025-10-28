---
smType: creature
name: Iron Golem
size: Large
type: Construct
alignmentOverride: Unaligned
ac: '20'
initiative: +9 (19)
hp: '252'
hitDice: 24d10 + 120
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 24
    saveProf: false
  - key: dex
    score: 9
    saveProf: false
  - key: con
    score: 20
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 1
    saveProf: false
pb: '+5'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Understands Common plus two other languages but can't speak
damageImmunitiesList:
  - value: Fire
  - value: Poison
  - value: Psychic; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Frightened
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
cr: '16'
xp: '15000'
entries:
  - category: trait
    name: Fire Absorption
    entryType: special
    text: Whenever the golem is subjected to Fire damage, it regains a number of Hit Points equal to the Fire damage dealt.
  - category: trait
    name: Immutable Form
    entryType: special
    text: The golem can't shape-shift.
  - category: trait
    name: Magic Resistance
    entryType: special
    text: The golem has Advantage on saving throws against spells and other magical effects.
  - category: action
    name: Multiattack
    entryType: special
    text: The golem makes two attacks, using Bladed Arm or Fiery Bolt in any combination.
  - category: action
    name: Bladed Arm
    entryType: attack
    text: '*Melee Attack Roll:* +12, reach 10 ft. 20 (3d8 + 7) Slashing damage plus 10 (3d6) Fire damage.'
    attack:
      type: melee
      bonus: 12
      damage:
        - dice: 3d8
          bonus: 7
          type: Slashing
          average: 20
        - dice: 3d6
          bonus: 0
          type: Fire
          average: 10
      reach: 10 ft.
  - category: action
    name: Fiery Bolt
    entryType: attack
    text: '*Ranged Attack Roll:* +10, range 120 ft. 36 (8d8) Fire damage.'
    attack:
      type: ranged
      bonus: 10
      damage:
        - dice: 8d8
          bonus: 0
          type: Fire
          average: 36
      range: 120 ft.
  - category: action
    name: Poison Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  55 (10d10) Poison damage. *Success:*  Half damage.'
    save:
      ability: con
      dc: 18
      targeting:
        shape: cone
        size: 60 ft.
      onFail:
        effects:
          other: 55 (10d10) Poison damage.
        damage:
          - dice: 10d10
            bonus: 0
            type: Poison
            average: 55
        legacyEffects: 55 (10d10) Poison damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
---

# Iron Golem
*Large, Construct, Unaligned*

**AC** 20
**HP** 252 (24d10 + 120)
**Initiative** +9 (19)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 10
**Languages** Understands Common plus two other languages but can't speak
CR 16, PB +5, XP 15000

## Traits

**Fire Absorption**
Whenever the golem is subjected to Fire damage, it regains a number of Hit Points equal to the Fire damage dealt.

**Immutable Form**
The golem can't shape-shift.

**Magic Resistance**
The golem has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The golem makes two attacks, using Bladed Arm or Fiery Bolt in any combination.

**Bladed Arm**
*Melee Attack Roll:* +12, reach 10 ft. 20 (3d8 + 7) Slashing damage plus 10 (3d6) Fire damage.

**Fiery Bolt**
*Ranged Attack Roll:* +10, range 120 ft. 36 (8d8) Fire damage.

**Poison Breath (Recharge 6)**
*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  55 (10d10) Poison damage. *Success:*  Half damage.
