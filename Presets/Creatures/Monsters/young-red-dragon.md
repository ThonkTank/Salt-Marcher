---
smType: creature
name: Young Red Dragon
size: Large
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '18'
initiative: +4 (14)
hp: '178'
hitDice: 17d10 + 85
speeds:
  walk:
    distance: 40 ft.
  climb:
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
  - value: Fire
cr: '10'
xp: '5900'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks.
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
    text: '*Melee Attack Roll:* +10, reach 10 ft. 13 (2d6 + 6) Slashing damage plus 3 (1d6) Fire damage.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 2d6
          bonus: 6
          type: Slashing
          average: 13
        - dice: 1d6
          bonus: 0
          type: Fire
          average: 3
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 17, each creature in a 30-foot Cone. *Failure:*  56 (16d6) Fire damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 17
      targeting:
        shape: cone
        size: 30 ft.
      onFail:
        effects:
          other: 56 (16d6) Fire damage.
        damage:
          - dice: 16d6
            bonus: 0
            type: Fire
            average: 56
        legacyEffects: 56 (16d6) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Young Red Dragon
*Large, Dragon, Chaotic Evil*

**AC** 18
**HP** 178 (17d10 + 85)
**Initiative** +4 (14)
**Speed** 40 ft., climb 40 ft., fly 80 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 30 ft., darkvision 120 ft.; Passive Perception 18
**Languages** Common, Draconic
CR 10, PB +4, XP 5900

## Actions

**Multiattack**
The dragon makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +10, reach 10 ft. 13 (2d6 + 6) Slashing damage plus 3 (1d6) Fire damage.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 17, each creature in a 30-foot Cone. *Failure:*  56 (16d6) Fire damage. *Success:*  Half damage.
