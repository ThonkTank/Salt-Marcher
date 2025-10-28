---
smType: creature
name: Ancient White Dragon
size: Gargantuan
type: Dragon
typeTags:
  - value: Chromatic
alignmentLawChaos: Chaotic
alignmentGoodEvil: Evil
ac: '20'
initiative: +4 (14)
hp: '333'
hitDice: 18d20 + 144
speeds:
  walk:
    distance: 40 ft.
  burrow:
    distance: 40 ft.
  fly:
    distance: 80 ft.
  swim:
    distance: 40 ft.
abilities:
  - key: str
    score: 26
    saveProf: false
  - key: dex
    score: 10
    saveProf: true
    saveMod: 6
  - key: con
    score: 26
    saveProf: false
  - key: int
    score: 10
    saveProf: false
  - key: wis
    score: 13
    saveProf: true
    saveMod: 7
  - key: cha
    score: 18
    saveProf: false
pb: '+6'
skills:
  - skill: Perception
    value: '13'
  - skill: Stealth
    value: '6'
sensesList:
  - type: blindsight
    range: '60'
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '23'
languagesList:
  - value: Common
  - value: Draconic
damageImmunitiesList:
  - value: Cold
cr: '20'
xp: '25000'
entries:
  - category: trait
    name: Ice Walk
    entryType: special
    text: The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.
  - category: trait
    name: Legendary Resistance (4/Day, or 5/Day in Lair)
    entryType: special
    text: If the dragon fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 4
      reset: day
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The dragon makes three Rend attacks.
    multiattack:
      attacks:
        - name: Rend
          count: 3
      substitutions: []
  - category: action
    name: Rend
    entryType: attack
    text: '*Melee Attack Roll:* +14, reach 15 ft. 17 (2d8 + 8) Slashing damage plus 7 (2d6) Cold damage.'
    attack:
      type: melee
      bonus: 14
      damage:
        - dice: 2d8
          bonus: 8
          type: Slashing
          average: 17
        - dice: 2d6
          bonus: 0
          type: Cold
          average: 7
      reach: 15 ft.
  - category: action
    name: Cold Breath (Recharge 5-6)
    entryType: save
    text: '*Constitution Saving Throw*: DC 22, each creature in a 90-foot Cone. *Failure:*  63 (14d8) Cold damage. *Success:*  Half damage.'
    recharge: 5-6
    save:
      ability: con
      dc: 22
      targeting:
        shape: cone
        size: 90 ft.
      onFail:
        effects:
          other: 63 (14d8) Cold damage.
        damage:
          - dice: 14d8
            bonus: 0
            type: Cold
            average: 63
        legacyEffects: 63 (14d8) Cold damage.
      onSuccess:
        damage: half
        legacyText: Half damage.
  - category: legendary
    name: Freezing Burst
    entryType: save
    text: '*Constitution Saving Throw*: DC 20, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  14 (4d6) Cold damage, and the target''s Speed is 0 until the end of the target''s next turn. *Failure or Success*:  The dragon can''t take this action again until the start of its next turn.'
    save:
      ability: con
      dc: 20
      targeting:
        shape: sphere
        size: 30 ft.
      onFail:
        effects:
          other: 14 (4d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn.
        damage:
          - dice: 4d6
            bonus: 0
            type: Cold
            average: 14
        legacyEffects: 14 (4d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn.
  - category: legendary
    name: Pounce
    entryType: multiattack
    text: The dragon moves up to half its Speed, and it makes one Rend attack.
    multiattack:
      attacks:
        - name: Rend
          count: 1
      substitutions: []
spellcastingEntries:
  - category: legendary
    name: Frightful Presence
    entryType: spellcasting
    text: The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18). The dragon can't take this action again until the start of its next turn.
    spellcasting:
      ability: cha
      saveDC: 18
      excludeComponents:
        - M
      spellLists: []
---

# Ancient White Dragon
*Gargantuan, Dragon, Chaotic Evil*

**AC** 20
**HP** 333 (18d20 + 144)
**Initiative** +4 (14)
**Speed** 40 ft., swim 40 ft., fly 80 ft., burrow 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** blindsight 60 ft., darkvision 120 ft.; Passive Perception 23
**Languages** Common, Draconic
CR 20, PB +6, XP 25000

## Traits

**Ice Walk**
The dragon can move across and climb icy surfaces without needing to make an ability check. Additionally, Difficult Terrain composed of ice or snow doesn't cost it extra movement.

**Legendary Resistance (4/Day, or 5/Day in Lair)**
If the dragon fails a saving throw, it can choose to succeed instead.

## Actions

**Multiattack**
The dragon makes three Rend attacks.

**Rend**
*Melee Attack Roll:* +14, reach 15 ft. 17 (2d8 + 8) Slashing damage plus 7 (2d6) Cold damage.

**Cold Breath (Recharge 5-6)**
*Constitution Saving Throw*: DC 22, each creature in a 90-foot Cone. *Failure:*  63 (14d8) Cold damage. *Success:*  Half damage.

## Legendary Actions

**Freezing Burst**
*Constitution Saving Throw*: DC 20, each creature in a 30-foot-radius Sphere [Area of Effect]|XPHB|Sphere centered on a point the dragon can see within 120 feet. *Failure:*  14 (4d6) Cold damage, and the target's Speed is 0 until the end of the target's next turn. *Failure or Success*:  The dragon can't take this action again until the start of its next turn.

**Pounce**
The dragon moves up to half its Speed, and it makes one Rend attack.

**Frightful Presence**
The dragon casts *Fear*, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18). The dragon can't take this action again until the start of its next turn.
