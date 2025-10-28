---
smType: creature
name: Werebear
size: Small
type: Monstrosity
alignmentLawChaos: Neutral
alignmentGoodEvil: Good
ac: '15'
initiative: +3 (13)
hp: '135'
hitDice: 18d8 + 54
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 19
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 17
    saveProf: false
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 12
    saveProf: false
pb: '+3'
skills:
  - skill: Perception
    value: '7'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '17'
languagesList:
  - value: Common (can't speak in bear form)
cr: '5'
xp: '1800'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The werebear makes two attacks, using Handaxe or Rend in any combination. It can replace one attack with a Bite attack.
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
    name: Bite (Bear or Hybrid Form Only)
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 17 (2d12 + 4) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 14. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Werebear under the DM''s control and has 10 Hit Points. *Success:*  The target is immune to this werebear''s curse for 24 hours.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d12
          bonus: 4
          type: Piercing
          average: 17
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Cursed
            duration:
              type: hours
              count: 24
      additionalEffects: 'If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 14. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Werebear under the DM''s control and has 10 Hit Points. *Success:*  The target is immune to this werebear''s curse for 24 hours.'
  - category: action
    name: Handaxe (Humanoid or Hybrid Form Only)
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +7, reach 5 ft or range 20/60 ft. 14 (3d6 + 4) Slashing damage.'
  - category: action
    name: Rend (Bear or Hybrid Form Only)
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Slashing damage.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d8
          bonus: 4
          type: Slashing
          average: 13
      reach: 5 ft.
  - category: bonus
    name: Shape-Shift
    entryType: special
    text: The werebear shape-shifts into a Large bear-humanoid hybrid form or a Large bear, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
---

# Werebear
*Small, Monstrosity, Neutral Good*

**AC** 15
**HP** 135 (18d8 + 54)
**Initiative** +3 (13)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 17
**Languages** Common (can't speak in bear form)
CR 5, PB +3, XP 1800

## Actions

**Multiattack**
The werebear makes two attacks, using Handaxe or Rend in any combination. It can replace one attack with a Bite attack.

**Bite (Bear or Hybrid Form Only)**
*Melee Attack Roll:* +7, reach 5 ft. 17 (2d12 + 4) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 14. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Werebear under the DM's control and has 10 Hit Points. *Success:*  The target is immune to this werebear's curse for 24 hours.

**Handaxe (Humanoid or Hybrid Form Only)**
*Melee or Ranged Attack Roll:* +7, reach 5 ft or range 20/60 ft. 14 (3d6 + 4) Slashing damage.

**Rend (Bear or Hybrid Form Only)**
*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Slashing damage.

## Bonus Actions

**Shape-Shift**
The werebear shape-shifts into a Large bear-humanoid hybrid form or a Large bear, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
