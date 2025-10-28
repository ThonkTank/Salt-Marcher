# Tag Vocabulary

Diese Liste dient als Ausgangspunkt für alle tagbasierten Systeme (Fraktionen, Orte, Dungeons, Loot, Audio).
Sie wird während Phase 0 kontinuierlich ergänzt.

## Kreaturen (`typeTags`)
| Tag        | Beschreibung              | Beispiele |
|------------|---------------------------|-----------|
| Angel      | Himmlische Wesen          | Planetar, Solar |
| Chromatic  | Chromatische Drachen      | Black, Blue, Red |
| Demon      | Dämonische Kreaturen      | Balor, Marilith |
| Devil      | Teuflische Kreaturen      | Pit Fiend, Erinyes |
| Dinosaur   | Urzeitliche Echsen        | Triceratops, T-Rex |
| Genie      | Elementare Genien         | Djinni, Efreeti |
| Goblinoid  | Goblinoide Humanoiden     | Goblin, Bugbear |
| Metallic   | Metallische Drachen       | Gold, Silver |
| Titan      | Gigantische Titanen       | Kraken, Tarrasque |
| Wizard     | Magisch geprägte Humanoide| Lich, Archmage |

> Datenbasis: `Presets/Creatures/**/` (`typeTags` Frontmatter)

## Items (`tags`)
| Tag      | Beschreibung                | Beispiele |
|----------|-----------------------------|-----------|
| Armor    | Schutzausrüstung            | Chain Mail, Plate |
| Potion   | Verbrauchbares Elixier      | Potion of Healing |
| Ring     | Schmuck mit Effekten        | Ring of Protection |
| Rod      | Magischer Stab              | Rod of the Pact Keeper |
| Scroll   | Schriftrolle                | Scroll of Fireball |
| Staff    | Zauberstab mit Ladungen     | Staff of Power |
| Wand     | Kurzer Zauberstab           | Wand of Magic Missiles |
| Weapon   | Waffen                      | Sword of Vengeance |
| Wondrous | Sonstige magische Gegenstände| Bag of Holding |

> Datenbasis: `Presets/Items/**/` (`tags` Frontmatter)

## Spells (`school`)
| Tag          | Beschreibung         |
|--------------|----------------------|
| Abjuration   | Schutz/Barrieren     |
| Conjuration  | Beschwörung/Teleport |
| Divination   | Erkenntnis           |
| Enchantment  | Geistesbeeinflussung |
| Evocation    | Energetische Effekte |
| Illusion     | Täuschung            |
| Necromancy   | Tod/Untote           |
| Transmutation| Verwandlung          |

> Datenbasis: `Presets/Spells/**/` (`school` Frontmatter)

## Offene Kategorien
- Equipment (aktuell keine Tags – ggf. `weapon_category`, `armor_category`, ...)
- Terrains (aktuell keine Tags – künftige Terrain-/Biome-Tags)
- Regions (aktuell keine Tags – mögliche Wetter-/Gefahren-Tags)
- Fraktionen (Kultur, Agenda, Gefahrenstufe)
- Orte (Biome, Infrastruktur, Stimmung)
- Dungeons (Themen, Gefahren, Rätsel)
- Loot (Material, Herkunft, Nutzung)
- Audio (Stimmung, Terrain, Tageszeit)

## ToDo
- Tags aus Equipment/Terrains/Regions definieren (Felder identifizieren, ggf. neue Listen einführen).
- Einheitliches Tag-Format entscheiden (String, `{ value }`, weitere Felder?).
- Automatisierte Konsistenzprüfung (`devkit lint tags`).
