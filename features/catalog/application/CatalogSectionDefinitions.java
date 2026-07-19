package features.catalog.application;

import java.util.List;
import java.util.Objects;

/** The complete, static seven-section Catalog composition. */
public record CatalogSectionDefinitions(
        MonsterCatalogDefinition monsters,
        ItemsCatalogDefinition items,
        SavedEncounterCatalogDefinition savedEncounters,
        NpcCatalogDefinition npcs,
        FactionCatalogDefinition factions,
        LocationCatalogDefinition locations,
        EncounterTableCatalogDefinition encounterTables
) {
    public CatalogSectionDefinitions {
        monsters = Objects.requireNonNull(monsters, "monsters");
        items = Objects.requireNonNull(items, "items");
        savedEncounters = Objects.requireNonNull(savedEncounters, "savedEncounters");
        npcs = Objects.requireNonNull(npcs, "npcs");
        factions = Objects.requireNonNull(factions, "factions");
        locations = Objects.requireNonNull(locations, "locations");
        encounterTables = Objects.requireNonNull(encounterTables, "encounterTables");
        List<CatalogSectionId> ids = List.of(
                monsters.id(), items.id(), savedEncounters.id(), npcs.id(), factions.id(), locations.id(),
                encounterTables.id());
        if (!ids.equals(List.of(CatalogSectionId.values()))) {
            throw new IllegalArgumentException("Catalog definitions must contain every section exactly once.");
        }
    }
}
