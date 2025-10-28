---
smType: creature
name: Dragon Turtle
size: Gargantuan
type: Dragon
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '20'
initiative: +6 (16)
hp: '356'
hitDice: 23d20 + 115
speeds:
  walk:
    distance: 20 ft.
  swim:
    distance: 50 ft.
abilities:
  - key: str
    score: 25
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 20
    saveProf: true
    saveMod: 11
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 12
    saveProf: true
    saveMod: 7
  - key: cha
    score: 12
    saveProf: false
pb: '+6'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Draconic
  - value: Primordial (Aquan)
damageResistancesList:
  - value: Fire
cr: '17'
xp: '18000'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The dragon can breathe air and water.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Bite attacks. It can replace one attack with a Tail attack.
    multiattack:
      attacks:
        - name: Bite
          count: 3
      substitutions:
        - replace: attack
          with:
            type: attack
            name: a Tail attack
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +13, reach 15 ft. 23 (3d10 + 7) Piercing damage plus 7 (2d6) Fire damage. Being underwater doesn''t grant Resistance to this Fire damage.'
    attack:
      type: melee
      bonus: 13
      damage:
        - dice: 3d10
          bonus: 7
          type: Piercing
          average: 23
        - dice: 2d6
          bonus: 0
          type: Fire
          average: 7
      reach: 15 ft.
      onHit:
        other: Being underwater doesn't grant Resistance to this Fire damage.
      additionalEffects: Being underwater doesn't grant Resistance to this Fire damage.
  - category: action
    name: Tail
    entryType: attack
    text: '*Melee Attack Roll:* +13, reach 15 ft. 18 (2d10 + 7) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 13
      damage:
        - dice: 2d10
          bonus: 7
          type: Bludgeoning
          average: 18
      reach: 15 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Huge or smaller
      additionalEffects: If the target is a Huge or smaller creature, it has the Prone condition.
  - category: action
    name: Steam Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 19, each creature in a 60-foot Cone. *Failure:*  56 (16d6) Fire damage. *Success:*  Half damage. *Failure or Success*:  Being underwater doesn''t grant Resistance to this Fire damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 19
      targeting:
        shape: cone
        size: 60 ft.
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
---

# Dragon Turtle
*Gargantuan, Dragon, Neutral Neutral*

**AC** 20
**HP** 356 (23d20 + 115)
**Initiative** +6 (16)
**Speed** 20 ft., swim 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 11
**Languages** Draconic, Primordial (Aquan)
CR 17, PB +6, XP 18000

## Traits

**Amphibious**
The dragon can breathe air and water.

## Actions

**Multiattack**
The dragon makes three Bite attacks. It can replace one attack with a Tail attack.

**Bite**
*Melee Attack Roll:* +13, reach 15 ft. 23 (3d10 + 7) Piercing damage plus 7 (2d6) Fire damage. Being underwater doesn't grant Resistance to this Fire damage.

**Tail**
*Melee Attack Roll:* +13, reach 15 ft. 18 (2d10 + 7) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition.

**Steam Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 19, each creature in a 60-foot Cone. *Failure:*  56 (16d6) Fire damage. *Success:*  Half damage. *Failure or Success*:  Being underwater doesn't grant Resistance to this Fire damage.
