---
smType: creature
name: "Iron Golem"
size: "Large"
type: "Construct"
alignment: "Unaligned"
ac: "20"
initiative: "+9"
hp: "252"
hit_dice: "24d10 + 120"
speed_walk: "30 ft."
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"}}"
str: "24"
dex: "9"
con: "20"
int: "3"
wis: "11"
cha: "1"
pb: "+5"
senses: ["darkvision 120 ft."]
passives: ["Passive Perception 10"]
languages: ["Understands Common plus two other languages but can't speak"]
damage_immunities: ["Fire", "Poison", "Psychic", "Charmed", "Exhaustion", "Frightened", "Paralyzed", "Petrified", "Poisoned"]
cr: "16"
xp: "15000"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Fire Absorption\",\"text\":\"Whenever the golem is subjected to Fire damage, it regains a number of Hit Points equal to the Fire damage dealt.\"},{\"category\":\"trait\",\"name\":\"Immutable Form\",\"text\":\"The golem can't shape-shift.\"},{\"category\":\"trait\",\"name\":\"Magic Resistance\",\"text\":\"The golem has Advantage on saving throws against spells and other magical effects.\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The golem makes two attacks, using Bladed Arm or Fiery Bolt in any combination.\"},{\"category\":\"action\",\"name\":\"Bladed Arm\",\"text\":\"*Melee Attack Roll:* +12, reach 10 ft. 20 (3d8 + 7) Slashing damage plus 10 (3d6) Fire damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+12\",\"range\":\"10 ft\",\"damage\":\"20 (3d8 + 7) Slashing\"},{\"category\":\"action\",\"name\":\"Fiery Bolt\",\"text\":\"*Ranged Attack Roll:* +10, range 120 ft. 36 (8d8) Fire damage.\",\"kind\":\"Ranged Attack Roll\",\"to_hit\":\"+10\",\"range\":\"120 ft\",\"damage\":\"36 (8d8) Fire\"},{\"category\":\"action\",\"name\":\"Poison Breath\",\"recharge\":\"Recharge 6\",\"text\":\"*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  55 (10d10) Poison damage. *Success:*  Half damage.\",\"target\":\"each creature in a 60-foot Cone\",\"damage\":\"55 (10d10) Poison\",\"save_ability\":\"CON\",\"save_dc\":18,\"save_effect\":\"Half damage\"}]"
---

# Iron Golem
*Large, Construct, Unaligned*

**AC** 20
**HP** 252 (24d10 + 120)
**Speed** 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 24 | 9 | 20 | 3 | 11 | 1 |

CR 16, XP 15000

## Traits

**Fire Absorption**
Whenever the golem is subjected to Fire damage, it regains a number of Hit Points equal to the Fire damage dealt.

**Immutable Form**
The golem can't shape-shift.

**Magic Resistance**
The golem has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The golem makes two attacks, using Bladed Arm or Fiery Bolt in any combination.

**Bladed Arm**
*Melee Attack Roll:* +12, reach 10 ft. 20 (3d8 + 7) Slashing damage plus 10 (3d6) Fire damage.

**Fiery Bolt**
*Ranged Attack Roll:* +10, range 120 ft. 36 (8d8) Fire damage.

**Poison Breath (Recharge 6)**
*Constitution Saving Throw*: DC 18, each creature in a 60-foot Cone. *Failure:*  55 (10d10) Poison damage. *Success:*  Half damage.
