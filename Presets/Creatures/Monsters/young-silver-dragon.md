---
smType: creature
name: Young Silver Dragon
size: Large
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '18'
initiative: +4 (14)
hp: '168'
hitDice: 16d10 + 80
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
abilities:
  - key: str
    score: 23
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 4
  - key: con
    score: 21
    saveProf: false
  - key: int
    score: 14
    saveProf: false
  - key: wis
    score: 11
    saveProf: true
    saveMod: 4
  - key: cha
    score: 19
    saveProf: false
pb: '+4'
skills:
  - skill: History
    value: '6'
  - skill: Perception
    value: '8'
  - skill: Stealth
    value: '4'
sensesList:
  - type: blindsight
    range: '30'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '18'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Cold
cr: '9'
xp: '5000'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Paralyzing Breath.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Paralyzing Breath
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 10 ft. 15 (2d8 + 6) Slashing damage.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 2d8
          bonus: 6
          type: Slashing
          average: 15
      reach: 10 ft.
  - category: action
    name: Cold Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 17, each creature in a 30-foot Cone. *Failure:*  49 (11d8) Cold damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 17
      targeting:
        shape: cone
        size: 30 ft.
      onFail:
        effects:
          other: 49 (11d8) Cold damage.
        damage:
          - dice: 11d8
            bonus: 0
            type: Cold
            average: 49
        legacyEffects: 49 (11d8) Cold damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Paralyzing Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 17, each creature in a 30-foot Cone. *First Failure* The target has the Incapacitated condition until the end of its next turn, when it repeats the save. *Second Failure* The target has the Paralyzed condition, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.'
    save:
      ability: con
      dc: 17
---

# Young Silver Dragon
*Large, Dragon, Lawful Good*

**AC** 18
**HP** 168 (16d10 + 80)
**Initiative** +4 (14)
**Speed** 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft., darkvision 120 ft.; Passive Perception 18
**Languages** Common, Draconic
CR 9, PB +4, XP 5000

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Paralyzing Breath.

**Rend**
*Melee Attack Roll:* +10, reach 10 ft. 15 (2d8 + 6) Slashing damage.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 17, each creature in a 30-foot Cone. *Failure:*  49 (11d8) Cold damage. *Success:*  Half damage.

**Paralyzing Breath**
*Constitution Saving Throw*: DC 17, each creature in a 30-foot Cone. *First Failure* The target has the Incapacitated condition until the end of its next turn, when it repeats the save. *Second Failure* The target has the Paralyzed condition, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.
