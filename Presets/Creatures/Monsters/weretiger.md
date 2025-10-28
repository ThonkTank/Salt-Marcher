---
smType: creature
name: Weretiger
size: Small
type: Monstrosity
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '12'
initiative: +2 (12)
hp: '120'
hitDice: 16d8 + 48
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 15
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 13
    saveProf: false
  - key: cha
    score: 11
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '5'
  - skill: Stealth
    value: '4'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Common (can't speak in tiger form)
cr: '4'
xp: '1100'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The weretiger makes two attacks, using Scratch or Longbow in any combination. It can replace one attack with a Bite attack.
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
    name: Bite (Tiger or Hybrid Form Only)
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 12 (2d8 + 3) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 13. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Weretiger under the DM''s control and has 10 Hit Points. *Success:*  The target is immune to this weretiger''s curse for 24 hours.'
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
      additionalEffects: 'If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 13. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Weretiger under the DM''s control and has 10 Hit Points. *Success:*  The target is immune to this weretiger''s curse for 24 hours.'
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
    name: Prowl (Tiger or Hybrid Form Only)
    entryType: special
    text: The weretiger moves up to its Speed without provoking Opportunity Attacks. At the end of this movement, the weretiger can take the Hide action.
  - category: bonus
    name: Shape-Shift
    entryType: special
    text: The weretiger shape-shifts into a Large tiger-humanoid hybrid or a Large tiger, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
---

# Weretiger
*Small, Monstrosity, Neutral Neutral*

**AC** 12
**HP** 120 (16d8 + 48)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 15
**Languages** Common (can't speak in tiger form)
CR 4, PB +2, XP 1100

## Actions

**Multiattack**
The weretiger makes two attacks, using Scratch or Longbow in any combination. It can replace one attack with a Bite attack.

**Bite (Tiger or Hybrid Form Only)**
*Melee Attack Roll:* +5, reach 5 ft. 12 (2d8 + 3) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 13. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Weretiger under the DM's control and has 10 Hit Points. *Success:*  The target is immune to this weretiger's curse for 24 hours.

**Scratch**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Slashing damage.

**Longbow (Humanoid or Hybrid Form Only)**
*Ranged Attack Roll:* +4, range 150/600 ft. 11 (2d8 + 2) Piercing damage.

## Bonus Actions

**Prowl (Tiger or Hybrid Form Only)**
The weretiger moves up to its Speed without provoking Opportunity Attacks. At the end of this movement, the weretiger can take the Hide action.

**Shape-Shift**
The weretiger shape-shifts into a Large tiger-humanoid hybrid or a Large tiger, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
