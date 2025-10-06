---
smType: creature
name: "Wererat"
size: "Small"
type: "Monstrosity"
alignment: "Lawful Evil"
ac: "13"
initiative: "+3"
hp: "60"
hit_dice: "11d8 + 11"
speed_walk: "30 ft."
speed_climb: "30 ft."
speeds_json: "{\"walk\":{\"distance\":\"30 ft.\"},\"climb\":{\"distance\":\"30 ft.\"}}"
str: "10"
dex: "16"
con: "12"
int: "11"
wis: "10"
cha: "8"
pb: "+2"
skills_prof: ["Perception", "Stealth"]
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 14"]
languages: ["Common (can't speak in rat form)"]
cr: "2"
xp: "450"
entries_structured_json: "[{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The wererat makes two attacks, using Scratch or Hand Crossbow in any combination. It can replace one attack with a Bite attack.\"},{\"category\":\"action\",\"name\":\"Bite (Rat or Hybrid Form Only)\",\"text\":\"*Melee Attack Roll:* +5, reach 5 ft. 8 (2d4 + 3) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 11. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Wererat under the DM's control and has 10 Hit Points. *Success:*  The target is immune to this wererat's curse for 24 hours.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+5\",\"range\":\"5 ft\",\"damage\":\"8 (2d4 + 3) Piercing\",\"save_ability\":\"CON\",\"save_dc\":11,\"save_effect\":\"The target is immune to this wererat's curse for 24 hours\"},{\"category\":\"action\",\"name\":\"Scratch\",\"text\":\"*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Slashing damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+5\",\"range\":\"5 ft\",\"damage\":\"6 (1d6 + 3) Slashing\"},{\"category\":\"action\",\"name\":\"Hand Crossbow (Humanoid or Hybrid Form Only)\",\"text\":\"*Ranged Attack Roll:* +5, range 30/120 ft. 6 (1d6 + 3) Piercing damage.\",\"kind\":\"Ranged Attack Roll\",\"to_hit\":\"+5\",\"range\":\"30/120 ft\",\"damage\":\"6 (1d6 + 3) Piercing\"},{\"category\":\"bonus\",\"name\":\"Shape-Shift\",\"text\":\"The wererat shape-shifts into a Medium rat-humanoid hybrid or a Small rat, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.\"}]"
---

# Wererat
*Small, Monstrosity, Lawful Evil*

**AC** 13
**HP** 60 (11d8 + 11)
**Speed** 30 ft., climb 30 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 10 | 16 | 12 | 11 | 10 | 8 |

CR 2, XP 450

## Actions

**Multiattack**
The wererat makes two attacks, using Scratch or Hand Crossbow in any combination. It can replace one attack with a Bite attack.

**Bite (Rat or Hybrid Form Only)**
*Melee Attack Roll:* +5, reach 5 ft. 8 (2d4 + 3) Piercing damage. If the target is a Humanoid, it is subjected to the following effect. *Constitution Saving Throw*: DC 11. *Failure:*  The target is cursed. If the cursed target drops to 0 Hit Points, it instead becomes a Wererat under the DM's control and has 10 Hit Points. *Success:*  The target is immune to this wererat's curse for 24 hours.

**Scratch**
*Melee Attack Roll:* +5, reach 5 ft. 6 (1d6 + 3) Slashing damage.

**Hand Crossbow (Humanoid or Hybrid Form Only)**
*Ranged Attack Roll:* +5, range 30/120 ft. 6 (1d6 + 3) Piercing damage.

## Bonus Actions

**Shape-Shift**
The wererat shape-shifts into a Medium rat-humanoid hybrid or a Small rat, or it returns to its true humanoid form. Its game statistics, other than its size, are the same in each form. Any equipment it is wearing or carrying isn't transformed.
