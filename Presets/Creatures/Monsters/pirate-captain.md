---
smType: creature
name: Pirate Captain
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '17'
initiative: +7 (17)
hp: '84'
hitDice: 13d8 + 26
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 10
    saveProf: true
    saveMod: 3
  - key: dex
    score: 18
    saveProf: true
    saveMod: 7
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 14
    saveProf: true
    saveMod: 5
  - key: cha
    score: 17
    saveProf: true
    saveMod: 6
pb: '+3'
skills:
  - skill: Acrobatics
    value: '7'
  - skill: Perception
    value: '5'
passivesList:
  - skill: Perception
    value: '15'
languagesList:
  - value: Common plus one other language
cr: '6'
xp: '2300'
entries:
  - category: action
    name: Multiattack
    entryType: special
    text: The pirate makes three attacks, using Rapier or Pistol in any combination.
  - category: action
    name: Rapier
    entryType: attack
    text: '*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Piercing damage, and the pirate has Advantage on the next attack roll it makes before the end of this turn.'
    attack:
      type: melee
      bonus: 7
      damage:
        - dice: 2d8
          bonus: 4
          type: Piercing
          average: 13
      reach: 5 ft.
  - category: action
    name: Pistol
    entryType: attack
    text: '*Ranged Attack Roll:* +7, range 30/90 ft. 15 (2d10 + 4) Piercing damage.'
    attack:
      type: ranged
      bonus: 7
      damage:
        - dice: 2d10
          bonus: 4
          type: Piercing
          average: 15
      range: 30/90 ft.
  - category: bonus
    name: Captain's Charm
    entryType: save
    text: '*Wisdom Saving Throw*: DC 14, one creature the pirate can see within 30 feet. *Failure:*  The target has the Charmed condition until the start of the pirate''s next turn.'
    save:
      ability: wis
      dc: 14
      targeting:
        type: single
        range: 30 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          conditions:
            - condition: Charmed
              duration:
                type: until
                trigger: the start of the pirate's next turn
---

# Pirate Captain
*Small, Humanoid, Neutral Neutral*

**AC** 17
**HP** 84 (13d8 + 26)
**Initiative** +7 (17)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common plus one other language
CR 6, PB +3, XP 2300

## Actions

**Multiattack**
The pirate makes three attacks, using Rapier or Pistol in any combination.

**Rapier**
*Melee Attack Roll:* +7, reach 5 ft. 13 (2d8 + 4) Piercing damage, and the pirate has Advantage on the next attack roll it makes before the end of this turn.

**Pistol**
*Ranged Attack Roll:* +7, range 30/90 ft. 15 (2d10 + 4) Piercing damage.

## Bonus Actions

**Captain's Charm**
*Wisdom Saving Throw*: DC 14, one creature the pirate can see within 30 feet. *Failure:*  The target has the Charmed condition until the start of the pirate's next turn.
