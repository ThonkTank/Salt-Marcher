---
smType: creature
name: Silver Dragon Wyrmling
size: Medium
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '17'
initiative: +2 (12)
hp: '45'
hitDice: 6d8 + 18
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 2
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 12
    saveProf: false
  - key: wis
    score: 11
    saveProf: true
    saveMod: 2
  - key: cha
    score: 15
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
  - value: Cold
cr: '2'
xp: '450'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes two Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 9 (1d10 + 4) Piercing damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 1d10
          bonus: 4
          type: Piercing
          average: 9
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Cold Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 13, each creature in a 15-foot Cone. *Failure:*  18 (4d8) Cold damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 13
      targeting:
        shape: cone
        size: 15 ft.
      onFail:
        effects:
          other: 18 (4d8) Cold damage.
        damage:
          - dice: 4d8
            bonus: 0
            type: Cold
            average: 18
        legacyEffects: 18 (4d8) Cold damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Paralyzing Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 13, each creature in a 15-foot Cone. *First Failure* The target has the Incapacitated condition until the end of its next turn, when it repeats the save. *Second Failure* The target has the Paralyzed condition, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.'
    save:
      ability: con
      dc: 13
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Silver Dragon Wyrmling
*Medium, Dragon, Lawful Good*

**AC** 17
**HP** 45 (6d8 + 18)
**Initiative** +2 (12)
**Speed** 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 14
**Languages** Draconic
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The dragon makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +6, reach 5 ft. 9 (1d10 + 4) Piercing damage.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 13, each creature in a 15-foot Cone. *Failure:*  18 (4d8) Cold damage. *Success:*  Half damage.

**Paralyzing Breath**
*Constitution Saving Throw*: DC 13, each creature in a 15-foot Cone. *First Failure* The target has the Incapacitated condition until the end of its next turn, when it repeats the save. *Second Failure* The target has the Paralyzed condition, and it repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.
