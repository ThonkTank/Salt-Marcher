---
smType: creature
name: Wererat
size: Small
type: Monstrosity
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '13'
initiative: +3 (13)
hp: '60'
hitDice: 11d8 + 11
speeds:
  walk:
    distance: 30 ft.
  climb:
    distance: 30 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 16
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '4'
  - skill: Stealth
    value: '5'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '14'
languagesList:
  - value: Common (can't speak in rat form)
cr: '2'
xp: '450'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The wererat makes two attacks, using Scratch or Hand Crossbow in any combination. It can replace one attack with a Bite attack.
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
    name: Bite (Rat or Hybrid Form Only)
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 8 (2d4 + 3) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 11. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Wererat under the DM''s control and has 10 Hit Points. *Success:*  The target is immune to this wererat''s curse for 24 hours.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d4
          bonus: 3
          type: Piercing
          average: 8
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Cursed
            duration:
              type: hours
              count: 24
      additionalEffects: 'If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 11. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Wererat under the DM''s control and has 10 Hit Points. *Success:*  The target is immune to this wererat''s curse for 24 hours.'
  - category: action
    name: Scratch
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Slashing damage.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Slashing
          average: 6
      reach: 5 ft.
  - category: action
    name: Hand Crossbow (Humanoid or Hybrid Form Only)
    entryType: attack
    text: '*Ranged Attack Roll:* +5, range 30/120 ft. 6 (1d6 + 3) Piercing damage.'
    attack:
      type: ranged
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Piercing
          average: 6
      range: 30/120 ft.
  - category: bonus
    name: Shape-Shift
    entryType: special
    text: The wererat shape-shifts into a Medium rat-humanoid hybrid or a Small rat, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
---

# Wererat
*Small, Monstrosity, Lawful Evil*

**AC** 13
**HP** 60 (11d8 + 11)
**Initiative** +3 (13)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 14
**Languages** Common (can't speak in rat form)
CR 2, PB +2, XP 450

## Actions

**Multiattack**
The wererat makes two attacks, using Scratch or Hand Crossbow in any combination. It can replace one attack with a Bite attack.

**Bite (Rat or Hybrid Form Only)**
*Melee Attack Roll:* +5, reach 5 ft. 8 (2d4 + 3) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 11. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Wererat under the DM's control and has 10 Hit Points. *Success:*  The target is immune to this wererat's curse for 24 hours.

**Scratch**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Slashing damage.

**Hand Crossbow (Humanoid or Hybrid Form Only)**
*Ranged Attack Roll:* +5, range 30/120 ft. 6 (1d6 + 3) Piercing damage.

## Bonus Actions

**Shape-Shift**
The wererat shape-shifts into a Medium rat-humanoid hybrid or a Small rat, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
