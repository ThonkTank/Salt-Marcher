---
smType: creature
name: Werewolf
size: Small
type: Monstrosity
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '15'
initiative: +4 (14)
hp: '71'
hitDice: 11d8 + 22
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 14
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 10
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Common (can't speak in wolf form)
cr: '3'
xp: '700'
entries:
  - category: trait
    name: Pack Tactics
    entryType: special
    text: The werewolf has Advantage on an attack roll against a creature if at least one of the werewolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The werewolf makes two attacks, using Scratch or Longbow in any combination. It can replace one attack with a Bite attack.
    multiattack:
      attacks:
        - name: two
          count: 1
      substitutions:
        - replace: attack
          with:
            type: attack
            name: a Bite attack
  - category: action
    name: Bite (Wolf or Hybrid Form Only)
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 12 (2d8 + 3) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 12. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Werewolf under the DM''s control and has 10 Hit Points. *Success:*  The target is immune to this werewolf''s curse for 24 hours.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d8
          bonus: 3
          type: Piercing
          average: 12
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Cursed
            duration:
              type: hours
              count: 24
      additionalEffects: 'If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 12. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Werewolf under the DM''s control and has 10 Hit Points. *Success:*  The target is immune to this werewolf''s curse for 24 hours.'
  - category: action
    name: Scratch
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Slashing
          average: 10
      reach: 5 ft.
  - category: action
    name: Longbow (Humanoid or Hybrid Form Only)
    entryType: attack
    text: '*Ranged Attack Roll:* +4, range 150/600 ft. 11 (2d8 + 2) Piercing damage.'
    attack:
      type: ranged
      bonus: 4
      damage:
        - dice: 2d8
          bonus: 2
          type: Piercing
          average: 11
      range: 150/600 ft.
  - category: bonus
    name: Shape-Shift
    entryType: special
    text: The werewolf shape-shifts into a Large wolf-humanoid hybrid or a Medium wolf, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
---

# Werewolf
*Small, Monstrosity, Chaotic Evil*

**AC** 15
**HP** 71 (11d8 + 22)
**Initiative** +4 (14)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Common (can't speak in wolf form)
CR 3, PB +2, XP 700

## Traits

**Pack Tactics**
The werewolf has Advantage on an attack roll against a creature if at least one of the werewolf's allies is within 5 feet of the creature and the ally doesn't have the Incapacitated condition.

## Actions

**Multiattack**
The werewolf makes two attacks, using Scratch or Longbow in any combination. It can replace one attack with a Bite attack.

**Bite (Wolf or Hybrid Form Only)**
*Melee Attack Roll:* +5, reach 5 ft. 12 (2d8 + 3) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 12. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Werewolf under the DM's control and has 10 Hit Points. *Success:*  The target is immune to this werewolf's curse for 24 hours.

**Scratch**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage.

**Longbow (Humanoid or Hybrid Form Only)**
*Ranged Attack Roll:* +4, range 150/600 ft. 11 (2d8 + 2) Piercing damage.

## Bonus Actions

**Shape-Shift**
The werewolf shape-shifts into a Large wolf-humanoid hybrid or a Medium wolf, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
