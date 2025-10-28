---
smType: creature
name: Wereboar
size: Small
type: Monstrosity
alignmentLawChaos: Neutral
alignmentGoodEvil: Evil
ac: '15'
initiative: +2 (12)
hp: '97'
hitDice: 15d8 + 30
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 17
    saveProf: false
  - key: dex
    score: 10
    saveProf: false
  - key: con
    score: 15
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 11
    saveProf: false
  - key: cha
    score: 8
    saveProf: false
pb: '+2'
skills:
  - skill: Perception
    value: '2'
passivesList:
  - skill: Perception
    value: '12'
languagesList:
  - value: Common (can't speak in boar form)
cr: '4'
xp: '1100'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The wereboar makes two attacks, using Javelin or Tusk in any combination. It can replace one attack with a Gore attack.
    multiattack:
      attacks:
        - name: two
          count: 1
      substitutions:
        - replace: attack
          with:
            type: attack
            name: a Gore attack
  - category: action
    name: Gore (Boar or Hybrid Form Only)
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 12 (2d8 + 3) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 12. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Wereboar under the DM''s control and has 10 Hit Points. *Success:*  The target is immune to this wereboar''s curse for 24 hours.'
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
      additionalEffects: 'If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 12. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Wereboar under the DM''s control and has 10 Hit Points. *Success:*  The target is immune to this wereboar''s curse for 24 hours.'
  - category: action
    name: Javelin (Humanoid or Hybrid Form Only)
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +5, reach 5 ft. or range 30/120 ft. 13 (3d6 + 3) Piercing damage.'
  - category: action
    name: Tusk (Boar or Hybrid Form Only)
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage. If the target is a Medium or smaller creature and the wereboar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 7 (2d6) Piercing damage and has the Prone condition.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 2d6
          bonus: 3
          type: Piercing
          average: 10
        - dice: 2d6
          bonus: 0
          type: Piercing
          average: 7
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Prone
            restrictions:
              size: Medium or smaller
      additionalEffects: If the target is a Medium or smaller creature and the wereboar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 7 (2d6) Piercing damage and has the Prone condition.
  - category: bonus
    name: Shape-Shift
    entryType: special
    text: The wereboar shape-shifts into a Medium boar-humanoid hybrid or a Small boar, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
---

# Wereboar
*Small, Monstrosity, Neutral Evil*

**AC** 15
**HP** 97 (15d8 + 30)
**Initiative** +2 (12)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common (can't speak in boar form)
CR 4, PB +2, XP 1100

## Actions

**Multiattack**
The wereboar makes two attacks, using Javelin or Tusk in any combination. It can replace one attack with a Gore attack.

**Gore (Boar or Hybrid Form Only)**
*Melee Attack Roll:* +5, reach 5 ft. 12 (2d8 + 3) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 12. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Wereboar under the DM's control and has 10 Hit Points. *Success:*  The target is immune to this wereboar's curse for 24 hours.

**Javelin (Humanoid or Hybrid Form Only)**
*Melee or Ranged Attack Roll:* +5, reach 5 ft. or range 30/120 ft. 13 (3d6 + 3) Piercing damage.

**Tusk (Boar or Hybrid Form Only)**
*Melee Attack Roll:* +5, reach 5 ft. 10 (2d6 + 3) Piercing damage. If the target is a Medium or smaller creature and the wereboar moved 20+ feet straight toward it immediately before the hit, the target takes an extra 7 (2d6) Piercing damage and has the Prone condition.

## Bonus Actions

**Shape-Shift**
The wereboar shape-shifts into a Medium boar-humanoid hybrid or a Small boar, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
