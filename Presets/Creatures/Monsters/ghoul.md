---
smType: creature
name: Ghoul
size: Medium
type: Undead
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '12'
initiative: +2 (12)
hp: '22'
hitDice: 5d8
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 13
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 10
    saveProf: false
  - key: int
    score: 7
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 6
    saveProf: false
pb: '+2'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common
damageImmunitiesList:
  - value: Poison; Charmed
  - value: Exhaustion
conditionImmunitiesList:
  - value: Poisoned
cr: '1'
xp: '200'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The ghoul makes two Bite attacks.
    multiattack:
      attacks:
        - name: Bite
          count: 2
      substitutions: []
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 3 (1d6) Necrotic damage.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d6
          bonus: 2
          type: Piercing
          average: 5
        - dice: 1d6
          bonus: 0
          type: Necrotic
          average: 3
      reach: 5 ft.
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Slashing damage. If the target is a creature that isn''t an Undead or elf, it is subjected to the following effect. *Constitution Saving Throw*: DC 10. *Failure:*  The target has the Paralyzed condition until the end of its next turn.'
    attack:
      type: melee
      bonus: 4
      damage:
        - dice: 1d4
          bonus: 2
          type: Slashing
          average: 4
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Paralyzed
            duration:
              type: until
              trigger: the end of its next turn
      additionalEffects: 'If the target is a creature that isn''t an Undead or elf, it is subjected to the following effect. *Constitution Saving Throw*: DC 10. *Failure:*  The target has the Paralyzed condition until the end of its next turn.'
---

# Ghoul
*Medium, Undead, Chaotic Evil*

**AC** 12
**HP** 22 (5d8)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
**Languages** Common
CR 1, PB +2, XP 200

## Actions

**Multiattack**
The ghoul makes two Bite attacks.

**Bite**
*Melee Attack Roll:* +4, reach 5 ft. 5 (1d6 + 2) Piercing damage plus 3 (1d6) Necrotic damage.

**Claw**
*Melee Attack Roll:* +4, reach 5 ft. 4 (1d4 + 2) Slashing damage. If the target is a creature that isn't an Undead or elf, it is subjected to the following effect. *Constitution Saving Throw*: DC 10. *Failure:*  The target has the Paralyzed condition until the end of its next turn.
