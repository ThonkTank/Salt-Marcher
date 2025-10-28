---
smType: creature
name: Young Bronze Dragon
size: Large
type: Dragon
typeTags:
  - value: Metallic
alignmentLawChaos: Lawful
alignmentGoodEvil: Good
ac: '17'
initiative: +3 (13)
hp: '142'
hitDice: 15d10 + 60
speeds:
  walk:
    distance: 40 ft.
  fly:
    distance: 80 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 21
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 3
  - key: con
    score: 19
    saveProf: false
  - key: int
    score: 14
    saveProf: false
  - key: wis
    score: 13
    saveProf: true
    saveMod: 4
  - key: cha
    score: 17
    saveProf: false
pb: '+3'
skills:
  - skill: Insight
    value: '4'
  - skill: Perception
    value: '7'
  - skill: Stealth
    value: '3'
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
  - value: Lightning
cr: '8'
xp: '3900'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks. It can replace one attack with a use of Repulsion Breath.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Repulsion Breath
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 10 ft. 16 (2d10 + 5) Slashing damage.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 2d10
          bonus: 5
          type: Slashing
          average: 16
      reach: 10 ft.
  - category: action
    name: Lightning Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 15, each creature in a 60-foot-long, 5-foot-wide Line. *Failure:*  49 (9d10) Lightning damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 15
      targeting:
        shape: line
        size: 60 ft.
        width: 5 ft.
      onFail:
        effects:
          other: 49 (9d10) Lightning damage.
        damage:
          - dice: 9d10
            bonus: 0
            type: Lightning
            average: 49
        legacyEffects: 49 (9d10) Lightning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Repulsion Breath
    entryType: save
    text: '*Strength Saving Throw*: DC 15, each creature in a 30-foot Cone. *Failure:*  The target is pushed up to 40 feet straight away from the dragon and has the Prone condition.'
    save:
      ability: str
      dc: 15
      targeting:
        shape: cone
        size: 30 ft.
      onFail:
        effects:
          conditions:
            - condition: Prone
          movement:
            type: push
            distance: 40 feet
            direction: straight away from the dragon
---

# Young Bronze Dragon
*Large, Dragon, Lawful Good*

**AC** 17
**HP** 142 (15d10 + 60)
**Initiative** +3 (13)
**Speed** 40 ft., swim 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft., darkvision 120 ft.; Passive Perception 17
**Languages** Common, Draconic
CR 8, PB +3, XP 3900

## Traits

**Amphibious**
The dragon can breathe air and water.

## Actions

**Multiattack**
The dragon makes three Rend attacks. It can replace one attack with a use of Repulsion Breath.

**Rend**
*Melee Attack Roll:* +8, reach 10 ft. 16 (2d10 + 5) Slashing damage.

**Lightning Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 15, each creature in a 60-foot-long, 5-foot-wide Line. *Failure:*  49 (9d10) Lightning damage. *Success:*  Half damage.

**Repulsion Breath**
*Strength Saving Throw*: DC 15, each creature in a 30-foot Cone. *Failure:*  The target is pushed up to 40 feet straight away from the dragon and has the Prone condition.
