package features.catalog;

import features.creatures.api.CreatureCatalogQueryApi;
import features.creatures.api.CreatureReferenceIndexModel;
import features.encounter.api.EncounterBuilderInputsModel;
import features.encounter.api.SavedEncounterPlanListModel;
import features.encountertable.api.EncounterTableApi;
import features.encountertable.api.EncounterTableCatalogModel;
import features.items.api.ItemsCatalogApi;
import features.worldplanner.api.WorldPlannerSnapshotModel;
import java.util.Objects;
import platform.ui.UiDispatcher;

/** Required provider capabilities grouped by the Catalog section that consumes them. */
public record CatalogProviders(
        MonsterProviders monsters,
        ItemsProviders items,
        SavedEncounterProviders savedEncounters,
        WorldReferenceProviders worldReferences,
        EncounterTableProviders encounterTables,
        UiDispatcher publicationDispatcher
) {

    public CatalogProviders {
        monsters = Objects.requireNonNull(monsters, "monsters");
        items = Objects.requireNonNull(items, "items");
        savedEncounters = Objects.requireNonNull(savedEncounters, "savedEncounters");
        worldReferences = Objects.requireNonNull(worldReferences, "worldReferences");
        encounterTables = Objects.requireNonNull(encounterTables, "encounterTables");
        publicationDispatcher = Objects.requireNonNull(publicationDispatcher, "publicationDispatcher");
    }

    public record MonsterProviders(
            CreatureCatalogQueryApi queries,
            EncounterBuilderInputsModel encounterPoolFilters
    ) {
        public MonsterProviders {
            queries = Objects.requireNonNull(queries, "queries");
            encounterPoolFilters = Objects.requireNonNull(encounterPoolFilters, "encounterPoolFilters");
        }
    }

    public record ItemsProviders(ItemsCatalogApi catalog) {
        public ItemsProviders {
            catalog = Objects.requireNonNull(catalog, "catalog");
        }
    }

    public record SavedEncounterProviders(SavedEncounterPlanListModel plans) {
        public SavedEncounterProviders {
            plans = Objects.requireNonNull(plans, "plans");
        }
    }

    public record WorldReferenceProviders(
            CreatureReferenceIndexModel creatures,
            WorldPlannerSnapshotModel world
    ) {
        public WorldReferenceProviders {
            creatures = Objects.requireNonNull(creatures, "creatures");
            world = Objects.requireNonNull(world, "world");
        }
    }

    public record EncounterTableProviders(
            EncounterTableApi commands,
            EncounterTableCatalogModel catalog
    ) {
        public EncounterTableProviders {
            commands = Objects.requireNonNull(commands, "commands");
            catalog = Objects.requireNonNull(catalog, "catalog");
        }
    }
}
