---
smType: creature
name: Chimera
size: Large
type: Monstrosity
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '14'
initiative: +0 (10)
hp: '114'
hitDice: 12d10 + 48
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
    score: 11
    saveProf: false
  - key: con
    score: 19
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 14
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '8'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '18'
languagesList:
  - value: Understands Draconic but can't speak
cr: '6'
xp: '2300'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The chimera makes one Ram attack, one Bite attack, and one Claw attack. It can replace the Claw attack with a use of Fire Breath if available.
    multiattack:
      attacks:
        - name: Ram
          count: 1
        - name: Bite
          count: 1
        - name: Claw
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 11 (2d6 + 4) Piercing damage, or 18 (4d6 + 4) Piercing damage if the chimera had Advantage on the attack roll.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d6
          bonus: 4
          type: Piercing
          average: 11
        - dice: 4d6
          bonus: 4
          type: Piercing
          average: 18
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 7 (1d6 + 4) Slashing damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 1d6
          bonus: 4
          type: Slashing
          average: 7
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Ram
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 10 (1d12 + 4) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 1d12
          bonus: 4
          type: Bludgeoning
          average: 10
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Medium or smaller
      additionalEffects: If the target is a Medium or smaller creature, it has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Fire Breath (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 15, each creature in a 15-foot Cone. *Failure:*  31 (7d8) Fire damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: dex
      dc: 15
      targeting:
        shape: cone
        size: 15 ft.
      onFail:
        effects:
          other: 31 (7d8) Fire damage.
        damage:
          - dice: 7d8
            bonus: 0
            type: Fire
            average: 31
        legacyEffects: 31 (7d8) Fire damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Chimera
*Large, Monstrosity, Chaotic Evil*

**AC** 14
**HP** 114 (12d10 + 48)
**Initiative** +0 (10)
**Speed** 30 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 18
**Languages** Understands Draconic but can't speak
CR 6, PB +3, XP 2300

## Actions

**Multiattack**
The chimera makes one Ram attack, one Bite attack, and one Claw attack. It can replace the Claw attack with a use of Fire Breath if available.

**Bite**
*Melee Attack Roll:* +7, reach 5 ft. 11 (2d6 + 4) Piercing damage, or 18 (4d6 + 4) Piercing damage if the chimera had Advantage on the attack roll.

**Claw**
*Melee Attack Roll:* +7, reach 5 ft. 7 (1d6 + 4) Slashing damage.

**Ram**
*Melee Attack Roll:* +7, reach 5 ft. 10 (1d12 + 4) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Prone condition.

**Fire Breath (Recharge 5-6)**
*Dexterity Saving Throw*: DC 15, each creature in a 15-foot Cone. *Failure:*  31 (7d8) Fire damage. *Success:*  Half damage.
