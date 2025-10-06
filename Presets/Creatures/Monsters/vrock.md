---
smType: creature
name: "Vrock"
size: "Large"
type: "Fiend"
type_tags: ["Demon"]
alignment: "Chaotic Evil"
ac: "15"
initiative: "+2"
hp: "152"
hit_dice: "16d10 + 64"
speed_walk: "40 ft."
speed_fly: "60 ft."
speeds_json: "{\"walk\":{\"distance\":\"40 ft.\"},\"fly\":{\"distance\":\"60 ft.\"}}"
str: "17"
dex: "15"
con: "18"
int: "8"
wis: "13"
cha: "8"
pb: "+3"
saves_prof: ["DEX", "WIS", "CHA"]
senses: ["darkvision 120 ft."]
passives: ["Passive Perception 11"]
languages: ["Abyssal", "telepathy 120 ft."]
damage_resistances: ["Cold", "Fire", "Lightning"]
damage_immunities: ["Poison", "Poisoned"]
cr: "6"
xp: "2300"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Demonic Restoration\",\"text\":\"If the vrock dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.\"},{\"category\":\"trait\",\"name\":\"Magic Resistance\",\"text\":\"The vrock has Advantage on saving throws against spells and other magical effects.\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The vrock makes two Shred attacks.\"},{\"category\":\"action\",\"name\":\"Shred\",\"text\":\"*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Piercing damage plus 10 (3d6) Poison damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+6\",\"range\":\"5 ft\",\"damage\":\"10 (2d6 + 3) Piercing\"},{\"category\":\"action\",\"name\":\"Spores\",\"recharge\":\"Recharge 6\",\"text\":\"*Constitution Saving Throw*: DC 15, each creature in a 20-foot Emanation originating from the vrock. *Failure:*  The target has the Poisoned condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. While Poisoned, the target takes 5 (1d10) Poison damage at the start of each of its turns. Emptying a flask of Holy Water on the target ends the effect early.\",\"target\":\"each creature in a 20-foot Emanation originating from the vrock\",\"damage\":\"5 (1d10) Poison\",\"save_ability\":\"CON\",\"save_dc\":15},{\"category\":\"action\",\"name\":\"Stunning Screech\",\"recharge\":\"1/Day\",\"text\":\"*Constitution Saving Throw*: DC 15, each creature in a 20-foot Emanation originating from the vrock (demons succeed automatically). *Failure:*  10 (3d6) Thunder damage, and the target has the Stunned condition until the end of the vrock's next turn.\",\"target\":\"each creature in a 20-foot Emanation originating from the vrock (demons succeed automatically)\",\"damage\":\"10 (3d6) Thunder\",\"save_ability\":\"CON\",\"save_dc\":15}]"
---

# Vrock
*Large, Fiend, Chaotic Evil*

**AC** 15
**HP** 152 (16d10 + 64)
**Speed** 40 ft., fly 60 ft.

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 17 | 15 | 18 | 8 | 13 | 8 |

CR 6, XP 2300

## Traits

**Demonic Restoration**
If the vrock dies outside the Abyss, its body dissolves into ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Abyss.

**Magic Resistance**
The vrock has Advantage on saving throws against spells and other magical effects.

## Actions

**Multiattack**
The vrock makes two Shred attacks.

**Shred**
*Melee Attack Roll:* +6, reach 5 ft. 10 (2d6 + 3) Piercing damage plus 10 (3d6) Poison damage.

**Spores (Recharge 6)**
*Constitution Saving Throw*: DC 15, each creature in a 20-foot Emanation originating from the vrock. *Failure:*  The target has the Poisoned condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. While Poisoned, the target takes 5 (1d10) Poison damage at the start of each of its turns. Emptying a flask of Holy Water on the target ends the effect early.

**Stunning Screech (1/Day)**
*Constitution Saving Throw*: DC 15, each creature in a 20-foot Emanation originating from the vrock (demons succeed automatically). *Failure:*  10 (3d6) Thunder damage, and the target has the Stunned condition until the end of the vrock's next turn.
