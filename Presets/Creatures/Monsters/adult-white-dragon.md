---
smType: creature
name: Adult White Dragon
size: Huge
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '18'
initiative: +4 (14)
hp: '200'
hitDice: 16d12 + 96
speeds:
  walk:
    distance: 40 ft.
  burrow:
    distance: 30 ft.
  fly:
    distance: 80 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 22
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 5
  - key: con
    score: 22
    saveProf: false
  - key: int
    score: 8
    saveProf: false
  - key: wis
    score: 12
    saveProf: true
    saveMod: 6
  - key: cha
    score: 12
    saveProf: false
pb: '+5'
skills:
  - skill: Perception
    value: '11'
  - skill: Stealth
    value: '5'
sensesList:
  - type: blindsight
    range: '60'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '21'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Cold
cr: '13'
xp: '10000'
entries:
  - category: trait
    name: Ice Walk
    entryType: special
    text: The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    entryType: special
    text: If the dragon fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 3
      reset: day
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +11, reach 10 ft. 13 (2d6 + 6) Slashing damage plus 4 (1d8) Cold damage.'
    attack:
      type: melee
      bonus: 11
      damage:
        - dice: 2d6
          bonus: 6
          type: Slashing
          average: 13
        - dice: 1d8
          bonus: 0
          type: Cold
          average: 4
      reach: 10 ft.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Cold Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 19, each creature in a 60-foot Cone. *Failure:*  54 (12d8) Cold damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 19
      targeting:
        shape: cone
        size: 60 ft.
      onFail:
        effects:
          other: 54 (12d8) Cold damage.
        damage:
          - dice: 12d8
            bonus: 0
            type: Cold
            average: 54
        legacyEffects: 54 (12d8) Cold damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: legendary
    name: Freezing Burst
    entryType: save
    text: '*Constitution Saving Throw*: DC 14, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  7 (2d6) Cold damage, and the target''s Speed is 0 until the end of the target''s next turn. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: con
      dc: 14
      targeting:
        shape: sphere
        size: 30 ft.
      onFail:
        effects:
          other: 7 (2d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn.
        damage:
          - dice: 2d6
            bonus: 0
            type: Cold
            average: 7
        legacyEffects: 7 (2d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn.
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
  - category: legendary
    name: Pounce
    entryType: multiattack
    text: The dragon moves up to half its Speed, and it makes one Rend attack.
    multiattack:
      attacks:
        - name: Rend
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: self
spellcastingEntries:
  - category: legendary
    name: Frightful Presence
    entryType: spellcasting
    text: The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14). The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: cha
      saveDC: 14
      excludeComponents:
        - M
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
---

# Adult White Dragon
*Huge, Dragon, Chaotic Evil*

**AC** 18
**HP** 200 (16d12 + 96)
**Initiative** +4 (14)
**Speed** 40 ft., swim 40 ft., fly 80 ft., burrow 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 21
**Languages** Common, Draconic
CR 13, PB +5, XP 10000

## Traits

**Ice Walk**
The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +11, reach 10 ft. 13 (2d6 + 6) Slashing damage plus 4 (1d8) Cold damage.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 19, each creature in a 60-foot Cone. *Failure:*  54 (12d8) Cold damage. *Success:*  Half damage.

## Legendary Actions

**Freezing Burst**
*Constitution Saving Throw*: DC 14, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  7 (2d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.

**Frightful Presence**
The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 14). The dragon can't take this action again until the start of its next turn.
