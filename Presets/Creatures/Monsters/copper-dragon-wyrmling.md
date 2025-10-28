---
smType: creature
name: Copper Dragon Wyrmling
size: Medium
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Good
ac: '16'
initiative: +3 (13)
hp: '22'
hitDice: 4d8 + 4
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
  fly:
    distance: 60 ft.
abilities:
  - key: str
    score: 15
    saveProf: false
  - key: dex
    score: 12
    saveProf: true
    saveMod: 3
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 14
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
    value: '3'
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
  - value: Acid
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
    name: Acid Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 11, each creature in a 20-foot-long, 5-foot-wide Line. *Failure:*  18 (4d8) Acid damage. *Success:*  Half damage.'
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
          other: 18 (4d8) Acid damage.
        damage:
          - dice: 4d8
            bonus: 0
            type: Acid
            average: 18
        legacyEffects: 18 (4d8) Acid damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Slowing Breath
    entryType: save
    text: '*Constitution Saving Throw*: DC 11, each creature in a 15-foot Cone. *Failure:*  The target can''t take Reactions; its Speed is halved; and it can take either an action or a Bonus Action on its turn, not both. This effect lasts until the end of its next turn.'
    save:
      ability: con
      dc: 11
      targeting:
        shape: cone
        size: 15 ft.
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
---

# Copper Dragon Wyrmling
*Medium, Dragon, Chaotic Good*

**AC** 16
**HP** 22 (4d8 + 4)
**Initiative** +3 (13)
**Speed** 30 ft., climb 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 14
**Languages** Draconic
CR 1, PB +2, XP 200

## Actions

**Rend**
*Melee Attack Roll:* +4, reach 5 ft. 7 (1d10 + 2) Slashing damage.

**Acid Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 11, each creature in a 20-foot-long, 5-foot-wide Line. *Failure:*  18 (4d8) Acid damage. *Success:*  Half damage.

**Slowing Breath**
*Constitution Saving Throw*: DC 11, each creature in a 15-foot Cone. *Failure:*  The target can't take Reactions; its Speed is halved; and it can take either an action or a Bonus Action on its turn, not both. This effect lasts until the end of its next turn.
