---
smType: creature
name: Gibbering Mouther
size: Medium
type: Aberration
alignmentLawChaos: Chaotic
alignmentGoodEvil: Neutral
ac: '9'
initiative: '-1 (9)'
hp: '52'
hitDice: 7d8 + 21
speeds:
  walk:
    distance: 20 ft.
  swim:
    distance: 20 ft.
abilities:
  - key: str
    score: 10
    saveProf: false
  - key: dex
    score: 8
    saveProf: false
  - key: con
    score: 16
    saveProf: false
  - key: int
    score: 3
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
conditionImmunitiesList:
  - value: Prone
cr: '2'
xp: '450'
entries:
  - category: trait
    name: Aberrant Ground
    entryType: special
    text: The ground in a 10-foot Emanation originating from the mouther is Difficult Terrain.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Gibbering
    entryType: save
    text: 'The mouther babbles incoherently while it doesn''t have the Incapacitated condition. *Wisdom Saving Throw*: DC 10, any creature that starts its turn within 20 feet of the mouther while it is babbling. *Failure:*  The target rolls 1d8 to determine what it does during the current turn: - **1-4**: The target does nothing. - **5-6**: The target takes no action or Bonus Action and uses all its movement to move in a random direction. - **7-8**: The target makes a melee attack against a randomly determined creature within its reach or does nothing if it can''t make such an attack.'
    save:
      ability: wis
      dc: 10
      targeting:
        type: single
        range: 20 ft.
      onFail:
        effects:
          other: 'The target rolls 1d8 to determine what it does during the current turn: - **1-4**: The target does nothing. - **5-6**: The target takes no action or Bonus Action and uses all its movement to move in a random direction. - **7-8**: The target makes a melee attack against a randomly determined creature within its reach or does nothing if it can''t make such an attack.'
        legacyEffects: 'The target rolls 1d8 to determine what it does during the current turn: - **1-4**: The target does nothing. - **5-6**: The target takes no action or Bonus Action and uses all its movement to move in a random direction. - **7-8**: The target makes a melee attack against a randomly determined creature within its reach or does nothing if it can''t make such an attack.'
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Bite
    entryType: attack
    text: '*Melee Attack Roll:* +2, reach 5 ft. 7 (2d6) Piercing damage. If the target is a Medium or smaller creature, it has the Prone condition. The target dies if it is reduced to 0 Hit Points by this attack. Its body is then absorbed into the mouther, leaving only equipment behind.'
    attack:
      type: melee
      bonus: 2
      damage:
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
      additionalEffects: If the target is a Medium or smaller creature, it has the Prone condition. The target dies if it is reduced to 0 Hit Points by this attack. Its body is then absorbed into the mouther, leaving only equipment behind.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Blinding Spittle (Recharge 5-6)
    entryType: save
    text: '*Dexterity Saving Throw*: DC 10, each creature in a 10-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point within 30 feet. *Failure:*  7 (2d6) Radiant damage, and the target has the Blinded condition until the end of the mouther''s next turn.'
    recharge: 5-6
    save:
      ability: dex
      dc: 10
      targeting:
        shape: sphere
        size: 10 ft.
      onFail:
        effects:
          conditions:
            - condition: Blinded
              duration:
                type: until
                trigger: the end of the mouther's next turn
        damage:
          - dice: 2d6
            bonus: 0
            type: Radiant
            average: 7
    trigger.activation: action
    trigger.targeting:
      type: single
---

# Gibbering Mouther
*Medium, Aberration, Chaotic Neutral*

**AC** 9
**HP** 52 (7d8 + 21)
**Initiative** -1 (9)
**Speed** 20 ft., swim 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 10
CR 2, PB +2, XP 450

## Traits

**Aberrant Ground**
The ground in a 10-foot Emanation originating from the mouther is Difficult Terrain.

**Gibbering**
The mouther babbles incoherently while it doesn't have the Incapacitated condition. *Wisdom Saving Throw*: DC 10, any creature that starts its turn within 20 feet of the mouther while it is babbling. *Failure:*  The target rolls 1d8 to determine what it does during the current turn: - **1-4**: The target does nothing. - **5-6**: The target takes no action or Bonus Action and uses all its movement to move in a random direction. - **7-8**: The target makes a melee attack against a randomly determined creature within its reach or does nothing if it can't make such an attack.

## Actions

**Bite**
*Melee Attack Roll:* +2, reach 5 ft. 7 (2d6) Piercing damage. If the target is a Medium or smaller creature, it has the Prone condition. The target dies if it is reduced to 0 Hit Points by this attack. Its body is then absorbed into the mouther, leaving only equipment behind.

**Blinding Spittle (Recharge 5-6)**
*Dexterity Saving Throw*: DC 10, each creature in a 10-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point within 30 feet. *Failure:*  7 (2d6) Radiant damage, and the target has the Blinded condition until the end of the mouther's next turn.
