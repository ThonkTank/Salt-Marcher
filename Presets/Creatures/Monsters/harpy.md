---
smType: creature
name: Harpy
size: Medium
type: Monstrosity
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '11'
initiative: +1 (11)
hp: '38'
hitDice: 7d8 + 7
speeds:
  walk:
    distance: 20 ft.
  fly:
    distance: 40 ft.
abilities:
  - key: str
    score: 12
    saveProf: false
  - key: dex
    score: 13
    saveProf: false
  - key: con
    score: 12
    saveProf: false
  - key: int
    score: 7
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 13
    saveProf: false
pb: '+2'
passivesList:
  - skill: Perception
    value: '10'
languagesList:
  - value: Common
cr: '1'
xp: '200'
entries:
  - category: action
    name: Claw
    entryType: attack
    text: '*Melee Attack Roll:* +3, reach 5 ft. 6 (2d4 + 1) Slashing damage.'
    attack:
      type: melee
      bonus: 3
      damage:
        - dice: 2d4
          bonus: 1
          type: Slashing
          average: 6
      reach: 5 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Luring Song
    entryType: save
    text: 'The harpy sings a magical melody, which lasts until the harpy''s  Concentration ends on it. *Wisdom Saving Throw*: DC 11, each Humanoid and Giant in a 300-foot Emanation originating from the harpy when the song starts. *Failure:*  The target has the Charmed condition until the song ends and repeats the save at the end of each of its turns. While Charmed, the target has the Incapacitated condition and ignores the Luring Song of other harpies. If the target is more than 5 feet from the harpy, the target moves on its turn toward the harpy by the most direct route, trying to get within 5 feet of the harpy. It doesn''t avoid Opportunity Attacks; however, before moving into damaging terrain (such as lava or a pit) and whenever it takes damage from a source other than the harpy, the target repeats the save. *Success:*  The target is immune to this harpy''s Luring Song for 24 hours.'
    save:
      ability: wis
      dc: 11
      targeting:
        shape: emanation
        size: 300 ft.
        origin: self
      onFail:
        effects:
          conditions:
            - condition: Charmed
              duration:
                type: until
                trigger: the song ends and repeats the save at the end of each of its turns
              saveToEnd:
                timing: end-of-turn
              restrictions:
                while: While Charmed, the target has the Incapacitated condition
            - condition: Incapacitated
              duration:
                type: until
                trigger: the song ends and repeats the save at the end of each of its turns
              saveToEnd:
                timing: end-of-turn
              restrictions:
                while: While Charmed, the target has the Incapacitated condition
          movement:
            type: compelled
            description: moves on its turn toward the harpy by
      onSuccess: The target is immune to this harpy's Luring Song for 24 hours.
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Harpy
*Medium, Monstrosity, Chaotic Evil*

**AC** 11
**HP** 38 (7d8 + 7)
**Initiative** +1 (11)
**Speed** 20 ft., fly 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Languages** Common
CR 1, PB +2, XP 200

## Actions

**Claw**
*Melee Attack Roll:* +3, reach 5 ft. 6 (2d4 + 1) Slashing damage.

**Luring Song**
The harpy sings a magical melody, which lasts until the harpy's  Concentration ends on it. *Wisdom Saving Throw*: DC 11, each Humanoid and Giant in a 300-foot Emanation originating from the harpy when the song starts. *Failure:*  The target has the Charmed condition until the song ends and repeats the save at the end of each of its turns. While Charmed, the target has the Incapacitated condition and ignores the Luring Song of other harpies. If the target is more than 5 feet from the harpy, the target moves on its turn toward the harpy by the most direct route, trying to get within 5 feet of the harpy. It doesn't avoid Opportunity Attacks; however, before moving into damaging terrain (such as lava or a pit) and whenever it takes damage from a source other than the harpy, the target repeats the save. *Success:*  The target is immune to this harpy's Luring Song for 24 hours.
