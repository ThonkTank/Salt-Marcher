---
smType: creature
name: Dretch
size: Small
type: Fiend
typeTags:
  - value: Demon
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '11'
initiative: +0 (10)
hp: '18'
hitDice: 4d6 + 4
speeds:
  walk:
    distance: 20 ft.
abilities:
  - key: str
    score: 12
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 5
    saveProf: false
  - key: wis
    score: 8
    saveProf: false
  - key: cha
    score: 3
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '9'
languagesList:
  - value: Abyssal
  - value: telepathy 60 ft. (works only with creatures that understand Abyssal)
damageResistancesList:
  - value: Cold
  - value: Fire
  - value: Lightning
damageImmunitiesList:
  - value: Poison; Poisoned
cr: 1/4
xp: '50'
entries:
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 4 (1d6 + 1) Slashing damage.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 1d6
          bonus: 1
          type: Slashing
          average: 4
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Fetid Cloud (1/Day)
    entryType: save
    text: '*Constitution Saving Throw*: DC 11, each creature in a 10-foot Emanation originating from the dretch. *Failure:*  The target has the Poisoned condition until the end of its next turn. While Poisoned, the creature can take either an action or a Bonus Action on its turn, not both, and it can''t take Reactions.'
    limitedUse:
      count: 1
      reset: day
    save:
      ability: con
      dc: 11
      targeting:
        shape: emanation
        size: 10 ft.
        origin: self
      onFail:
        effects:
          conditions:
            - condition: Poisoned
              duration:
                type: until
                trigger: the end of its next turn
          mechanical:
            - type: other
              target: Reactions
              description: can't take Reactions
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Dretch
*Small, Fiend, Chaotic Evil*

**AC** 11
**HP** 18 (4d6 + 4)
**Initiative** +0 (10)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 9
**Languages** Abyssal, telepathy 60 ft. (works only with creatures that understand Abyssal)
CR 1/4, PB +2, XP 50

## Actions

**Rend**
*Melee Attack Roll:* +3, reach 5 ft. 4 (1d6 + 1) Slashing damage.

**Fetid Cloud (1/Day)**
*Constitution Saving Throw*: DC 11, each creature in a 10-foot Emanation originating from the dretch. *Failure:*  The target has the Poisoned condition until the end of its next turn. While Poisoned, the creature can take either an action or a Bonus Action on its turn, not both, and it can't take Reactions.
