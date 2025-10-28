---
smType: creature
name: Bronze Dragon Wyrmling
size: Medium
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '15'
initiative: +2 (12)
hp: '39'
hitDice: 6d8 + 12
speeds:
  walk:
    distance: 30 ft.
  fly:
    distance: 60 ft.
  swim:
    distance: 30 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 2
  - key: con
    score: 15
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
  - value: Lightning
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
    trigger.activation: passive
    trigger.targeting:
      type: single
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
    text: '*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d10
          bonus: 3
          type: Slashing
          average: 8
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Lightning Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 12, each creature in a 40-foot-long, 5-foot-wide Line. *Failure:*  16 (3d10) Lightning damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 12
      targeting:
        shape: line
        size: 40 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 16 (3d10) Lightning damage.
        damage:
          - dice: 3d10
            bonus: 0
            type: Lightning
            average: 16
        legacyEffects: 16 (3d10) Lightning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Repulsion Breath
    entryType: save
    text: '*Strength Saving Throw*: DC 12, each creature in a 30-foot Cone. *Failure:*  The target is pushed up to 30 feet straight away from the dragon and has the Prone condition.'
    save:
      ability: str
      dc: 12
      targeting:
        shape: cone
        size: 30 ft.
      onFail:
        effects:
          conditions:
            - condition: Prone
          movement:
            type: push
            distance: 30 feet
            direction: straight away from the dragon
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Bronze Dragon Wyrmling
*Medium, Dragon, Lawful Good*

**AC** 15
**HP** 39 (6d8 + 12)
**Initiative** +2 (12)
**Speed** 30 ft., swim 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 14
**Languages** Draconic
CR 2, PB +2, XP 450

## Traits

**Amphibious**
The dragon can breathe air and water.

## Actions

**Multiattack**
The dragon makes two Rend attacks.

**Rend**
*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Slashing damage.

**Lightning Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 12, each creature in a 40-foot-long, 5-foot-wide Line. *Failure:*  16 (3d10) Lightning damage. *Success:*  Half damage.

**Repulsion Breath**
*Strength Saving Throw*: DC 12, each creature in a 30-foot Cone. *Failure:*  The target is pushed up to 30 feet straight away from the dragon and has the Prone condition.
