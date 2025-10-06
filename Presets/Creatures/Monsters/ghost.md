---
smType: creature
name: "Ghost"
size: "Medium"
type: "Undead"
alignment: "Neutral Neutral"
ac: "11"
initiative: "+1"
hp: "45"
hit_dice: "10d8"
speed_walk: "5 ft."
speed_fly: "40 ft."
speed_fly_hover: true
speeds_json: "{\"walk\":{\"distance\":\"5 ft.\"},\"fly\":{\"distance\":\"40 ft.\",\"hover\":true}}"
str: "7"
dex: "13"
con: "10"
int: "10"
wis: "12"
cha: "17"
pb: "+2"
senses: ["darkvision 60 ft."]
passives: ["Passive Perception 11"]
languages: ["Common plus one other language"]
damage_resistances: ["Acid", "Bludgeoning", "Cold", "Fire", "Lightning", "Piercing", "Slashing", "Thunder"]
damage_immunities: ["Necrotic", "Poison", "Charmed", "Exhaustion", "Frightened", "Grappled", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained"]
cr: "4"
xp: "1100"
entries_structured_json: "[{\"category\":\"trait\",\"name\":\"Ethereal Sight\",\"text\":\"The ghost can see 60 feet into the Ethereal Plane when it is on the Material Plane.\"},{\"category\":\"trait\",\"name\":\"Incorporeal Movement\",\"text\":\"The ghost can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.\",\"damage\":\"5 (1d10) Force\"},{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The ghost makes two Withering Touch attacks.\"},{\"category\":\"action\",\"name\":\"Withering Touch\",\"text\":\"*Melee Attack Roll:* +5, reach 5 ft. 19 (3d10 + 3) Necrotic damage.\",\"kind\":\"Melee Attack Roll\",\"to_hit\":\"+5\",\"range\":\"5 ft\",\"damage\":\"19 (3d10 + 3) Necrotic\"},{\"category\":\"action\",\"name\":\"Horrific Visage\",\"text\":\"*Wisdom Saving Throw*: DC 13, each creature in a 60-foot Cone that can see the ghost and isn't an Undead. *Failure:*  10 (2d6 + 3) Psychic damage, and the target has the Frightened condition until the start of the ghost's next turn. *Success:*  The target is immune to this ghost's Horrific Visage for 24 hours.\",\"target\":\"each creature in a 60-foot Cone that can see the ghost and isn't an Undead\",\"damage\":\"10 (2d6 + 3) Psychic\",\"save_ability\":\"WIS\",\"save_dc\":13,\"save_effect\":\"The target is immune to this ghost's Horrific Visage for 24 hours\"},{\"category\":\"action\",\"name\":\"Possession\",\"recharge\":\"Recharge 6\",\"text\":\"*Charisma Saving Throw*: DC 13, one Humanoid the ghost can see within 5 feet. *Failure:*  The target is possessed by the ghost; the ghost disappears, and the target has the Incapacitated condition and loses control of its body. The ghost now controls the body, but the target retains awareness. The ghost can't be targeted by any attack, spell, or other effect, except ones that specifically target Undead. The ghost's game statistics are the same, except it uses the possessed target's Speed, as well as the target's Strength, Dexterity, and Constitution modifiers. The possession lasts until the body drops to 0 Hit Points or the ghost leaves as a Bonus Action. When the possession ends, the ghost appears in an unoccupied space within 5 feet of the target, and the target is immune to this ghost's Possession for 24 hours. *Success:*  The target is immune to this ghost's Possession for 24 hours.\",\"save_ability\":\"CHA\",\"save_dc\":13,\"save_effect\":\"The target is immune to this ghost's Possession for 24 hours\"},{\"category\":\"action\",\"name\":\"Etherealness\",\"text\":\"The ghost casts the *Etherealness* spell, requiring no spell components and using Charisma as the spellcasting ability. The ghost is visible on the Material Plane while on the Border Ethereal and vice versa, but it can't affect or be affected by anything on the other plane. - **At Will:** *Etherealness*\"}]"
---

# Ghost
*Medium, Undead, Neutral Neutral*

**AC** 11
**HP** 45 (10d8)
**Speed** 5 ft., fly 40 ft. (hover)

| STR | DEX | CON | INT | WIS | CHA |
| --- | --- | --- | --- | --- | --- |
| 7 | 13 | 10 | 10 | 12 | 17 |

CR 4, XP 1100

## Traits

**Ethereal Sight**
The ghost can see 60 feet into the Ethereal Plane when it is on the Material Plane.

**Incorporeal Movement**
The ghost can move through other creatures and objects as if they were Difficult Terrain. It takes 5 (1d10) Force damage if it ends its turn inside an object.

## Actions

**Multiattack**
The ghost makes two Withering Touch attacks.

**Withering Touch**
*Melee Attack Roll:* +5, reach 5 ft. 19 (3d10 + 3) Necrotic damage.

**Horrific Visage**
*Wisdom Saving Throw*: DC 13, each creature in a 60-foot Cone that can see the ghost and isn't an Undead. *Failure:*  10 (2d6 + 3) Psychic damage, and the target has the Frightened condition until the start of the ghost's next turn. *Success:*  The target is immune to this ghost's Horrific Visage for 24 hours.

**Possession (Recharge 6)**
*Charisma Saving Throw*: DC 13, one Humanoid the ghost can see within 5 feet. *Failure:*  The target is possessed by the ghost; the ghost disappears, and the target has the Incapacitated condition and loses control of its body. The ghost now controls the body, but the target retains awareness. The ghost can't be targeted by any attack, spell, or other effect, except ones that specifically target Undead. The ghost's game statistics are the same, except it uses the possessed target's Speed, as well as the target's Strength, Dexterity, and Constitution modifiers. The possession lasts until the body drops to 0 Hit Points or the ghost leaves as a Bonus Action. When the possession ends, the ghost appears in an unoccupied space within 5 feet of the target, and the target is immune to this ghost's Possession for 24 hours. *Success:*  The target is immune to this ghost's Possession for 24 hours.

**Etherealness**
The ghost casts the *Etherealness* spell, requiring no spell components and using Charisma as the spellcasting ability. The ghost is visible on the Material Plane while on the Border Ethereal and vice versa, but it can't affect or be affected by anything on the other plane. - **At Will:** *Etherealness*
