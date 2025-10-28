---
smType: creature
name: Mummy
size: Small
type: Undead
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '11'
initiative: '-1 (9)'
hp: '58'
hitDice: 9d8 + 18
speeds:
  walk:
    distance: 20 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 6
    saveProf: false
  - key: wis
    score: 12
    saveProf: true
    saveMod: 3
  - key: cha
    score: 12
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Common plus two other languages
damageVulnerabilitiesList:
  - value: Fire
damageImmunitiesList:
  - value: Necrotic
  - value: Poison; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Frightened
  - value: Paralyzed
  - value: Poisoned
cr: '3'
xp: '700'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The mummy makes two Rotting Fist attacks and uses Dreadful Glare.
    multiattack:
      attacks:
        - name: Fist
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rotting Fist
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Bludgeoning damage plus 10 (3d6) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target can''t regain Hit Points, its Hit Point maximum doesn''t return to normal when finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d10
          bonus: 3
          type: Bludgeoning
          average: 8
        - dice: 3d6
          bonus: 0
          type: Necrotic
          average: 10
      reach: 5 ft.
      onHit:
        other: If the target is a creature, it is cursed. While cursed, the target can't regain Hit Points, its Hit Point maximum doesn't return to normal when finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack.
      additionalEffects: If the target is a creature, it is cursed. While cursed, the target can't regain Hit Points, its Hit Point maximum doesn't return to normal when finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Dreadful Glare
    entryType: save
    text: '*Wisdom Saving Throw*: DC 11, one creature the mummy can see within 60 feet. *Failure:*  The target has the Frightened condition until the end of the mummy''s next turn. *Success:*  The target is immune to this mummy''s Dreadful Glare for 24 hours.'
    save:
      ability: wis
      dc: 11
      targeting:
        type: single
        range: 60 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Frightened
              duration:
                type: until
                trigger: the end of the mummy's next turn
      onSuccess: The target is immune to this mummy's Dreadful Glare for 24 hours.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Mummy
*Small, Undead, Lawful Evil*

**AC** 11
**HP** 58 (9d8 + 18)
**Initiative** -1 (9)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 11
**Languages** Common plus two other languages
CR 3, PB +2, XP 700

## Actions

**Multiattack**
The mummy makes two Rotting Fist attacks and uses Dreadful Glare.

**Rotting Fist**
*Melee Attack Roll:* +5, reach 5 ft. 8 (1d10 + 3) Bludgeoning damage plus 10 (3d6) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target can't regain Hit Points, its Hit Point maximum doesn't return to normal when finishing a Long Rest, and its Hit Point maximum decreases by 10 (3d6) every 24 hours that elapse. A creature dies and turns to dust if reduced to 0 Hit Points by this attack.

**Dreadful Glare**
*Wisdom Saving Throw*: DC 11, one creature the mummy can see within 60 feet. *Failure:*  The target has the Frightened condition until the end of the mummy's next turn. *Success:*  The target is immune to this mummy's Dreadful Glare for 24 hours.
