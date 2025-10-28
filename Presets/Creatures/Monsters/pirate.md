---
smType: creature
name: Pirate
size: Small
type: Humanoid
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '14'
initiative: +5 (15)
hp: '33'
hitDice: 6d8 + 6
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 16
    saveProf: true
    saveMod: 5
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 8
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 14
    saveProf: true
    saveMod: 4
pb: '+2'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Common plus one other language
cr: '1'
xp: '200'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The pirate makes two Dagger attacks. It can replace one attack with a use of Enthralling Panache.
    multiattack:
      attacks:
        - name: Dagger
          count: 2
      substitutions:
        - replace: attack
          with:
            type: attack
            name: Enthralling Panache
  - category: action
    name: Dagger
    entryType: special
    text: '*Melee or Ranged Attack Roll:* +5, reach 5 ft. or range 20/60 ft. 5 (1d4 + 3) Piercing damage.'
  - category: action
    name: Enthralling Panache
    entryType: save
    text: '*Wisdom Saving Throw*: DC 12, one creature the pirate can see within 30 feet. *Failure:*  The target has the Charmed condition until the start of the pirate''s next turn.'
    save:
      ability: wis
      dc: 12
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

# Pirate
*Small, Humanoid, Neutral Neutral*

**AC** 14
**HP** 33 (6d8 + 6)
**Initiative** +5 (15)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common plus one other language
CR 1, PB +2, XP 200

## Actions

**Multiattack**
The pirate makes two Dagger attacks. It can replace one attack with a use of Enthralling Panache.

**Dagger**
*Melee or Ranged Attack Roll:* +5, reach 5 ft. or range 20/60 ft. 5 (1d4 + 3) Piercing damage.

**Enthralling Panache**
*Wisdom Saving Throw*: DC 12, one creature the pirate can see within 30 feet. *Failure:*  The target has the Charmed condition until the start of the pirate's next turn.
