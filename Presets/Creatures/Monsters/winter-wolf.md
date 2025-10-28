---
smType: creature
name: Winter Wolf
size: Large
type: Monstrosity
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '13'
initiative: +1 (11)
hp: '75'
hitDice: 10d10 + 20
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 7
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
  - skill: Stealth
    value: '5'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Common
  - value: Giant
damageImmunitiesList:
  - value: Cold
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The wolf has Advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 11 (2d6 + 4) Piercing damage. If the target is a Large or smaller creature, it has the Prone condition.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d6
          bonus: 4
          type: Piercing
          average: 11
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, it has the Prone condition.
  - category: action
    name: Cold Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 12, each creature in a 15-foot Cone. *Failure:*  18 (4d8) Cold damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 12
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
---

# Winter Wolf
*Large, Monstrosity, Neutral Evil*

**AC** 13
**HP** 75 (10d10 + 20)
**Initiative** +1 (11)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common, Giant
CR 3, PB +2, XP 700

## Traits

**Pack Tactics**
The wolf has Advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Bite**
*Melee Attack Roll:* +6, reach 5 ft. 11 (2d6 + 4) Piercing damage. If the target is a Large or smaller creature, it has the Prone condition.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 12, each creature in a 15-foot Cone. *Failure:*  18 (4d8) Cold damage. *Success:*  Half damage.
