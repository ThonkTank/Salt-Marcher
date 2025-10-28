---
smType: creature
name: Brass Dragon Wyrmling
size: Medium
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: '15'
initiative: +2 (12)
hp: '22'
hitDice: 4d8 + 4
speeds:
  walk:
    distance: 30 ft.
  burrow:
    distance: 15 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 2
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 11
    saveProf: true
    saveMod: 2
  - key: cha
    score: 13
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '2'
sensesList:
  - type: blindsight
    range: '10'
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Draconic
damageImmunitiesList:
  - value: Fire
cr: '1'
xp: '200'
entries:
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 7 (1d10 + 2) Slashing damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d10
          bonus: 2
          type: Slashing
          average: 7
      reach: 5 ft.
  - category: action
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 11, each creature in a 20-foot-long, 5-foot-wide Line. *Failure:*  14 (4d6) Fire damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 11
      targeting:
        shape: line
        size: 20 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 14 (4d6) Fire damage.
        damage:
          - dice: 4d6
            bonus: 0
            type: Fire
            average: 14
        legacyEffects: 14 (4d6) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Sleep Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 11, each creature in a 15-foot Cone. *Failure:*  The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. *Second Failure* The target has the Unconscious condition for 1 minute. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.'
    save:
      ability: con
      dc: 11
      targeting:
        shape: cone
        size: 15 ft.
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
---

# Brass Dragon Wyrmling
*Medium, Dragon, Chaotic Good*

**AC** 15
**HP** 22 (4d8 + 4)
**Initiative** +2 (12)
**Speed** 30 ft., fly 60 ft., burrow 15 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 14
**Languages** Draconic
CR 1, PB +2, XP 200

## Actions

**Rend**
*Melee Attack Roll:* +4, reach 5 ft. 7 (1d10 + 2) Slashing damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 11, each creature in a 20-foot-long, 5-foot-wide Line. *Failure:*  14 (4d6) Fire damage. *Success:*  Half damage.

**Sleep Breath**
*Constitution Saving Throw*: DC 11, each creature in a 15-foot Cone. *Failure:*  The target has the Incapacitated condition until the end of its next turn, at which point it repeats the save. *Second Failure* The target has the Unconscious condition for 1 minute. This effect ends for the target if it takes damage or a creature within 5 feet of it takes an action to wake it.
