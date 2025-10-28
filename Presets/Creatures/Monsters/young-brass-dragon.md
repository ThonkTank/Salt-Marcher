---
smType: creature
name: Young Brass Dragon
size: Large
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: '17'
initiative: +3 (13)
hp: '110'
hitDice: 13d10 + 39
speeds:
  walk:
    distance: 40 ft.
  burrow:
    distance: 20 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 3
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 11
    saveProf: true
    saveMod: 3
  - key: cha
    score: 15
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '6'
  - skill: Persuasion
    value: '5'
  - skill: Stealth
    value: '3'
sensesList:
  - type: blindsight
    range: '30'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '16'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Fire
cr: '6'
xp: '2300'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks. It can replace two attacks with a use of Sleep Breath.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions: []
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
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 14, each creature in a 40-foot-long, 5-foot-wide Line. *Failure:*  38 (11d6) Fire damage. *Success:*  Half damage.'
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
          other: 38 (11d6) Fire damage.
        damage:
          - dice: 11d6
            bonus: 0
            type: Fire
            average: 38
        legacyEffects: 38 (11d6) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Sleep Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 14, each creature in a 30-foot Cone. *Failure:*  The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. *Second Failure* The target has the Unconscious condition for 1 minute. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.'
    save:
      ability: con
      dc: 14
      targeting:
        shape: cone
        size: 30 ft.
      onFail:
        effects:
          conditions:
            - condition: Incapacitated
              duration:
                type: until
                trigger: the end of its next turn
              saveToEnd:
                timing: custom
            - condition: Unconscious
              duration:
                type: until
                trigger: the end of its next turn
              saveToEnd:
                timing: custom
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Young Brass Dragon
*Large, Dragon, Chaotic Good*

**AC** 17
**HP** 110 (13d10 + 39)
**Initiative** +3 (13)
**Speed** 40 ft., fly 80 ft., burrow 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft., darkvision 120 ft.; Passive Perception 16
**Languages** Common, Draconic
CR 6, PB +3, XP 2300

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace two attacks with a use of Sleep Breath.

**Rend**
*Melee Attack Roll:* +7, reach 10 ft. 15 (2d10 + 4) Slashing damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 14, each creature in a 40-foot-long, 5-foot-wide Line. *Failure:*  38 (11d6) Fire damage. *Success:*  Half damage.

**Sleep Breath**
*Constitution Saving Throw*: DC 14, each creature in a 30-foot Cone. *Failure:*  The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. *Second Failure* The target has the Unconscious condition for 1 minute. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.
