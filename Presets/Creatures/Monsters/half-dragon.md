---
smType: creature
name: Half-Dragon
size: Medium
type: Dragon
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '18'
initiative: +5 (15)
hp: '105'
hitDice: 14d8 + 42
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 14
    saveProf: true
    saveMod: 5
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 5
  - key: cha
    score: 14
    saveProf: false
pb: '+3'
skills:
  - skill: Athletics
    value: '7'
  - skill: Perception
    value: '5'
  - skill: Stealth
    value: '5'
sensesList:
  - type: blindsight
    range: '10'
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Common
  - value: Draconic
damageResistancesList:
  - value: Damage type chosen for the Draconic Origin trait below
cr: '5'
xp: '1800'
entries:
  - category: trait
    name: Draconic Origin
    entryType: special
    text: 'The half-dragon is related to a type of dragon associated with one of the following damage types (DM''s choice): Acid, Cold, Fire, Lightning, or Poison. This choice affects other aspects of the stat block.'
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The half-dragon makes two Claw attacks.
    multiattack:
      attacks:
        - name: Claw
          count: 2
      substitutions: []
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 10 ft. 6 (1d4 + 4) Slashing damage plus 7 (2d6) damage of the type chosen for the Draconic Origin trait.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 1d4
          bonus: 4
          type: Slashing
          average: 6
      reach: 10 ft.
  - category: action
    name: Dragon's Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 14, each creature in a 30-foot Cone. *Failure:*  28 (8d6) damage of the type chosen for the Draconic Origin trait. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 14
      targeting:
        shape: cone
        size: 30 ft.
      onFail:
        effects:
          other: 28 (8d6) damage of the type chosen for the Draconic Origin trait.
        legacyEffects: 28 (8d6) damage of the type chosen for the Draconic Origin trait.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: bonus
    name: Leap
    entryType: special
    text: The half-dragon jumps up to 30 feet by spending 10 feet of movement.
---

# Half-Dragon
*Medium, Dragon, Neutral Neutral*

**AC** 18
**HP** 105 (14d8 + 42)
**Initiative** +5 (15)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 10 ft., darkvision 60 ft.; Passive Perception 15
**Languages** Common, Draconic
CR 5, PB +3, XP 1800

## Traits

**Draconic Origin**
The half-dragon is related to a type of dragon associated with one of the following damage types (DM's choice): Acid, Cold, Fire, Lightning, or Poison. This choice affects other aspects of the stat block.

## Actions

**Multiattack**
The half-dragon makes two Claw attacks.

**Claw**
*Melee Attack Roll:* +7, reach 10 ft. 6 (1d4 + 4) Slashing damage plus 7 (2d6) damage of the type chosen for the Draconic Origin trait.

**Dragon's Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 14, each creature in a 30-foot Cone. *Failure:*  28 (8d6) damage of the type chosen for the Draconic Origin trait. *Success:*  Half damage.

## Bonus Actions

**Leap**
The half-dragon jumps up to 30 feet by spending 10 feet of movement.
