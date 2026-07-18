package features.catalog.application;

/** Complete typed input vocabulary for the Monster vertical slice. */
public sealed interface MonsterCatalogIntent {

    record ChangeFilters(MonsterCatalogFilterDraft filters) implements MonsterCatalogIntent {
        public ChangeFilters {
            filters = filters == null ? MonsterCatalogFilterDraft.empty() : filters;
        }
    }

    record ChangeSort(MonsterCatalogSort sort) implements MonsterCatalogIntent {
        public ChangeSort {
            sort = sort == null ? MonsterCatalogSort.NAME_ASC : sort;
        }
    }

    record ShiftPage(int direction) implements MonsterCatalogIntent {
    }

    record SelectCreature(long creatureId) implements MonsterCatalogIntent {
    }

    record OpenCreature(long creatureId) implements MonsterCatalogIntent {
    }

    record AddToEncounter(long creatureId) implements MonsterCatalogIntent {
    }

    record AddToScene(long creatureId) implements MonsterCatalogIntent {
    }

    record Refresh() implements MonsterCatalogIntent {
    }
}
