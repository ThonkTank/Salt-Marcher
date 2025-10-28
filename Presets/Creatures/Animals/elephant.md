---
smType: creature
name: Elephant
size: Huge
type: Beast
alignmentOverride: Unaligned
ac: '12'
initiative: '-1 (9)'
hp: '76'
hitDice: 8d12 + 24
speeds:
  walk:
    distance: 40 ft.
abilities:
  - key: str
    score: 22
    saveProf: false
  - key: dex
    score: 9
    saveProf: false
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '10'
cr: '4'
xp: '1100'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The elephant makes two Gore attacks.
    multiattack:
      attacks:
        - name: Gore
          count: 2
        - name: Gore
          count: 2
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Gore
    entryType: attack
    text: '*Melee Attack Roll:* +8, reach 5 ft. 15 (2d8 + 6) Piercing damage. If the target is a Huge or smaller creature and the elephant moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.'
    attack:
      type: melee
      bonus: 8
      damage:
        - dice: 2d8
          bonus: 6
          type: Piercing
          average: 15
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Huge or smaller
        other: If the target is a Huge or smaller creature and the elephant moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.
      additionalEffects: If the target is a Huge or smaller creature and the elephant moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Trample
    entryType: save
    text: '*Dexterity Saving Throw*: DC 16, one creature within 5 feet that has the Prone condition. *Failure:*  17 (2d10 + 6) Bludgeoning damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 16
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          conditions:
            - Prone
      area: one creature within 5 feet that has the Prone condition
      onFail:
        damage:
          - dice: 2d10
            bonus: 6
            type: Bludgeoning
            average: 17
        effects:
          other: 17 (2d10 + 6) Bludgeoning damage.
        legacyEffects: 17 (2d10 + 6) Bludgeoning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: bonus
    trigger.targeting:
      type: single
---

# Elephant
*Huge, Beast, Unaligned*

**AC** 12
**HP** 76 (8d12 + 24)
**Initiative** -1 (9)
**Speed** 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 4, PB +2, XP 1100

## Actions

**Multiattack**
The elephant makes two Gore attacks.

**Gore**
*Melee Attack Roll:* +8, reach 5 ft. 15 (2d8 + 6) Piercing damage. If the target is a Huge or smaller creature and the elephant moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.

## Bonus Actions

**Trample**
*Dexterity Saving Throw*: DC 16, one creature within 5 feet that has the Prone condition. *Failure:*  17 (2d10 + 6) Bludgeoning damage. *Success:*  Half damage.
