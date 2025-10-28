---
smType: creature
name: Chuul
size: Large
type: Aberration
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '16'
initiative: +0 (10)
hp: '76'
hitDice: 9d10 + 27
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Understands Deep Speech but can't speak
damageImmunitiesList:
  - value: Poison; Poisoned
cr: '4'
xp: '1100'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The chuul can breathe air and water.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Sense Magic
    entryType: special
    text: The chuul senses magic within 120 feet of itself. This trait otherwise works like the *Detect Magic* spell but isn't itself magical.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The chuul makes two Pincer attacks and uses Paralyzing Tentacles.
    multiattack:
      attacks:
        - name: Pincer
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Pincer
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 9 (1d10 + 4) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two pincers.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d10
          bonus: 4
          type: Bludgeoning
          average: 9
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 14
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two pincers.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Paralyzing Tentacles
    entryType: save
    text: '*Constitution Saving Throw*: DC 13, one creature Grappled by the chuul. *Failure:*  The target has the Poisoned condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically. While Poisoned, the target has the Paralyzed condition.'
    save:
      ability: con
      dc: 13
      targeting:
        type: single
        restrictions:
          other:
            - grappled by source
      onFail:
        effects:
          conditions:
            - condition: Poisoned
              saveToEnd:
                timing: end-of-turn
              restrictions:
                while: While Poisoned, the target has the Paralyzed condition
            - condition: Paralyzed
              saveToEnd:
                timing: end-of-turn
              restrictions:
                while: While Poisoned, the target has the Paralyzed condition
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Chuul
*Large, Aberration, Chaotic Evil*

**AC** 16
**HP** 76 (9d10 + 27)
**Initiative** +0 (10)
**Speed** 30 ft., swim 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Understands Deep Speech but can't speak
CR 4, PB +2, XP 1100

## Traits

**Amphibious**
The chuul can breathe air and water.

**Sense Magic**
The chuul senses magic within 120 feet of itself. This trait otherwise works like the *Detect Magic* spell but isn't itself magical.

## Actions

**Multiattack**
The chuul makes two Pincer attacks and uses Paralyzing Tentacles.

**Pincer**
*Melee Attack Roll:* +6, reach 10 ft. 9 (1d10 + 4) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two pincers.

**Paralyzing Tentacles**
*Constitution Saving Throw*: DC 13, one creature Grappled by the chuul. *Failure:*  The target has the Poisoned condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically. While Poisoned, the target has the Paralyzed condition.
