---
smType: creature
name: Doppelganger
size: Medium
type: Monstrosity
alignmentLawChaos: Neutral
alignmentGoodEvil: Neutral
ac: '14'
initiative: +4 (14)
hp: '52'
hitDice: 8d8 + 16
speeds:
  walk:
    distance: 30 ft.
abilities:
  - key: str
    score: 11
    saveProf: false
  - key: dex
    score: 18
    saveProf: false
  - key: con
    score: 14
    saveProf: false
  - key: int
    score: 11
    saveProf: false
  - key: wis
    score: 12
    saveProf: false
  - key: cha
    score: 14
    saveProf: false
pb: '+2'
skills:
  - skill: Deception
    value: '6'
  - skill: Insight
    value: '3'
sensesList:
  - type: darkvision
    range: '60'
passivesList:
  - skill: Perception
    value: '11'
languagesList:
  - value: Common plus three other languages
conditionImmunitiesList:
  - value: Charmed
cr: '3'
xp: '700'
entries:
  - category: action
    name: Multiattack
    entryType: multiattack
    text: The doppelganger makes two Slam attacks and uses Unsettling Visage if available.
    multiattack:
      attacks:
        - name: Slam
          count: 2
      substitutions: []
  - category: action
    name: Slam
    entryType: attack
    text: '*Melee Attack Roll:* +6 (with Advantage during the first round of each combat), reach 5 ft. 11 (2d6 + 4) Bludgeoning damage.'
    attack:
      type: melee
      bonus: 6
      damage:
        - dice: 2d6
          bonus: 4
          type: Bludgeoning
          average: 11
      reach: 5 ft.
  - category: action
    name: Unsettling Visage
    entryType: save
    text: '*Wisdom Saving Throw*: DC 12, each creature in a 15-foot Emanation originating from the doppelganger that can see the doppelganger. *Failure:*  The target has the Frightened condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.'
    save:
      ability: wis
      dc: 12
      targeting:
        shape: emanation
        size: 15 ft.
        origin: self
      onFail:
        effects:
          conditions:
            - condition: Frightened
              saveToEnd:
                timing: end-of-turn
  - category: bonus
    name: Shape-Shift
    entryType: special
    text: The doppelganger shape-shifts into a Medium or Small Humanoid, or it returns to its true form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
spellcastingEntries:
  - category: action
    name: Read Thoughts
    entryType: spellcasting
    text: The doppelganger casts *Detect Thoughts*, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 12). - **At Will:** *Detect Thoughts*
    spellcasting:
      ability: cha
      saveDC: 12
      spellLists:
        - frequency: at-will
          spells:
            - Detect Thoughts
---

# Doppelganger
*Medium, Monstrosity, Neutral Neutral*

**AC** 14
**HP** 52 (8d8 + 16)
**Initiative** +4 (14)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

**Senses** darkvision 60 ft.; Passive Perception 11
**Languages** Common plus three other languages
CR 3, PB +2, XP 700

## Actions

**Multiattack**
The doppelganger makes two Slam attacks and uses Unsettling Visage if available.

**Slam**
*Melee Attack Roll:* +6 (with Advantage during the first round of each combat), reach 5 ft. 11 (2d6 + 4) Bludgeoning damage.

**Unsettling Visage (Recharge 6)**
*Wisdom Saving Throw*: DC 12, each creature in a 15-foot Emanation originating from the doppelganger that can see the doppelganger. *Failure:*  The target has the Frightened condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically.

**Read Thoughts**
The doppelganger casts *Detect Thoughts*, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 12). - **At Will:** *Detect Thoughts*

## Bonus Actions

**Shape-Shift**
The doppelganger shape-shifts into a Medium or Small Humanoid, or it returns to its true form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
