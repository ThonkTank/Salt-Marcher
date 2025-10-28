---
smType: creature
name: Aboleth
size: Large
type: Aberration
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '17'
initiative: +3 (13)
hp: '150'
hitDice: 20d10 + 40
speeds:
  walk:
    distance: 10 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 21
    saveProf: false
  - key: dex
    score: 9
    saveProf: true
    saveMod: 3
  - key: con
    score: 15
    saveProf: true
    saveMod: 6
  - key: int
    score: 18
    saveProf: true
    saveMod: 8
  - key: wis
    score: 15
    saveProf: true
    saveMod: 6
  - key: cha
    score: 18
    saveProf: false
pb: '+4'
skills:
  - skill: History
    value: '12'
  - skill: Perception
    value: '10'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '20'
languagesList:
  - value: Deep Speech
  - value: telepathy 120 ft.
cr: '10'
xp: '5900'
entries:
  - category: trait
    name: Amphibious
    entryType: special
    text: The aboleth can breathe air and water.
  - category: trait
    name: Eldritch Restoration
    entryType: special
    text: If destroyed, the aboleth gains a new body in 5d10 days, reviving with all its Hit Points in the Far Realm or another location chosen by the DM.
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    entryType: special
    text: If the aboleth fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 3
      reset: day
  - category: trait
    name: Mucus Cloud
    entryType: save
    text: 'While underwater, the aboleth is surrounded by mucus. *Constitution Saving Throw*: DC 14, each creature in a 5-foot Emanation originating from the aboleth at the end of the aboleth''s turn. *Failure:*  The target is cursed. Until the curse ends, the target''s skin becomes slimy, the target can breathe air and water, and it can''t regain Hit Points unless it is underwater. While the cursed creature is outside a body of water, the creature takes 6 (1d12) Acid damage at the end of every 10 minutes unless moisture is applied to its skin before those minutes have passed.'
    save:
      ability: con
      dc: 14
      targeting:
        shape: emanation
        size: 5 ft.
        origin: self
      onFail:
        effects:
          conditions:
            - condition: Cursed
              additionalText: the target's skin becomes slimy; the target can breathe air and water; it can't regain Hit Points unless it is underwater
              duration:
                type: until
                trigger: the curse ends
          damageOverTime:
            damage:
              - dice: 1d12
                bonus: 0
                type: Acid
                average: 6
            timing:
              type: minutes
              count: 10
            condition: it is underwater
  - category: trait
    name: Probing Telepathy
    entryType: special
    text: If a creature the aboleth can see communicates telepathically with the aboleth, the aboleth learns the creature's greatest desires.
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The aboleth makes two Tentacle attacks and uses either Consume Memories or Dominate Mind if available.
    multiattack:
      attacks:
        - name: Tentacle
          count: 2
      substitutions: []
  - category: action
    name: Tentacle
    entryType: attack
    text: '*Melee Attack Roll:* +9, reach 15 ft. 12 (2d6 + 5) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of four tentacles.'
    attack:
      type: melee
      bonus: 9
      damage:
        - dice: 2d6
          bonus: 5
          type: Bludgeoning
          average: 12
      reach: 15 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 14
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of four tentacles.
  - category: action
    name: Consume Memories
    entryType: save
    text: '*Intelligence Saving Throw*: DC 16, one creature within 30 feet that is Charmed or Grappled by the aboleth. *Failure:*  10 (3d6) Psychic damage. *Success:*  Half damage. *Failure or Success*:  The aboleth gains the target''s memories if the target is a Humanoid and is reduced to 0 Hit Points by this action.'
    save:
      ability: int
      dc: 16
      targeting:
        type: single
        range: 30 ft.
        restrictions:
          conditions:
            - Charmed
          other:
            - grappled by source
      onFail:
        effects:
          other: 10 (3d6) Psychic damage.
        damage:
          - dice: 3d6
            bonus: 0
            type: Psychic
            average: 10
        legacyEffects: 10 (3d6) Psychic damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: action
    name: Dominate Mind (2/Day)
    entryType: save
    text: '*Wisdom Saving Throw*: DC 16, one creature the aboleth can see within 30 feet. *Failure:*  The target has the Charmed condition until the aboleth dies or is on a different plane of existence from the target. While Charmed, the target acts as an ally to the aboleth and is under its control while within 60 feet of it. In addition, the aboleth and the target can communicate telepathically with each other over any distance. The target repeats the save whenever it takes damage as well as after every 24 hours it spends at least 1 mile away from the aboleth, ending the effect on itself on a success.'
    limitedUse:
      count: 2
      reset: day
    save:
      ability: wis
      dc: 16
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
                trigger: the aboleth dies or is on a different plane of existence from the target
              saveToEnd:
                timing: when-damage
  - category: legendary
    name: Lash
    entryType: multiattack
    text: The aboleth makes one Tentacle attack.
    multiattack:
      attacks:
        - name: Tentacle
          count: 1
      substitutions: []
  - category: legendary
    name: Psychic Drain
    entryType: special
    text: If the aboleth has at least one creature Charmed or Grappled, it uses Consume Memories and regains 5 (1d10) Hit Points.
---

# Aboleth
*Large, Aberration, Lawful Evil*

**AC** 17
**HP** 150 (20d10 + 40)
**Initiative** +3 (13)
**Speed** 10 ft., swim 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 20
**Languages** Deep Speech, telepathy 120 ft.
CR 10, PB +4, XP 5900

## Traits

**Amphibious**
The aboleth can breathe air and water.

**Eldritch Restoration**
If destroyed, the aboleth gains a new body in 5d10 days, reviving with all its Hit Points in the Far Realm or another location chosen by the DM.

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the aboleth fails a saving throw, it can choose to succeed instead.

**Mucus Cloud**
While underwater, the aboleth is surrounded by mucus. *Constitution Saving Throw*: DC 14, each creature in a 5-foot Emanation originating from the aboleth at the end of the aboleth's turn. *Failure:*  The target is cursed. Until the curse ends, the target's skin becomes slimy, the target can breathe air and water, and it can't regain Hit Points unless it is underwater. While the cursed creature is outside a body of water, the creature takes 6 (1d12) Acid damage at the end of every 10 minutes unless moisture is applied to its skin before those minutes have passed.

**Probing Telepathy**
If a creature the aboleth can see communicates telepathically with the aboleth, the aboleth learns the creature's greatest desires.

## Actions

**Multiattack**
The aboleth makes two Tentacle attacks and uses either Consume Memories or Dominate Mind if available.

**Tentacle**
*Melee Attack Roll:* +9, reach 15 ft. 12 (2d6 + 5) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of four tentacles.

**Consume Memories**
*Intelligence Saving Throw*: DC 16, one creature within 30 feet that is Charmed or Grappled by the aboleth. *Failure:*  10 (3d6) Psychic damage. *Success:*  Half damage. *Failure or Success*:  The aboleth gains the target's memories if the target is a Humanoid and is reduced to 0 Hit Points by this action.

**Dominate Mind (2/Day)**
*Wisdom Saving Throw*: DC 16, one creature the aboleth can see within 30 feet. *Failure:*  The target has the Charmed condition until the aboleth dies or is on a different plane of existence from the target. While Charmed, the target acts as an ally to the aboleth and is under its control while within 60 feet of it. In addition, the aboleth and the target can communicate telepathically with each other over any distance. The target repeats the save whenever it takes damage as well as after every 24 hours it spends at least 1 mile away from the aboleth, ending the effect on itself on a success.

## Legendary Actions

**Lash**
The aboleth makes one Tentacle attack.

**Psychic Drain**
If the aboleth has at least one creature Charmed or Grappled, it uses Consume Memories and regains 5 (1d10) Hit Points.
