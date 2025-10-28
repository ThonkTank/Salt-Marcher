---
smType: creature
name: Young Copper Dragon
size: Large
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: '17'
initiative: +4 (14)
hp: '119'
hitDice: 14d10 + 42
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 40 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 12
    saveProf: true
    saveMod: 4
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 16
    saveProf: false
  - key: wis
    score: 13
    saveProf: true
    saveMod: 4
  - key: cha
    score: 15
    saveProf: false
pb: '+3'
skills:
  - skill: Deception
    value: '5'
  - skill: Perception
    value: '7'
  - skill: Stealth
    value: '4'
sensesList:
  - type: blindsight
    range: '30'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '17'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Acid
cr: '7'
xp: '2900'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Slowing Breath.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Slowing Breath
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 10 ft. 15 (2d10 + 4) Slashing damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d10
          bonus: 4
          type: Slashing
          average: 15
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Acid Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 14, each creature in a 40-foot-long, 5-foot-wide Line. *Failure:*  40 (9d8) Acid damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 14
      targeting:
        shape: line
        size: 40 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 40 (9d8) Acid damage.
        damage:
          - dice: 9d8
            bonus: 0
            type: Acid
            average: 40
        legacyEffects: 40 (9d8) Acid damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Slowing Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 14, each creature in a 30-foot Cone. *Failure:*  The target can''t take Reactions; its Speed is halved; and it can take either an action or a Bonus Action on its turn, not both. This effect lasts until the end of its next turn.'
    save:
      ability: con
      dc: 14
      targeting:
        shape: cone
        size: 30 ft.
      onFail:
        effects:
          mechanical:
            - type: penalty
              modifier: half
              target: Speed
              description: Speed is halved
            - type: other
              target: Reactions
              description: can't take Reactions
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Young Copper Dragon
*Large, Dragon, Chaotic Good*

**AC** 17
**HP** 119 (14d10 + 42)
**Initiative** +4 (14)
**Speed** 40 ft., climb 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft., darkvision 120 ft.; Passive Perception 17
**Languages** Common, Draconic
CR 7, PB +3, XP 2900

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Slowing Breath.

**Rend**
*Melee Attack Roll:* +7, reach 10 ft. 15 (2d10 + 4) Slashing damage.

**Acid Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 14, each creature in a 40-foot-long, 5-foot-wide Line. *Failure:*  40 (9d8) Acid damage. *Success:*  Half damage.

**Slowing Breath**
*Constitution Saving Throw*: DC 14, each creature in a 30-foot Cone. *Failure:*  The target can't take Reactions; its Speed is halved; and it can take either an action or a Bonus Action on its turn, not both. This effect lasts until the end of its next turn.
