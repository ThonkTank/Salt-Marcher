---
smType: creature
name: "Azure Manticore"
size: "Large"
type: "Monstrosity"
alignment: "Chaotic Neutral"
ac: "17 (natural armor)"
hp: "136 (16d10 + 48)"
speeds_json: "{\"walk\":{\"distance\":\"40 ft.\"},\"fly\":{\"distance\":\"60 ft.\",\"hover\":false}}"
abilities_json: "[{\"ability\":\"str\",\"score\":18},{\"ability\":\"dex\",\"score\":15},{\"ability\":\"con\",\"score\":16},{\"ability\":\"int\",\"score\":5},{\"ability\":\"wis\",\"score\":12},{\"ability\":\"cha\",\"score\":10}]"
saves_json: "[{\"ability\":\"str\",\"bonus\":7},{\"ability\":\"dex\",\"bonus\":6}]"
skills_json: "[{\"name\":\"Perception\",\"bonus\":6},{\"name\":\"Stealth\",\"bonus\":6}]"
senses: ["darkvision 60 ft.", "passive Perception 16"]
languages: ["Understands Common, can't speak"]
damage_resistances: ["Poison"]
entries_structured_json: "[{\"category\":\"action\",\"name\":\"Multiattack\",\"text\":\"The manticore makes three tail spike attacks.\"},{\"category\":\"action\",\"name\":\"Tail Spike\",\"to_hit\":\"+7\",\"range\":\"100/200 ft.\",\"damage\":\"11 (2d6 + 4) piercing\"}]"
spellcasting_json: "{\"ability\":\"cha\",\"groups\":[{\"type\":\"at-will\",\"spells\":[{\"name\":\"Detect Magic\"},{\"name\":\"Message\"}]}],\"computed\":{\"abilityMod\":0,\"proficiencyBonus\":null,\"saveDc\":null,\"attackBonus\":null}}"
---

# Azure Manticore
*Large Monstrosity, Chaotic Neutral*

AC 17 (natural armor)    Initiative -
HP 136 (16d10 + 48)
Speed 40 ft., fly 60 ft.

| Ability | Score |
| ------: | :---- |
| STR | 18 |
| DEX | 15 |
| CON | 16 |
| INT | 5 |
| WIS | 12 |
| CHA | 10 |

Saves Str +7, Dex +6
Skills Perception +6, Stealth +6
Senses darkvision 60 ft., passive Perception 16
Resistances Poison
Languages Understands Common, can't speak

## Actions

- **Multiattack**
  The manticore makes three tail spike attacks.
- **Tail Spike**
  - to hit +7, 100/200 ft., 11 (2d6 + 4) piercing

## Spellcasting

### At Will

- Detect Magic
- Message
