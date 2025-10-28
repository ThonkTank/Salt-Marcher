---
smType: creature
name: Darkmantle
size: Small
type: Aberration
alignmentOverride: Unaligned
ac: '11'
initiative: +3 (13)
hp: '22'
hitDice: 5d6 + 5
speeds:
  walk:
    distance: 10 ft.
  fly:
    distance: 30 ft.
abilities:
  - key: str
    score: 16
    saveProf: false
  - key: dex
    score: 12
    saveProf: false
  - key: con
    score: 13
    saveProf: false
  - key: int
    score: 2
    saveProf: false
  - key: wis
    score: 10
    saveProf: false
  - key: cha
    score: 5
    saveProf: false
pb: '+2'
skills:
  - skill: Stealth
    value: '3'
sensesList:
  - type: blindsight
    range: '60'
passivesList:
  - skill: Perception
    value: '10'
cr: 1/2
xp: '100'
entries:
  - category: action
    name: Crush
    entryType: attack
    text: '*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Bludgeoning damage, and the darkmantle attaches to the target. If the target is a Medium or smaller creature and the darkmantle had Advantage on the attack roll, it covers the target, which has the Blinded condition and is suffocating while the darkmantle is attached in this way. While attached to a target, the darkmantle can attack only the target but has Advantage on its attack rolls. Its Speed becomes 0, it can''t benefit from any bonus to its Speed, and it moves with the target. A creature can take an action to try to detach the darkmantle from itself, doing so with a successful DC 13 Strength (Athletics) check. On its turn, the darkmantle can detach itself by using 5 feet of movement.'
    attack:
      type: melee
      bonus: 5
      damage:
        - dice: 1d6
          bonus: 3
          type: Bludgeoning
          average: 6
      reach: 5 ft.
  - category: action
    name: Darkness Aura (1/Day)
    entryType: special
    text: Magical darkness fills a 15-foot Emanation originating from the darkmantle. This effect lasts while the darkmantle maintains  Concentration on it, up to 10 minutes. Darkvision can't penetrate this area, and no light can illuminate it.
    limitedUse:
      count: 1
      reset: day
---

# Darkmantle
*Small, Aberration, Unaligned*

**AC** 11
**HP** 22 (5d6 + 5)
**Initiative** +3 (13)
**Speed** 10 ft., fly 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft.; Passive Perception 10
CR 1/2, PB +2, XP 100

## Actions

**Crush**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Bludgeoning damage, and the darkmantle attaches to the target. If the target is a Medium or smaller creature and the darkmantle had Advantage on the attack roll, it covers the target, which has the Blinded condition and is suffocating while the darkmantle is attached in this way. While attached to a target, the darkmantle can attack only the target but has Advantage on its attack rolls. Its Speed becomes 0, it can't benefit from any bonus to its Speed, and it moves with the target. A creature can take an action to try to detach the darkmantle from itself, doing so with a successful DC 13 Strength (Athletics) check. On its turn, the darkmantle can detach itself by using 5 feet of movement.

**Darkness Aura (1/Day)**
Magical darkness fills a 15-foot Emanation originating from the darkmantle. This effect lasts while the darkmantle maintains  Concentration on it, up to 10 minutes. Darkvision can't penetrate this area, and no light can illuminate it.
