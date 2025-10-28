---
smType: creature
name: Kraken
size: Gargantuan
type: Monstrosity
typeTags:
  - value: Titan
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '18'
initiative: +4 (14)
hp: '481'
hitDice: 26d20 + 208
speeds:
  walk:
    distance: 30 ft.
  swim:
    distance: 120 ft.
abilities:
  - key: str
    score: 30
    saveProf: true
    saveMod: 17
  - key: dex
    score: 11
    saveProf: true
    saveMod: 7
  - key: con
    score: 26
    saveProf: true
    saveMod: 15
  - key: int
    score: 22
    saveProf: false
  - key: wis
    score: 18
    saveProf: true
    saveMod: 11
  - key: cha
    score: 20
    saveProf: false
pb: '+7'
skills:
  - skill: History
    value: '13'
  - skill: Perception
    value: '11'
sensesList:
  - type: truesight
    range: '120'
passivesList:
  - skill: Perception
    value: '21'
languagesList:
  - value: Understands Abyssal
  - value: Celestial
  - value: Infernal
  - value: And Primordial but can't speak
  - value: telepathy 120 ft.
damageImmunitiesList:
  - value: Cold
  - value: Lightning; Frightened
conditionImmunitiesList:
  - value: Grappled
  - value: Paralyzed
  - value: Restrained
cr: '23'
xp: '50000'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The kraken can breathe air and water.
  - category: trait
    name: Legendary Resistance (4/Day, or 5/Day in Lair)
    entryType: special
    text: If the kraken fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 4
      reset: day
  - category: trait
    name: Siege Monster
    entryType: special
    text: The kraken deals double damage to objects and structures.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The kraken makes two Tentacle attacks and uses Fling, Lightning Strike, or Swallow.
    multiattack:
      attacks:
        - name: Tentacle
          count: 2
      substitutions: []
  - category: action
    name: Tentacle
    entryType: attack
    text: '*Melee Attack Roll:* +17, reach 30 ft. 24 (4d6 + 10) Bludgeoning damage. The target has the Grappled condition (escape DC 20) from one of ten tentacles, and it has the Restrained condition until the grapple ends.'
    attack:
      type: melee
      bonus: 17
      damage:
        - dice: 4d6
          bonus: 10
          type: Bludgeoning
          average: 24
      reach: 30 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 20
            duration:
              type: until
              trigger: the grapple ends
          - condition: Restrained
            escape:
              type: dc
              dc: 20
            duration:
              type: until
              trigger: the grapple ends
      additionalEffects: The target has the Grappled condition (escape DC 20) from one of ten tentacles, and it has the Restrained condition until the grapple ends.
  - category: action
    name: Fling
    entryType: save
    text: 'The kraken throws a Large or smaller creature Grappled by it to a space it can see within 60 feet of itself that isn''t in the air. *Dexterity Saving Throw*: DC 25, the creature thrown and each creature in the destination space. *Failure:*  18 (4d8) Bludgeoning damage, and the target has the Prone condition. *Success:*  Half damage only.'
    save:
      ability: dex
      dc: 25
      targeting:
        type: single
        restrictions:
          creatureTypes:
            - creature
      onFail:
        effects:
          conditions:
            - condition: Prone
        damage:
          - dice: 4d8
            bonus: 0
            type: Bludgeoning
            average: 18
      onSuccess:
        damage: half
        legacyText: Half damage only.
  - category: action
    name: Lightning Strike
    entryType: save
    text: '*Dexterity Saving Throw*: DC 23, one creature the kraken can see within 120 feet. *Failure:*  33 (6d10) Lightning damage. *Success:*  Half damage.'
    save:
      ability: dex
      dc: 23
      targeting:
        type: single
        range: 120 ft.
        restrictions:
          visibility: true
      onFail:
        effects:
          other: 33 (6d10) Lightning damage.
        damage:
          - dice: 6d10
            bonus: 0
            type: Lightning
            average: 33
        legacyEffects: 33 (6d10) Lightning damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Swallow
    entryType: save
    text: '*Dexterity Saving Throw*: DC 25, one creature Grappled by the kraken (it can have up to four creatures swallowed at a time). *Failure:*  23 (3d8 + 10) Piercing damage. If the target is Large or smaller, it is swallowed and no longer Grappled. A swallowed creature has the Restrained condition, has Cover|XPHB|Total Cover against attacks and other effects outside the kraken, and takes 24 (7d6) Acid damage at the start of each of its turns. If the kraken takes 50 damage or more on a single turn from a creature inside it, the kraken must succeed on a DC 25 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 10 feet of the kraken with the Prone condition. If the kraken dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 15 feet of movement, exiting Prone.'
    save:
      ability: dex
      dc: 25
      targeting:
        type: single
        count: 4
        restrictions:
          other:
            - grappled by source
      onFail:
        effects:
          conditions:
            - condition: Restrained
              restrictions:
                size: Large or smaller
            - condition: Restrained
              restrictions:
                size: Large or smaller
        damage:
          - dice: 3d8
            bonus: 10
            type: Piercing
            average: 23
          - dice: 7d6
            bonus: 0
            type: Acid
            average: 24
  - category: legendary
    name: Storm Bolt
    entryType: special
    text: The kraken uses Lightning Strike.
  - category: legendary
    name: Toxic Ink
    entryType: save
    text: '*Constitution Saving Throw*: DC 23, each creature in a 15-foot Emanation originating from the kraken while it is underwater. *Failure:*  The target has the Blinded and Poisoned conditions until the end of the kraken''s next turn. The kraken then moves up to its Speed. *Failure or Success*:  The kraken can''t take this action again until the start of its next turn.'
    save:
      ability: con
      dc: 23
      targeting:
        shape: emanation
        size: 15 ft.
        origin: self
      onFail:
        effects:
          other: The target has the Blinded and Poisoned conditions until the end of the kraken's next turn. The kraken then moves up to its Speed.
        legacyEffects: The target has the Blinded and Poisoned conditions until the end of the kraken's next turn. The kraken then moves up to its Speed.
---

# Kraken
*Gargantuan, Monstrosity, Chaotic Evil*

**AC** 18
**HP** 481 (26d20 + 208)
**Initiative** +4 (14)
**Speed** 30 ft., swim 120 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** truesight 120 ft.; Passive Perception 21
**Languages** Understands Abyssal, Celestial, Infernal, And Primordial but can't speak, telepathy 120 ft.
CR 23, PB +7, XP 50000

## Traits

**Amphibious**
The kraken can breathe air and water.

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the kraken fails a saving throw, it can choose to succeed instead.

**Siege Monster**
The kraken deals double damage to objects and structures.

## Actions

**Multiattack**
The kraken makes two Tentacle attacks and uses Fling, Lightning Strike, or Swallow.

**Tentacle**
*Melee Attack Roll:* +17, reach 30 ft. 24 (4d6 + 10) Bludgeoning damage. The target has the Grappled condition (escape DC 20) from one of ten tentacles, and it has the Restrained condition until the grapple ends.

**Fling**
The kraken throws a Large or smaller creature Grappled by it to a space it can see within 60 feet of itself that isn't in the air. *Dexterity Saving Throw*: DC 25, the creature thrown and each creature in the destination space. *Failure:*  18 (4d8) Bludgeoning damage, and the target has the Prone condition. *Success:*  Half damage only.

**Lightning Strike**
*Dexterity Saving Throw*: DC 23, one creature the kraken can see within 120 feet. *Failure:*  33 (6d10) Lightning damage. *Success:*  Half damage.

**Swallow**
*Dexterity Saving Throw*: DC 25, one creature Grappled by the kraken (it can have up to four creatures swallowed at a time). *Failure:*  23 (3d8 + 10) Piercing damage. If the target is Large or smaller, it is swallowed and no longer Grappled. A swallowed creature has the Restrained condition, has Cover|XPHB|Total Cover against attacks and other effects outside the kraken, and takes 24 (7d6) Acid damage at the start of each of its turns. If the kraken takes 50 damage or more on a single turn from a creature inside it, the kraken must succeed on a DC 25 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 10 feet of the kraken with the Prone condition. If the kraken dies, any swallowed creature no longer has the Restrained condition and can escape from the corpse using 15 feet of movement, exiting Prone.

## Legendary Actions

**Storm Bolt**
The kraken uses Lightning Strike.

**Toxic Ink**
*Constitution Saving Throw*: DC 23, each creature in a 15-foot Emanation originating from the kraken while it is underwater. *Failure:*  The target has the Blinded and Poisoned conditions until the end of the kraken's next turn. The kraken then moves up to its Speed. *Failure or Success*:  The kraken can't take this action again until the start of its next turn.
