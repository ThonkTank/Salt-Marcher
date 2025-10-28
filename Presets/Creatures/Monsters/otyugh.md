---
smType: creature
name: Otyugh
size: Large
type: Aberration
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '14'
initiative: +0 (10)
hp: '104'
hitDice: 11d10 + 44
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 11
    saveProf: false
  - key: con
    score: 19
    saveProf: true
    saveMod: 7
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+3'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Otyugh
  - value: telepathy 120 ft. (doesn't allow the receiving creature to respond telepathically)
cr: '5'
xp: '1800'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The otyugh makes one Bite attack and two Tentacle attacks.
    multiattack:
      attacks:
        - name: Bite
          count: 1
        - name: Tentacle
          count: 2
      substitutions: []
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 5 ft. 12 (2d8 + 3) Piercing damage, and the target has the Poisoned condition. Whenever the Poisoned target finishes a Long Rest, it is subjected to the following effect. *Constitution Saving Throw*: DC 15. *Failure:*  The target''s Hit Point maximum decreases by 5 (1d10) and doesn''t return to normal until the Poisoned condition ends on the target. *Success:*  The Poisoned condition ends.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d8
          bonus: 3
          type: Piercing
          average: 12
      reach: 5 ft.
  - category: action
    name: Tentacle
    entryType: attack
    text: '*Melee Attack Roll:* +6, reach 10 ft. 12 (2d8 + 3) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from one of two tentacles.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d8
          bonus: 3
          type: Piercing
          average: 12
      reach: 10 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 13
            restrictions:
              size: Medium or smaller
      additionalEffects: If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from one of two tentacles.
  - category: action
    name: Tentacle Slam
    entryType: save
    text: '*Constitution Saving Throw*: DC 14, each creature Grappled by the otyugh. *Failure:*  16 (3d8 + 3) Bludgeoning damage, and the target has the Stunned condition until the start of the otyugh''s next turn. *Success:*  Half damage only.'
    save:
      ability: con
      dc: 14
      targeting:
        type: single
        restrictions:
          other:
            - grappled by source
      onFail:
        effects:
          conditions:
            - condition: Stunned
              duration:
                type: until
                trigger: the start of the otyugh's next turn
        damage:
          - dice: 3d8
            bonus: 3
            type: Bludgeoning
            average: 16
      onSuccess:
        damage: half
        legacyText: Half damage only.
---

# Otyugh
*Large, Aberration, Neutral Neutral*

**AC** 14
**HP** 104 (11d10 + 44)
**Initiative** +0 (10)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 11
**Languages** Otyugh, telepathy 120 ft. (doesn't allow the receiving creature to respond telepathically)
CR 5, PB +3, XP 1800

## Actions

**Multiattack**
The otyugh makes one Bite attack and two Tentacle attacks.

**Bite**
*Melee Attack Roll:* +6, reach 5 ft. 12 (2d8 + 3) Piercing damage, and the target has the Poisoned condition. Whenever the Poisoned target finishes a Long Rest, it is subjected to the following effect. *Constitution Saving Throw*: DC 15. *Failure:*  The target's Hit Point maximum decreases by 5 (1d10) and doesn't return to normal until the Poisoned condition ends on the target. *Success:*  The Poisoned condition ends.

**Tentacle**
*Melee Attack Roll:* +6, reach 10 ft. 12 (2d8 + 3) Piercing damage. If the target is a Medium or smaller creature, it has the Grappled condition (escape DC 13) from one of two tentacles.

**Tentacle Slam**
*Constitution Saving Throw*: DC 14, each creature Grappled by the otyugh. *Failure:*  16 (3d8 + 3) Bludgeoning damage, and the target has the Stunned condition until the start of the otyugh's next turn. *Success:*  Half damage only.
