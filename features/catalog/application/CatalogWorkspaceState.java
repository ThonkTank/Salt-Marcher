package features.catalog.application;

import java.util.Objects;

public record CatalogWorkspaceState(
        long revision,
        CatalogSectionId activeSection,
        MonsterCatalogState monsters,
        ItemsCatalogState items,
        SavedEncounterCatalogState savedEncounters,
        WorldReferenceCatalogState worldReferences,
        EncounterTableCatalogState encounterTables
) {
    public CatalogWorkspaceState {
        revision = Math.max(0L, revision);
        activeSection = Objects.requireNonNull(activeSection, "activeSection");
        monsters = Objects.requireNonNull(monsters, "monsters");
        items = Objects.requireNonNull(items, "items");
        savedEncounters = Objects.requireNonNull(savedEncounters, "savedEncounters");
        worldReferences = Objects.requireNonNull(worldReferences, "worldReferences");
        encounterTables = Objects.requireNonNull(encounterTables, "encounterTables");
    }
}
