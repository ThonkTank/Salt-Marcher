---
smType: creature
name: Vampire
size: Small
type: Undead
alignmentLawChaos: Lawful
alignmentGoodEvil: Evil
ac: '16'
initiative: +8 (18)
hp: '195'
hitDice: 23d8 + 92
speeds:
  walk:
    distance: 40 ft.
  climb:
    distance: 40 ft.
abilities:
  - key: str
    score: 18
    saveProf: false
  - key: dex
    score: 18
    saveProf: true
    saveMod: 9
  - key: con
    score: 18
    saveProf: true
    saveMod: 9
  - key: int
    score: 17
    saveProf: false
  - key: wis
    score: 15
    saveProf: true
    saveMod: 7
  - key: cha
    score: 18
    saveProf: true
    saveMod: 9
pb: '+5'
skills:
  - skill: Perception
    value: '7'
  - skill: Stealth
    value: '9'
sensesList:
  - type: darkvision
    range: '120'
passivesList:
  - skill: Perception
    value: '17'
languagesList:
  - value: Common plus two other languages
damageResistancesList:
  - value: Necrotic
cr: '13'
xp: '10000'
entries:
  - category: trait
    name: Legendary Resistance (3/Day, or 4/Day in Lair)
    entryType: special
    text: If the vampire fails a saving throw, it can choose to succeed instead.
    limitedUse:
      count: 3
      reset: day
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Misty Escape
    entryType: special
    text: If the vampire drops to 0 Hit Points outside its resting place, the vampire uses Shape-Shift to become mist (no action required). If it can't use Shape-Shift, it is destroyed. While it has 0 Hit Points in mist form, it can't return to its vampire form, and it must reach its resting place within 2 hours or be destroyed. Once in its resting place, it returns to its vampire form and has the Paralyzed condition until it regains any Hit Points, and it regains 1 Hit Point after spending 1 hour there.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Spider Climb
    entryType: special
    text: The vampire can climb difficult surfaces, including along ceilings, without needing to make an ability check.
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: trait
    name: Vampire Weakness
    entryType: special
    text: 'The vampire has these weaknesses: - **Forbiddance**: The vampire can''t enter a residence without an invitation from an occupant. - **Running Water**: The vampire takes 20 Acid damage if it ends its turn in running water. - **Stake to the Heart**: If a weapon that deals Piercing damage is driven into the vampire''s heart while the vampire has the Incapacitated condition in its resting place, the vampire has the Paralyzed condition until the weapon is removed. - **Sunlight**: The vampire takes 20 Radiant damage if it starts its turn in sunlight. While in sunlight, it has Disadvantage on attack rolls and ability checks.'
    trigger.activation: passive
    trigger.targeting:
      type: single
  - category: action
    name: Multiattack (Vampire Form Only)
    entryType: multiattack
    text: The vampire makes two Grave Strike attacks and uses Bite.
    multiattack:
      attacks:
        - name: Strike
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.targeting:
      type: self
  - category: action
    name: Grave Strike (Vampire Form Only)
    entryType: attack
    text: '*Melee Attack Roll:* +9, reach 5 ft. 8 (1d8 + 4) Bludgeoning damage plus 7 (2d6) Necrotic damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two hands.'
    attack:
      type: melee
      bonus: 9
      damage:
        - dice: 1d8
          bonus: 4
          type: Bludgeoning
          average: 8
        - dice: 2d6
          bonus: 0
          type: Necrotic
          average: 7
      reach: 5 ft.
      onHit:
        conditions:
          - condition: Grappled
            escape:
              type: dc
              dc: 14
            restrictions:
              size: Large or smaller
      additionalEffects: If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two hands.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: action
    name: Bite (Bat or Vampire Form Only)
    entryType: save
    text: '*Constitution Saving Throw*: DC 17, one creature within 5 feet that is willing or that has the Grappled, Incapacitated, or Restrained condition. *Failure:*  6 (1d4 + 4) Piercing damage plus 13 (3d8) Necrotic damage. The target''s Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount. A Humanoid reduced to 0 Hit Points by this damage and then buried rises the following sunset as a Vampire Spawn under the vampire''s control.'
    save:
      ability: con
      dc: 17
      targeting:
        type: single
        range: 5 ft.
        restrictions:
          conditions:
            - willing
      onFail:
        effects:
          other: 6 (1d4 + 4) Piercing damage plus 13 (3d8) Necrotic damage. The target's Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount. A Humanoid reduced to 0 Hit Points by this damage and then buried rises the following sunset as a Vampire Spawn under the vampire's control.
        damage:
          - dice: 1d4
            bonus: 4
            type: Piercing
            average: 6
          - dice: 3d8
            bonus: 0
            type: Necrotic
            average: 13
        legacyEffects: 6 (1d4 + 4) Piercing damage plus 13 (3d8) Necrotic damage. The target's Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount. A Humanoid reduced to 0 Hit Points by this damage and then buried rises the following sunset as a Vampire Spawn under the vampire's control.
    trigger.activation: action
    trigger.targeting:
      type: single
  - category: bonus
    name: Shape-Shift
    entryType: special
    text: If the vampire isn't in sunlight or running water, it shape-shifts into a Tiny bat (Speed 5 ft., Fly Speed 30 ft.) or a Medium cloud of mist (Speed 5 ft., Fly Speed 20 ft. [hover]), or it returns to its vampire form. Anything it is wearing transforms with it. While in bat form, the vampire can't speak. Its game statistics, other than its size and Speed, are unchanged. While in mist form, the vampire can't take any actions, speak, or manipulate objects. It is weightless and can enter an enemy's space and stop there. If air can pass through a space, the mist can do so, but it can't pass through liquid. It has Resistance to all damage, except the damage it takes from sunlight.
    trigger.activation: bonus
    trigger.targeting:
      type: single
  - category: legendary
    name: Deathless Strike
    entryType: multiattack
    text: The vampire moves up to half its Speed, and it makes one Grave Strike attack.
    multiattack:
      attacks:
        - name: Strike
          count: 1
      substitutions: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: self
spellcastingEntries:
  - category: bonus
    name: Charm (Recharge 5-6)
    entryType: spellcasting
    text: The vampire casts *Charm Person*, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 17), and the duration is 24 hours. The Charmed target is a willing recipient of the vampire's Bite, the damage of which doesn't end the spell. When the spell ends, the target is unaware it was Charmed by the vampire.
    recharge: 5-6
    spellcasting:
      ability: cha
      saveDC: 17
      spellLists: []
    trigger.activation: bonus
    trigger.targeting:
      type: single
  - category: legendary
    name: Beguile
    entryType: spellcasting
    text: The vampire casts *Command*, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 17). The vampire can't take this action again until the start of its next turn.
    spellcasting:
      ability: cha
      saveDC: 17
      spellLists: []
    trigger.activation: action
    trigger.legendaryCost: 1
    trigger.targeting:
      type: single
---

# Vampire
*Small, Undead, Lawful Evil*

**AC** 16
**HP** 195 (23d8 + 92)
**Initiative** +8 (18)
**Speed** 40 ft., climb 40 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 120 ft.; Passive Perception 17
**Languages** Common plus two other languages
CR 13, PB +5, XP 10000

## Traits

**Legendary Resistance (3/Day, or 4/Day in Lair)**
If the vampire fails a saving throw, it can choose to succeed instead.

**Misty Escape**
If the vampire drops to 0 Hit Points outside its resting place, the vampire uses Shape-Shift to become mist (no action required). If it can't use Shape-Shift, it is destroyed. While it has 0 Hit Points in mist form, it can't return to its vampire form, and it must reach its resting place within 2 hours or be destroyed. Once in its resting place, it returns to its vampire form and has the Paralyzed condition until it regains any Hit Points, and it regains 1 Hit Point after spending 1 hour there.

**Spider Climb**
The vampire can climb difficult surfaces, including along ceilings, without needing to make an ability check.

**Vampire Weakness**
The vampire has these weaknesses: - **Forbiddance**: The vampire can't enter a residence without an invitation from an occupant. - **Running Water**: The vampire takes 20 Acid damage if it ends its turn in running water. - **Stake to the Heart**: If a weapon that deals Piercing damage is driven into the vampire's heart while the vampire has the Incapacitated condition in its resting place, the vampire has the Paralyzed condition until the weapon is removed. - **Sunlight**: The vampire takes 20 Radiant damage if it starts its turn in sunlight. While in sunlight, it has Disadvantage on attack rolls and ability checks.

## Actions

**Multiattack (Vampire Form Only)**
The vampire makes two Grave Strike attacks and uses Bite.

**Grave Strike (Vampire Form Only)**
*Melee Attack Roll:* +9, reach 5 ft. 8 (1d8 + 4) Bludgeoning damage plus 7 (2d6) Necrotic damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two hands.

**Bite (Bat or Vampire Form Only)**
*Constitution Saving Throw*: DC 17, one creature within 5 feet that is willing or that has the Grappled, Incapacitated, or Restrained condition. *Failure:*  6 (1d4 + 4) Piercing damage plus 13 (3d8) Necrotic damage. The target's Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount. A Humanoid reduced to 0 Hit Points by this damage and then buried rises the following sunset as a Vampire Spawn under the vampire's control.

## Bonus Actions

**Shape-Shift**
If the vampire isn't in sunlight or running water, it shape-shifts into a Tiny bat (Speed 5 ft., Fly Speed 30 ft.) or a Medium cloud of mist (Speed 5 ft., Fly Speed 20 ft. [hover]), or it returns to its vampire form. Anything it is wearing transforms with it. While in bat form, the vampire can't speak. Its game statistics, other than its size and Speed, are unchanged. While in mist form, the vampire can't take any actions, speak, or manipulate objects. It is weightless and can enter an enemy's space and stop there. If air can pass through a space, the mist can do so, but it can't pass through liquid. It has Resistance to all damage, except the damage it takes from sunlight.

**Charm (Recharge 5-6)**
The vampire casts *Charm Person*, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 17), and the duration is 24 hours. The Charmed target is a willing recipient of the vampire's Bite, the damage of which doesn't end the spell. When the spell ends, the target is unaware it was Charmed by the vampire.

## Legendary Actions

**Deathless Strike**
The vampire moves up to half its Speed, and it makes one Grave Strike attack.

**Beguile**
The vampire casts *Command*, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 17). The vampire can't take this action again until the start of its next turn.
