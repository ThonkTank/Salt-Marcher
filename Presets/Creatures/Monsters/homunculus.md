---
smType: creature
name: Homunculus
size: Small
type: Construct
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '13'
initiative: +2 (12)
hp: '4'
hitDice: 1d4 + 2
speeds:
  walk:
    distance: 20 ft.
  fly:
    distance: 40 ft.
abilities:
  - key: str
    score: 4
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 10
    saveProf: true
    saveMod: 2
  - key: cha
    score: 7
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Understands Common plus one other language but can't speak
damageImmunitiesList:
  - value: Poison; Charmed
conditionImmunitiesList:
  - value: Poisoned
cr: '0'
xp: '0'
entries:
  - category: trait
    name: Telepathic Bond
    entryType: special
    text: While the homunculus is on the same plane of existence as its master, the two of them can communicate telepathically with each other.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 1 Piercing damage, and the target is subjected to the following effect. *Constitution Saving Throw*: DC 12. *Failure:*  The target has the Poisoned condition until the end of the homunculus''s next turn. *Failure by 5 or More:* The target has the Poisoned condition for 1 minute. While Poisoned, the target has the Unconscious condition, which ends early if the target takes any damage.'
    attack:
      type: melee
      bonus: 4
      damage: []
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Homunculus
*Small, Construct, Neutral Neutral*

**AC** 13
**HP** 4 (1d4 + 2)
**Initiative** +2 (12)
**Speed** 20 ft., fly 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Understands Common plus one other language but can't speak
CR 0, PB +2, XP 0

## Traits

**Telepathic Bond**
While the homunculus is on the same plane of existence as its master, the two of them can communicate telepathically with each other.

## Actions

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 1 Piercing damage, and the target is subjected to the following effect. *Constitution Saving Throw*: DC 12. *Failure:*  The target has the Poisoned condition until the end of the homunculus's next turn. *Failure by 5 or More:* The target has the Poisoned condition for 1 minute. While Poisoned, the target has the Unconscious condition, which ends early if the target takes any damage.
