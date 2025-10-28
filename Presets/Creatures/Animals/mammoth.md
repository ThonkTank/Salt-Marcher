---
smType: creature
name: Mammoth
size: Huge
type: Beast
alignmentOverride: Unaligned
ac: '13'
initiative: +2 (12)
hp: '126'
hitDice: 11d12 + 55
speeds:
  walk:
    distance: 50 ft.
abilities:
  - key: str
    score: 24
    saveProf: true
    saveMod: 10
  - key: dex
    score: 9
    saveProf: false
  - key: con
    score: 21
    saveProf: true
    saveMod: 8
  - key: int
    score: 3
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+3'
passivesList:
  - skill: Perception
    value: '10'
cr: '6'
xp: '2300'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The mammoth makes two Gore attacks.
    multiattack:
      attacks:
        - name: Gore
          count: 2
        - name: Gore
          count: 2
      substitutions: []
  - category: action
    name: Gore
    entryType: attack
    text: '*Melee Attack Roll:* +10, reach 10 ft. 18 (2d10 + 7) Piercing damage. If the target is a Huge or smaller creature and the mammoth moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.'
    attack:
      type: melee
      bonus: 10
      damage:
        - dice: 2d10
          bonus: 7
          type: Piercing
          average: 18
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Huge or smaller
        other: If the target is a Huge or smaller creature and the mammoth moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.
      additionalEffects: If the target is a Huge or smaller creature and the mammoth moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.
  - category: bonus
    name: Trample
    entryType: save
    text: '*Dexterity Saving Throw*: DC 18, one creature within 5 feet that has the Prone condition. *Failure:*  29 (4d10 + 7) Bludgeoning damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 18
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          conditions:
            - Prone
      area: one creature within 5 feet that has the Prone condition
      onFail:
        damage:
          - dice: 4d10
            bonus: 7
            type: Bludgeoning
            average: 29
        effects:
          other: 29 (4d10 + 7) Bludgeoning damage.
        legacyEffects: 29 (4d10 + 7) Bludgeoning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
---

# Mammoth
*Huge, Beast, Unaligned*

**AC** 13
**HP** 126 (11d12 + 55)
**Initiative** +2 (12)
**Speed** 50 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

CR 6, PB +3, XP 2300

## Actions

**Multiattack**
The mammoth makes two Gore attacks.

**Gore**
*Melee Attack Roll:* +10, reach 10 ft. 18 (2d10 + 7) Piercing damage. If the target is a Huge or smaller creature and the mammoth moved 20+ feet straight toward it immediately before the hit, the target has the Prone condition.

## Bonus Actions

**Trample**
*Dexterity Saving Throw*: DC 18, one creature within 5 feet that has the Prone condition. *Failure:*  29 (4d10 + 7) Bludgeoning damage. *Success:*  Half damage.
