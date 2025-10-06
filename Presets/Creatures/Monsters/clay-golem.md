---
smType: creature
name: "Clay Golem"
size: "Large"
type: "Construct"
alignment: "Unaligned"
ac: "14"
initiative: "+3"
hp: "123"
hit_dice: "13d10 + 52"
speed_walk: "20 ft."
speeds_json: "{\"walk\":{\"distance\":\"20 ft.\"}}"
str: "20"
dex: "9"
con: "18"
int: "3"
wis: "8"
cha: "1"
pb: "+4"
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 9"]
languages: ["Common plus one other language"]
damage_resistances: ["Bludgeoning", "Piercing", "Slashing"]
damage_immunities: ["Acid", "Poison", "Psychic", "Charmed", "Exhaustion", "Frightened", "Paralyzed", "Petrified", "Poisoned"]
cr: "9"
xp: "5000"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Acid Absorption\",\"text\":\"Whenever the golem is subjected to Acid damage, it takes no damage and instead regains a number of Hit Points equal to the Acid damage dealt.\"},{\"category\":\"trait\",\"name\":\"Berserk\",\"text\":\"Whenever the golem starts its turn Bloodied, roll 1d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object. Once the golem goes berserk, it continues to be berserk until it is destroyed or it is no longer Bloodied.\"},{\"category\":\"trait\",\"name\":\"Immutable Form\",\"text\":\"The golem can't shape-shift.\"},{\"category\":\"trait\",\"name\":\"Magic Resistance\",\"text\":\"The golem has Advantage on saving throws against spells and other magical effects.\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The golem makes two Slam attacks, or it makes three Slam attacks if it used Hasten this turn.\"},{\"category\":\"action\",\"name\":\"Slam\",\"text\":\"*Melee Attack Roll:* +9, reach 5 ft. 10 (1d10 + 5) Bludgeoning damage plus 6 (1d12) Acid damage, and the target's Hit Point maximum decreases by an amount equal to the Acid damage taken.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+9\",\"range\":\"5 ft\",\"damage\":\"10 (1d10 + 5) Bludgeoning\"},{\"category\":\"bonus\",\"name\":\"Hasten\",\"recharge\":\"Recharge 5-6\",\"text\":\"The golem takes the Dash and Disengage actions.\"}]"
---

# Clay Golem
*Large, Construct, Unaligned*

**AC** 14
**HP** 123 (13d10 + 52)
**Speed** 20 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 20 | 9 | 18 | 3 | 8 | 1 |

CR 9, XP 5000

## Traits

**Acid Absorption**
Whenever the golem is subjected to Acid damage, it takes no damage and instead regains a number of Hit Points equal to the Acid damage dealt.

**Berserk**
Whenever the golem starts its turn Bloodied, roll 1d6. On a 6, the golem goes berserk. On each of its turns while berserk, the golem attacks the nearest creature it can see. If no creature is near enough to move to and attack, the golem attacks an object. Once the golem goes berserk, it continues to be berserk until it is destroyed or it is no longer Bloodied.

**Immutable Form**
The golem can't shape-shift.

**Magic Resistance**
The golem has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The golem makes two Slam attacks, or it makes three Slam attacks if it used Hasten this turn.

**Slam**
*Melee Attack Roll:* +9, reach 5 ft. 10 (1d10 + 5) Bludgeoning damage plus 6 (1d12) Acid damage, and the target's Hit Point maximum decreases by an amount equal to the Acid damage taken.

## Bonus Actions

**Hasten (Recharge 5-6)**
The golem takes the Dash and Disengage actions.
