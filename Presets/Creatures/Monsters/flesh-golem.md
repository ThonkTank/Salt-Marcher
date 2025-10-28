---
smType: creature
name: Flesh Golem
size: Medium
type: Construct
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '9'
initiative: '-1 (9)'
hp: '127'
hitDice: 15d8 + 60
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 9
    saveProf: false
  - key: con
    score: 18
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Understands Common plus one other language but can't speak
damageImmunitiesList:
  - value: Lightning
  - value: Poison; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Frightened
  - value: Paralyzed
  - value: Petrified
  - value: Poisoned
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Aversion to Fire
    entryType: special
    text: If the golem takes Fire damage, it has Disadvantage on attack rolls and ability checks until the end of its next turn.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Berserk
    entryType: special
    text: Whenever the golem starts its turn Bloodied, roll 1d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object. Once the golem goes berserk, it remains so until it is destroyed or it is no longer Bloodied. The golem's creator, if within 60 feet of the berserk golem, can try to calm it by taking an action to make a DC 15 Charisma (Persuasion) check; the golem must be able to hear its creator. If this check succeeds, the golem ceases being berserk until the start of its next turn, at which point it resumes rolling for the Berserk trait again if it is still Bloodied.
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
    name: Lightning Absorption
    entryType: special
    text: Whenever the golem is subjected to Lightning damage, it regains a number of Hit Points equal to the Lightning damage dealt.
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
    text: The golem makes two Slam attacks.
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
    text: '*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Bludgeoning damage plus 4 (1d8) Lightning damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d8
          bonus: 4
          type: Bludgeoning
          average: 13
        - dice: 1d8
          bonus: 0
          type: Lightning
          average: 4
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Flesh Golem
*Medium, Construct, Neutral Neutral*

**AC** 9
**HP** 127 (15d8 + 60)
**Initiative** -1 (9)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Understands Common plus one other language but can't speak
CR 5, PB +3, XP 1800

## Traits

**Aversion to Fire**
If the golem takes Fire damage, it has Disadvantage on attack rolls and ability checks until the end of its next turn.

**Berserk**
Whenever the golem starts its turn Bloodied, roll 1d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object. Once the golem goes berserk, it remains so until it is destroyed or it is no longer Bloodied. The golem's creator, if within 60 feet of the berserk golem, can try to calm it by taking an action to make a DC 15 Charisma (Persuasion) check; the golem must be able to hear its creator. If this check succeeds, the golem ceases being berserk until the start of its next turn, at which point it resumes rolling for the Berserk trait again if it is still Bloodied.

**Immutable Form**
The golem can't shape-shift.

**Lightning Absorption**
Whenever the golem is subjected to Lightning damage, it regains a number of Hit Points equal to the Lightning damage dealt.

**Magic Resistance**
The golem has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The golem makes two Slam attacks.

**Slam**
*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Bludgeoning damage plus 4 (1d8) Lightning damage.
